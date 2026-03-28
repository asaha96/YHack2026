from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.biomedclip import semantic_query

router = APIRouter()


class QueryRequest(BaseModel):
    session_id: str
    query_text: str
    image_base64: Optional[str] = None


class RegionResult(BaseModel):
    center: list[float]
    radius: float
    score: float
    label: str


class QueryResponse(BaseModel):
    method: str
    similarity_score: Optional[float] = None
    regions: list[RegionResult]
    explanation: str


@router.post("/query", response_model=QueryResponse)
async def handle_query(req: QueryRequest):
    # Load organ metadata for LLM fallback
    import json
    from pathlib import Path

    metadata_path = Path(__file__).parent.parent.parent / "frontend" / "public" / "models" / "metadata.json"
    organ_metadata = None
    if metadata_path.exists():
        with open(metadata_path) as f:
            organ_metadata = json.load(f)

    result = await semantic_query(
        query_text=req.query_text,
        image_base64=req.image_base64,
        organ_metadata=organ_metadata,
    )

    return result
