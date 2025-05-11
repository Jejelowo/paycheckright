from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PaystubText(BaseModel):
    text: str

@app.post("/analyze-paystub")
async def analyze_paystub(data: PaystubText):
    text = data.text
    gross_match = re.search(r"(?i)gross\\s*pay[:\\s\\$]*([\\d,\\.]+)", text)
    ytd_match = re.search(r"(?i)ytd\\s*(federal\\s*)?tax(?:es)?\\s*(withheld)?[:\\s\\$]*([\\d,\\.]+)", text)

    gross_pay = float(gross_match.group(1).replace(',', '')) if gross_match else None
    ytd_withheld = float(ytd_match.group(3).replace(',', '')) if ytd_match else None

    estimated_tax_owed = (gross_pay - 13850) * 0.12 if gross_pay and gross_pay > 13850 else 0
    estimated_refund = ytd_withheld - estimated_tax_owed if ytd_withheld else None

    return {
        "gross_pay": gross_pay,
        "ytd_withheld": ytd_withheld,
        "estimated_tax_owed": round(estimated_tax_owed, 2),
        "estimated_refund": round(estimated_refund, 2) if estimated_refund is not None else None,
        "parsed": bool(gross_pay or ytd_withheld)
    }
