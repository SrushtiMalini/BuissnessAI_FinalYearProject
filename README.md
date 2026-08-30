# BusinessIQ

### AI-Powered Restaurant Business Intelligence & Decision Support Platform

BusinessIQ is a full-stack business intelligence platform designed for restaurants to turn raw billing/POS data into actionable business insights.

The platform combines **business analytics, forecasting, machine learning, and generative AI** to help restaurant owners understand revenue, orders, food costs, menu performance, demand, wastage, promotions, pricing, and workforce requirements.

Instead of manually analyzing spreadsheets and POS reports, BusinessIQ provides a centralized dashboard where restaurant data can be uploaded, analyzed, forecasted, and discussed with an AI business analyst.

---

## 🚀 Key Features

### 📊 Business Dashboard

Get a complete overview of restaurant performance through interactive KPIs and charts.

* Total Revenue
* Total Orders
* Average Daily Revenue
* Average Food Cost
* Revenue trends
* Gross profit trends
* Top-performing dishes
* Revenue by meal period
* Weekly performance comparison
* Peak ordering hours

---

### 📁 POS / Billing Data Upload

Upload restaurant billing data in CSV format and automatically process it for analysis.

Supported workflows include:

* CSV billing data upload
* POS export processing
* Data validation
* Automatic parsing
* Data preview
* Sample dataset generation

The system supports flexible column names and can work with exports from systems such as Petpooja and Poster POS.

---

### 🔮 Demand & Revenue Forecasting

BusinessIQ provides short-term forecasting using historical restaurant sales data.

The forecasting module provides:

* 7-day revenue forecast
* Day-by-day predictions
* Dish-level forecasts
* Preparation quantity estimates
* MAE — Mean Absolute Error
* RMSE — Root Mean Square Error

The forecasting model is implemented within the project without depending on an external machine-learning library for the core weighted moving average model.

**Trained Model (Beta):** the Forecast page also offers a real, trained
`GradientBoostingRegressor` (scikit-learn), fit on the restaurant's own billing history
via a one-click "Train Model" button. It runs alongside — not instead of — the WMA
baseline above, and the page shows both predictions side by side so the two can be
compared directly. See `server/ml/train_demand_model.py` / `server/ml/predict_demand.py`.

---

## 🤖 AI Business Analyst

BusinessIQ includes a conversational AI analyst that allows restaurant owners to ask questions about their actual business data.

Example questions:

> Which dishes generated the most revenue?

> What are my peak business hours?

> Why did revenue decrease this week?

> Which dishes should I promote?

> What should I prepare more of tomorrow?

The AI responses are grounded in the restaurant's available business data rather than providing generic business advice.

---

## 📝 AI-Generated Business Reports

Generate AI-powered restaurant reports using actual business information.

Available reports include:

* Morning Brief
* Evening Report
* Revenue summary
* Order summary
* Food-cost analysis
* Business observations
* Actionable recommendations

Reports are generated using the application's data context and AI analysis.

---

## 🍽️ Menu Profitability Analysis

BusinessIQ analyzes individual menu items using price, cost, revenue, and sales performance.

Menu items can be classified into categories such as:

| Category       | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| ⭐ Star         | High-performing item that should be protected and promoted |
| 💎 Hidden Gem  | Strong potential that deserves more promotion              |
| ⚠️ Volume Trap | High sales volume but may require repricing                |
| ❌ Dead Weight  | Poor-performing item that may need to be removed           |

This helps restaurant owners make better menu engineering decisions.

---

## 🧠 Machine Learning Modules

BusinessIQ contains multiple restaurant-focused ML modules:

### Dynamic Pricing

Helps analyze pricing opportunities based on business performance.

### Ingredient Forecasting

Estimates future ingredient requirements based on expected demand.

### Promotion Analysis

Analyzes promotional performance and helps identify better promotion strategies.

### Wastage Prediction

Helps identify potential food wastage and improve inventory decisions.

### Workforce Forecasting

Helps estimate workforce requirements according to expected business demand.

---

## 🏗️ Project Architecture

```text
BusinessIQ
│
├── Frontend
│   ├── React
│   ├── TypeScript
│   ├── React Router
│   ├── Tailwind CSS
│   ├── Recharts
│   └── Lucide React
│
├── Backend
│   ├── Node.js
│   ├── Express
│   ├── TypeScript
│   └── Vite Middleware
│
├── Analytics
│   ├── KPI Calculation
│   ├── Revenue Analysis
│   ├── Meal Period Analysis
│   ├── Peak Hour Analysis
│   └── Menu Performance
│
├── Forecasting
│   └── Weighted Moving Average
│
├── Machine Learning
│   ├── Dynamic Pricing
│   ├── Ingredient Forecast
│   ├── Promotion Analysis
│   ├── Wastage Prediction
│   └── Workforce Forecast
│
└── Generative AI
    ├── AI Business Analyst
    ├── AI Reports
    └── NVIDIA AI API
```

---

## 🛠️ Technology Stack

### Frontend

* React 19
* TypeScript
* Vite
* React Router
* Tailwind CSS
* Recharts
* Lucide React
* Motion

### Backend

* Node.js
* Express
* TypeScript
* Vite Middleware

### AI

* NVIDIA AI API
* `minimaxai/minimax-m3`

### Data Processing

* CSV parsing
* Custom analytics functions
* Custom forecasting logic (Weighted Moving Average)
* Server-side SQLite database (`data/businessiq.db`)

---

## 📂 Project Structure

