"""Trains a per-restaurant demand model (GradientBoostingRegressor) from billing_entries.

Usage: python train_demand_model.py <restaurant_id>

Prints a human-readable summary, then a final "RESULT_JSON:{...}" line that
server.ts parses to return the training summary to the client.
"""
import sys
import json
import pickle
from pathlib import Path
from datetime import datetime, timezone
import sqlite3

import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "businessiq.db"
FESTIVAL_PATH = ROOT / "src" / "lib" / "ml" / "festival_calendar.json"
MODELS_DIR = Path(__file__).resolve().parent / "models"

FEATURE_COLS = [
    "dish_encoded",
    "day_of_week",
    "is_festival",
    "is_weekend",
    "past_7day_avg_quantity",
    "past_14day_avg_quantity",
]

MIN_DAYS_REQUIRED = 14


def load_festivals() -> set:
    with open(FESTIVAL_PATH, encoding="utf-8") as f:
        return set(json.load(f).keys())


def fail(message: str):
    print(message)
    print("RESULT_JSON:" + json.dumps({"ok": False, "error": message}))
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        fail("restaurant_id argument is required")
    restaurant_id = sys.argv[1]

    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(
        "SELECT date, dish_name, quantity FROM billing_entries WHERE restaurant_id = ?",
        conn,
        params=(restaurant_id,),
    )
    conn.close()

    if df.empty:
        fail(f"No billing data found for restaurant {restaurant_id}.")

    daily = df.groupby(["date", "dish_name"], as_index=False)["quantity"].sum()
    dates = sorted(daily["date"].unique())

    if len(dates) < MIN_DAYS_REQUIRED:
        fail(f"Only {len(dates)} days of billing history — need at least {MIN_DAYS_REQUIRED} to train.")

    festivals = load_festivals()
    pivot = daily.pivot(index="date", columns="dish_name", values="quantity").reindex(dates).fillna(0)

    rows = []
    for dish in pivot.columns:
        series = pivot[dish]
        for i in range(MIN_DAYS_REQUIRED, len(dates) - 1):
            date = dates[i]
            d = datetime.strptime(date, "%Y-%m-%d")
            rows.append({
                "dish_name": dish,
                "date": date,
                "day_of_week": d.weekday(),
                "is_festival": 1 if date in festivals else 0,
                "is_weekend": 1 if d.weekday() >= 5 else 0,
                "past_7day_avg_quantity": float(series.iloc[i - 7:i].mean()),
                "past_14day_avg_quantity": float(series.iloc[i - 14:i].mean()),
                "target": float(series.iloc[i + 1]),
            })

    data = pd.DataFrame(rows)
    if data.empty:
        fail("Not enough per-dish history to build training rows.")

    encoder = LabelEncoder()
    data["dish_encoded"] = encoder.fit_transform(data["dish_name"])

    unique_dates = sorted(data["date"].unique())
    n_test_dates = max(1, int(len(unique_dates) * 0.15))
    test_dates = set(unique_dates[-n_test_dates:])

    train_df = data[~data["date"].isin(test_dates)]
    test_df = data[data["date"].isin(test_dates)]
    if train_df.empty or test_df.empty:
        train_df, test_df = data.iloc[: int(len(data) * 0.85)], data.iloc[int(len(data) * 0.85):]

    model = GradientBoostingRegressor(n_estimators=150, max_depth=3, learning_rate=0.1, random_state=42)
    model.fit(train_df[FEATURE_COLS], train_df["target"])

    test_pred = model.predict(test_df[FEATURE_COLS])
    mae = mean_absolute_error(test_df["target"], test_pred)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"{restaurant_id}_demand.pkl"
    trained_at = datetime.now(timezone.utc).isoformat()

    with open(model_path, "wb") as f:
        pickle.dump({
            "model": model,
            "encoder": encoder,
            "feature_cols": FEATURE_COLS,
            "trained_at": trained_at,
            "mae": float(mae),
            "rows_used": len(data),
            "days_used": len(dates),
        }, f)

    print(f"Training data: {len(dates)} days, {len(data)} (dish, day) samples across {data['dish_name'].nunique()} dishes")
    print(f"Train/test split: {len(train_df)} train rows / {len(test_df)} test rows ({len(test_dates)} held-out days)")
    print(f"Validation MAE: {mae:.2f} units")
    print(f"Model saved to {model_path}")

    print("RESULT_JSON:" + json.dumps({
        "ok": True,
        "rowsUsed": int(len(data)),
        "daysUsed": int(len(dates)),
        "dishCount": int(data["dish_name"].nunique()),
        "trainRows": int(len(train_df)),
        "testRows": int(len(test_df)),
        "mae": round(float(mae), 2),
        "trainedAt": trained_at,
    }))


if __name__ == "__main__":
    main()
