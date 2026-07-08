from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
import os
import joblib
import pandas as pd
import mimetypes

mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class CustomerData(BaseModel):
    age: int = Field(..., ge=1, le=120)
    annual_income: float = Field(..., ge=0, le=1000)
    spending_score: int = Field(..., ge=1, le=100)

class SegmentResponse(BaseModel):
    cluster_id: int
    name: str
    profile: str
    marketing_action: str
    mean_age: float
    mean_income: float
    mean_spending_score: float
    size: int

model_bundle = {}

PERSONAS = {
    0: {
        "name": "Traditionalists",
        "profile": "Older customers with moderate incomes and moderate spending habits.",
        "marketing_action": "Target with practical, reliable products, loyalty program incentives, and value-based promotions.",
        "mean_age": 56.33,
        "mean_income": 54.27,
        "mean_spending_score": 49.07,
        "size": 45
    },
    1: {
        "name": "Young Moderate Spenders",
        "profile": "Younger customers with moderate incomes and moderate spending habits.",
        "marketing_action": "Engage through social media marketing, mobile-first promotions, and subscription-based service offers.",
        "mean_age": 26.79,
        "mean_income": 57.10,
        "mean_spending_score": 48.13,
        "size": 39
    },
    2: {
        "name": "Affluent Conservatives",
        "profile": "Middle-aged customers with high incomes but low spending scores.",
        "marketing_action": "Target with high-end premium goods, exclusive VIP invitations, and personalized loyalty benefits emphasizing long-term value.",
        "mean_age": 41.94,
        "mean_income": 88.94,
        "mean_spending_score": 16.97,
        "size": 33
    },
    3: {
        "name": "High-Value Trendsetters",
        "profile": "Young-to-middle-aged customers with high incomes and high spending scores.",
        "marketing_action": "Target with luxury items, new arrivals, high-prestige product launches, and personal shopper services.",
        "mean_age": 32.69,
        "mean_income": 86.54,
        "mean_spending_score": 82.13,
        "size": 39
    },
    4: {
        "name": "Spender Apprentices",
        "profile": "Young customers with low incomes but high spending scores.",
        "marketing_action": "Promote low-cost trend items, flash sales, student discounts, and buy-now-pay-later payment options.",
        "mean_age": 25.00,
        "mean_income": 25.26,
        "mean_spending_score": 77.61,
        "size": 23
    },
    5: {
        "name": "Budget Conscious",
        "profile": "Middle-aged to older customers with low incomes and low spending scores.",
        "marketing_action": "Focus on budget friendly products, clearance sales, and basic utility offerings.",
        "mean_age": 45.52,
        "mean_income": 26.29,
        "mean_spending_score": 19.38,
        "size": 21
    }
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    model_path = os.path.join(BASE_DIR, "models", "customer_segmentation_model.joblib")
    if not os.path.exists(model_path):
         raise RuntimeError("Model bundle not found")
    model_bundle.update(joblib.load(model_path))
    yield
    model_bundle.clear()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/predict-segment", response_model=SegmentResponse)
async def predict_segment(data: CustomerData):
    scaler = model_bundle.get("scaler")
    kmeans = model_bundle.get("model")
    if not scaler or not kmeans:
        raise HTTPException(status_code=500, detail="Model bundle not loaded")
    
    input_df = pd.DataFrame(
        [[data.age, data.annual_income, data.spending_score]],
        columns=["Age", "Annual Income (k$)", "Spending Score (1-100)"]
    )
    scaled_values = scaler.transform(input_df)
    cluster_id = int(kmeans.predict(scaled_values)[0])
    
    persona = PERSONAS.get(cluster_id)
    if not persona:
        raise HTTPException(status_code=500, detail="Invalid cluster prediction")
        
    return SegmentResponse(
        cluster_id=cluster_id,
        name=persona["name"],
        profile=persona["profile"],
        marketing_action=persona["marketing_action"],
        mean_age=persona["mean_age"],
        mean_income=persona["mean_income"],
        mean_spending_score=persona["mean_spending_score"],
        size=persona["size"]
    )

app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "frontend"), html=True), name="frontend")