```text
BuissnessAI_FinalYearProject/
│
├── src/
│   ├── components/
│   ├── design-system/
│   ├── layout/
│   ├── lib/
│   │   ├── analytics.ts
│   │   ├── aiClient.ts
│   │   ├── csvParser.ts
│   │   ├── forecasting.ts
│   │   ├── menuEngine.ts
│   │   ├── reportGenerator.ts
│   │   ├── storage.ts
│   │   └── ml/
│   │       ├── dynamicPricing.ts
│   │       ├── features.ts
│   │       ├── ingredientForecast.ts
│   │       ├── promotionAnalyzer.ts
│   │       ├── wastagePredictor.ts
│   │       └── workforceForecast.ts
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── UploadPage.tsx
│   │   ├── ForecastPage.tsx
│   │   ├── MenuPage.tsx
│   │   ├── ChatPage.tsx
│   │   ├── ReportPage.tsx
│   │   └── ml/
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── server.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

---

# ⚙️ Installation

## Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Git
* Python 3.9+ and pip (new requirement — powers the trained Demand Forecasting model; see below)
* VS Code (recommended)

Check Node.js:

```bash
node -v
```

Check npm:

```bash
npm -v
```

---

## 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Move into the project:

```bash
cd BuissnessAI_FinalYearProject
```

---

## 2. Install Dependencies

```bash
npm install
```

**New Python runtime dependency:** the Forecast page's "Train Model" feature (a real
scikit-learn `GradientBoostingRegressor`, alongside the original formula-based WMA
forecast) shells out to Python. Install its dependencies once:

```bash
pip install -r requirements.txt
```

This is the project's first Python dependency — everything else still runs on Node.
If `python`/`pip` aren't on your PATH, install Python 3.9+ first. The rest of the app
(including the WMA baseline forecast) works fine without this step; only "Train Model"
and the trained-model comparison need it.

---

## 3. Configure Environment Variables

Create a `.env` file from the example:

### Windows

```cmd
copy .env.example .env
```

### macOS / Linux

```bash
cp .env.example .env
```

Then configure:

```env
NVIDIA_API_KEY="your_nvidia_api_key_here"

APP_URL="http://localhost:3000"
```

The NVIDIA API key is required for the AI Analyst and AI-generated report features.

---

## 4. Run the Application

Start the development server:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

# 🧪 Development Commands

### Start development server

```bash
npm run dev
```

### TypeScript validation

```bash
npm run lint
```

### Create production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

> Note: The `clean` script currently uses the Unix `rm -rf` command and may not work directly in Windows Command Prompt.

---

# 📈 Application Workflow

```text
Restaurant Owner
       │
       ▼
   Setup Profile
       │
       ▼
 Upload POS / CSV Data
       │
       ▼
 Data Processing
       │
       ▼
 ┌───────────────────────┐
 │ Business Analytics    │
 │ KPI Calculation       │
 │ Menu Analysis         │
 │ Forecasting           │
 │ ML Recommendations    │
 └───────────────────────┘
       │
       ▼
 BusinessIQ Dashboard
       │
       ├──────────────► AI Analyst
       │
       ├──────────────► AI Reports
       │
       ├──────────────► Demand Forecast
       │
       └──────────────► Business Recommendations
```

---

# 🎯 Problem Statement

Restaurant owners generate large amounts of operational data through billing and POS systems, but this data is often underutilized.

Traditional POS systems primarily record transactions. They do not always provide accessible, integrated decision support for questions such as:

* What should I prepare tomorrow?
* Which menu items are actually profitable?
* When are my busiest hours?
* How much revenue can I expect next week?
* Which ingredients should I purchase?
* Where is food wastage occurring?
* Which promotions are effective?
* Do I need additional staff during specific periods?

BusinessIQ addresses this gap by converting raw restaurant transaction data into understandable business intelligence and actionable recommendations.

---

# 💡 Project Objective

The main objective of BusinessIQ is to build an intelligent restaurant decision-support platform that combines:

**Data Analytics + Forecasting + Machine Learning + Generative AI**

to help restaurant owners make faster and more informed operational decisions.

---

# 🔐 Security

API keys should never be committed to GitHub.

The `.env` file is intended for local secrets and should remain excluded from version control.

Example:

```text
.env
```

Do not replace the API key with a real key inside `.env.example`.

---

# 🚀 Future Enhancements

Possible future improvements include:

* Migration from SQLite to PostgreSQL (scoped for if/when concurrent load grows beyond what SQLite comfortably handles — SQLite is a deliberate choice for the current single-node scale)
* Real-time POS integration
* User authentication
* Multi-restaurant support
* Cloud deployment
* Advanced demand forecasting
* Inventory management
* Automated purchase recommendations
* Real-time notifications
* Role-based dashboards
* Financial accounting integration
* Mobile application
* Advanced ML model evaluation
* Automated daily business alerts

---

# 👨‍💻 Project

**Project Name:** BusinessIQ

**Project Type:** Final Year Major Project

**Domain:** Business Intelligence / Data Analytics / Artificial Intelligence

**Target Industry:** Restaurants & Food Service

**Core Technologies:** React, TypeScript, Node.js, Express, AI, Machine Learning, Data Analytics

---

## ⭐ Why BusinessIQ?

BusinessIQ is not just a dashboard.

It combines historical business data, analytics, forecasting, machine learning, and generative AI into a single decision-support system.

The goal is simple:

> **Turn restaurant data into decisions.**

---

## 📜 License

This project is developed for academic and educational purposes.
