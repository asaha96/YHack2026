from fastapi import APIRouter
from pydantic import BaseModel
from services.skeleton import compute_organ_positions, _reference_positions
from services.session import add_to_session

router = APIRouter()


class Keypoint(BaseModel):
    x: float
    y: float
    z: float = 0.0


class SkeletonRequest(BaseModel):
    session_id: str
    keypoints: list[Keypoint] = []


class OrganPosition(BaseModel):
    organ: str
    position: list[float]


class SkeletonResponse(BaseModel):
    organ_positions: dict[str, list[float]]
    organ_count: int
    skeleton_detected: bool


@router.post("/skeleton", response_model=SkeletonResponse)
async def process_skeleton(req: SkeletonRequest):
    """
    Receive body pose keypoints (from SnapLens or any pose detector).
    Returns organ positions mapped from the skeleton.
    """
    if req.keypoints and len(req.keypoints) >= 4:
        kps = [{"x": kp.x, "y": kp.y, "z": kp.z} for kp in req.keypoints]
        positions = compute_organ_positions(kps)
        detected = True
    else:
        positions = _reference_positions()
        detected = False

    add_to_session(req.session_id, {"type": "skeleton", "positions": positions, "detected": detected})

    return SkeletonResponse(
        organ_positions=positions,
        organ_count=len(positions),
        skeleton_detected=detected,
    )


@router.get("/skeleton/reference", response_model=SkeletonResponse)
async def get_reference():
    """Return default organ positions (no skeleton needed)."""
    positions = _reference_positions()
    return SkeletonResponse(
        organ_positions=positions,
        organ_count=len(positions),
        skeleton_detected=False,
    )
