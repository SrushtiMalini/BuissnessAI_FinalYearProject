"""Loads a trained per-restaurant demand model and predicts one (date, dish) quantity.

Usage: python predict_demand.py <restaurant_id> <date YYYY-MM-DD> <dish_name>

Always prints exactly one JSON line to stdout and exits 0, so the Node caller
can parse stdout unconditionally instead of branching on exit code:
  success:      {"predicted": <number>, "dish": "...", "date": "..."}
  not trained:  {"error": "not_trained", "message": "..."}
  other issue:  {"error": "<code>", "message": "..."}
"""
import sys
import json
import pickle
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "businessiq.db"
FESTIVAL_PATH = ROOT / "src" / "lib" / "ml" / "festival_calendar.json"
MODELS_DIR = Path(__file__).resolve().parent / "models"


def emit(payload: dict):
    print(json.dumps(payload))
    sys.exit(0)


def main():
    if len(sys.argv) < 4:
        emit({"error": "bad_args", "message": "usage: predict_demand.py <restaurant_id> <date> <dish_name>"})

    restaurant_id, date, dish_name = sys.argv[1], sys.argv[2], sys.argv[3]

    model_path = MODELS_DIR / f"{restaurant_id}_demand.pkl"
    if not model_path.exists():
        emit({"error": "not_trained", "message": "No trained model yet for this restaurant."})

    try:
        with open(model_path, "rb") as f:
            bundle = pickle.load(f)
    except Exception as e:
        emit({"error": "load_failed", "message": str(e)})

    model = bundle["model"]
    encoder = bundle["encoder"]
    feature_cols = bundle["feature_cols"]

    if dish_name not in encoder.classes_:
        emit({"error": "unknown_dish", "message": f"'{dish_name}' was not present in the training data."})

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        emit({"error": "bad_date", "message": f"'{date}' is not a valid YYYY-MM-DD date."})

    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "SELECT date, SUM(quantity) FROM billing_entries "
        "WHERE restaurant_id = ? AND dish_name = ? AND date < ? GROUP BY date ORDER BY date",
        (restaurant_id, dish_name, date),
    )
    history = cur.fetchall()
    conn.close()

    qty_by_date = {d: q for d, q in history}
    sorted_dates = sorted(qty_by_date.keys())

    def avg_last_n(n: int) -> float:
        last = sorted_dates[-n:]
        return sum(qty_by_date[d] for d in last) / len(last) if last else 0.0

    with open(FESTIVAL_PATH, encoding="utf-8") as f:
        festivals = set(json.load(f).keys())

    dow = target_date.weekday()
    feat_map = {
        "dish_encoded": int(encoder.transform([dish_name])[0]),
        "day_of_week": dow,
        "is_festival": 1 if date in festivals else 0,
        "is_weekend": 1 if dow >= 5 else 0,
        "past_7day_avg_quantity": avg_last_n(7),
        "past_14day_avg_quantity": avg_last_n(14),
    }
    X = pd.DataFrame([[feat_map[c] for c in feature_cols]], columns=feature_cols)
    predicted = float(model.predict(X)[0])

    emit({"predicted": round(max(0.0, predicted), 2), "dish": dish_name, "date": date})


if __name__ == "__main__":
    main()
