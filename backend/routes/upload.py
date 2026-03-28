import os
import uuid
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    size_bytes: int
    splat_path: str
    message: str


@router.post("/upload", response_model=UploadResponse)
async def handle_upload(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())[:8]
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    filepath = os.path.join(session_dir, file.filename or "scan.dcm")
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # For hackathon: use the pre-existing sample splat
    # In production: trigger actual reconstruction pipeline
    splat_path = f"/splats/sample.splat"

    return UploadResponse(
        session_id=session_id,
        filename=file.filename or "scan.dcm",
        size_bytes=len(content),
        splat_path=splat_path,
        message="Scan uploaded. Using pre-computed reconstruction for demo.",
    )


class SampleResponse(BaseModel):
    session_id: str
    splat_path: str
    message: str


@router.post("/upload/sample", response_model=SampleResponse)
async def use_sample():
    session_id = f"sample-{uuid.uuid4().hex[:6]}"
    return SampleResponse(
        session_id=session_id,
        splat_path="/splats/sample.splat",
        message="Sample abdominal CT loaded. Reconstructing 3D model...",
    )
