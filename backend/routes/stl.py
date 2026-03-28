"""
STL generation and serving endpoints.

Converts the pre-existing CT scan data to STL files for 3D rendering.
Always uses the hardcoded sample data regardless of what the user uploaded.
"""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.reconstruct import load_volume, extract_structures, export_stl

router = APIRouter()

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
STL_OUTPUT_DIR = PROJECT_ROOT / "frontend" / "public" / "stl"

SCAN_PATH = DATA_DIR / "ct_scan.dcm"

# Structure colors for the frontend
STRUCTURE_COLORS = {
    "bone": "#f5f0e8",
    "contrast_tissue": "#c86464",
    "soft_tissue": "#cc7766",
}


class STLGenerateResponse(BaseModel):
    stl_urls: list[str]
    structures: list[dict]


@router.post("/stl/generate", response_model=STLGenerateResponse)
async def generate_stl():
    """Convert the pre-existing CT scan to STL files. Caches output."""
    # Check cache — if STL files already exist, return them
    if STL_OUTPUT_DIR.exists():
        existing = [f for f in STL_OUTPUT_DIR.iterdir() if f.suffix == ".stl"]
        if existing:
            stl_urls = [f"/stl/{f.name}" for f in sorted(existing)]
            structures = [
                {"name": f.stem, "color": STRUCTURE_COLORS.get(f.stem, "#cccccc")}
                for f in sorted(existing)
            ]
            return STLGenerateResponse(stl_urls=stl_urls, structures=structures)

    if not SCAN_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="CT scan not found at data/ct_scan.dcm",
        )

    scan_path = str(SCAN_PATH)

    # Run the pipeline
    try:
        print(f"Loading volume: {scan_path}")
        volume, affine = load_volume(scan_path)
        print(f"Volume shape: {volume.shape}, range: [{volume.min():.0f}, {volume.max():.0f}]")

        print("Extracting structures...")
        structures = extract_structures(volume, affine)

        if not structures:
            raise RuntimeError("No structures extracted from scan")

        print("Exporting STL files...")
        stl_paths = export_stl(structures, str(STL_OUTPUT_DIR))

        stl_urls = [f"/stl/{Path(p).name}" for p in stl_paths]
        structure_info = [
            {
                "name": s["name"],
                "color": STRUCTURE_COLORS.get(s["name"], "#cccccc"),
                "vertex_count": s["vertex_count"],
                "face_count": s["face_count"],
            }
            for s in structures
        ]

        return STLGenerateResponse(stl_urls=stl_urls, structures=structure_info)

    except Exception as e:
        print(f"STL generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"STL generation failed: {e}")


@router.get("/stl/{filename}")
async def serve_stl(filename: str):
    """Serve a generated STL file."""
    filepath = STL_OUTPUT_DIR / filename
    if not filepath.exists() or not filepath.suffix == ".stl":
        raise HTTPException(status_code=404, detail="STL file not found")
    return FileResponse(
        str(filepath),
        media_type="application/octet-stream",
        filename=filename,
    )
