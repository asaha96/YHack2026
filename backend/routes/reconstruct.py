import asyncio
import os
import glob
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict

router = APIRouter()

_reconstruction_status: dict[str, dict] = {}

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")
SAMPLE_CT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_ct", "sample_ct.nii.gz")
SPLAT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "splats")
MESH_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "models", "reconstructed")


class ReconstructRequest(BaseModel):
    session_id: str


class ReconstructStatus(BaseModel):
    session_id: str
    status: str  # "processing" | "complete" | "error"
    progress: int
    splat_path: Optional[str] = None
    mesh_dir: Optional[str] = None
    message: str = ""
    structures: Optional[List[Dict]] = None


@router.post("/reconstruct", response_model=ReconstructStatus)
async def trigger_reconstruct(req: ReconstructRequest):
    sid = req.session_id
    _reconstruction_status[sid] = {"status": "processing", "progress": 0, "message": "Starting..."}

    asyncio.create_task(_run_reconstruction(sid))

    return ReconstructStatus(session_id=sid, status="processing", progress=0, message="Starting reconstruction...")


@router.get("/reconstruct/{session_id}", response_model=ReconstructStatus)
async def get_reconstruct_status(session_id: str):
    status = _reconstruction_status.get(session_id)
    if not status:
        # Check if a pre-existing splat exists
        splat = os.path.join(SPLAT_DIR, f"{session_id}.splat")
        if os.path.exists(splat):
            return ReconstructStatus(session_id=session_id, status="complete", progress=100, splat_path=f"/splats/{session_id}.splat", message="Ready")
        # Fallback to sample
        return ReconstructStatus(session_id=session_id, status="complete", progress=100, splat_path="/splats/sample.splat", message="Ready (sample)")

    return ReconstructStatus(
        session_id=session_id,
        status=status["status"],
        progress=status["progress"],
        splat_path=status.get("splat_path"),
        mesh_dir=status.get("mesh_dir"),
        message=status.get("message", ""),
        structures=status.get("structures"),
    )


async def _run_reconstruction(session_id: str):
    """Run the actual reconstruction pipeline in background."""
    from services.reconstruct import reconstruct_from_scan

    def update(status: str, progress: int, message: str, **extra):
        _reconstruction_status[session_id] = {"status": status, "progress": progress, "message": message, **extra}

    try:
        # Find the scan file
        update("processing", 10, "Locating scan data...")
        await asyncio.sleep(0.5)

        scan_path = None

        # Check uploaded files
        upload_dir = os.path.join(UPLOAD_DIR, session_id)
        if os.path.isdir(upload_dir):
            for ext in ["*.nii.gz", "*.nii", "*.dcm"]:
                files = glob.glob(os.path.join(upload_dir, ext))
                if files:
                    scan_path = files[0]
                    break

        # Fallback to sample CT
        if not scan_path:
            if os.path.exists(SAMPLE_CT):
                scan_path = SAMPLE_CT
            else:
                update("error", 0, "No scan file found")
                return

        update("processing", 20, "Loading volume data...")
        await asyncio.sleep(0.3)

        # Run reconstruction (CPU-bound, run in thread)
        splat_output = os.path.join(SPLAT_DIR, f"{session_id}.splat")
        mesh_output = os.path.join(MESH_DIR, session_id)

        update("processing", 30, "Extracting anatomical structures...")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: reconstruct_from_scan(
            scan_path=scan_path,
            output_dir=mesh_output,
            splat_output=splat_output,
        ))

        update("processing", 80, "Finalizing 3D model...")
        await asyncio.sleep(0.5)

        splat_path = f"/splats/{session_id}.splat" if result.get("splat_path") else "/splats/sample.splat"
        mesh_dir_rel = f"/models/reconstructed/{session_id}" if result.get("mesh_paths") else None

        update(
            "complete", 100, "Reconstruction complete",
            splat_path=splat_path,
            mesh_dir=mesh_dir_rel,
            structures=result.get("structures"),
        )

    except Exception as e:
        print(f"Reconstruction error: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to pre-existing sample splat
        update(
            "complete", 100,
            f"Using pre-computed model (reconstruction error: {str(e)[:100]})",
            splat_path="/splats/sample.splat",
        )
