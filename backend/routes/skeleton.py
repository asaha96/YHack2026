import base64
import io
from fastapi import APIRouter
from pydantic import BaseModel
from services.skeleton import compute_organ_positions, _reference_positions
from services.session import add_to_session

router = APIRouter()

# In-memory store for latest skeleton data per session (frontend polls this)
_latest_skeleton: dict[str, dict] = {}


class Keypoint(BaseModel):
    x: float
    y: float
    z: float = 0.0


class SkeletonRequest(BaseModel):
    session_id: str
    keypoints: list[Keypoint] = []


class FrameRequest(BaseModel):
    session_id: str
    frame_base64: str


class SkeletonResponse(BaseModel):
    organ_positions: dict[str, list[float]]
    organ_count: int
    skeleton_detected: bool


@router.post("/skeleton", response_model=SkeletonResponse)
async def process_skeleton(req: SkeletonRequest):
    if req.keypoints and len(req.keypoints) >= 4:
        kps = [{"x": kp.x, "y": kp.y, "z": kp.z} for kp in req.keypoints]
        positions = compute_organ_positions(kps)
        detected = True
    else:
        positions = _reference_positions()
        detected = False

    result = {"organ_positions": positions, "organ_count": len(positions), "skeleton_detected": detected}
    _latest_skeleton[req.session_id] = result
    add_to_session(req.session_id, {"type": "skeleton", "positions": positions, "detected": detected})

    return SkeletonResponse(**result)


@router.post("/skeleton/frame")
async def process_frame(req: FrameRequest):
    """
    Receive a camera frame from mobile, run pose detection, store skeleton.
    The frontend polls /skeleton/latest/{session_id} to get the result.
    """
    try:
        # Try to use MediaPipe Pose for skeleton detection
        keypoints = _detect_pose_from_frame(req.frame_base64)

        if keypoints and len(keypoints) >= 4:
            positions = compute_organ_positions(keypoints)
            detected = True
        else:
            positions = _reference_positions()
            detected = False

        result = {"organ_positions": positions, "organ_count": len(positions), "skeleton_detected": detected}
        _latest_skeleton[req.session_id] = result

        return {"status": "ok", "detected": detected, "keypoint_count": len(keypoints) if keypoints else 0}

    except Exception as e:
        # Fallback — store reference positions
        positions = _reference_positions()
        _latest_skeleton[req.session_id] = {"organ_positions": positions, "organ_count": len(positions), "skeleton_detected": False}
        return {"status": "fallback", "error": str(e)}


@router.get("/skeleton/latest/{session_id}", response_model=SkeletonResponse)
async def get_latest(session_id: str):
    """Frontend polls this to get the latest skeleton/organ positions."""
    if session_id in _latest_skeleton:
        return SkeletonResponse(**_latest_skeleton[session_id])
    positions = _reference_positions()
    return SkeletonResponse(organ_positions=positions, organ_count=len(positions), skeleton_detected=False)


@router.get("/skeleton/reference", response_model=SkeletonResponse)
async def get_reference():
    positions = _reference_positions()
    return SkeletonResponse(organ_positions=positions, organ_count=len(positions), skeleton_detected=False)


def _detect_pose_from_frame(frame_b64: str) -> list[dict] | None:
    """Detect body pose from a base64 JPEG frame using MediaPipe or OpenCV."""
    try:
        import cv2
        import numpy as np

        # Decode image
        img_bytes = base64.b64decode(frame_b64)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if frame is None:
            return None

        h, w = frame.shape[:2]

        # Try MediaPipe Pose
        try:
            import mediapipe as mp
            mp_pose = mp.solutions.pose
            with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
                results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if results.pose_landmarks:
                    return [
                        {"x": lm.x, "y": lm.y, "z": lm.z}
                        for lm in results.pose_landmarks.landmark
                    ]
        except ImportError:
            pass

        # Fallback: simple skin/contour detection for body center
        # Convert to HSV, find largest skin-colored blob
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([0, 30, 60]), np.array([25, 180, 255]))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            largest = max(contours, key=cv2.contourArea)
            x, y, cw, ch = cv2.boundingRect(largest)
            # Estimate skeleton from bounding box
            return [
                {"x": 0.0, "y": 0.0, "z": 0.0},  # nose (placeholder)
                *[{"x": 0.0, "y": 0.0, "z": 0.0}] * 10,  # landmarks 1-10
                {"x": (x + cw * 0.25) / w, "y": (y + ch * 0.15) / h, "z": 0.0},  # left shoulder
                {"x": (x + cw * 0.75) / w, "y": (y + ch * 0.15) / h, "z": 0.0},  # right shoulder
                *[{"x": 0.0, "y": 0.0, "z": 0.0}] * 10,  # landmarks 13-22
                {"x": (x + cw * 0.35) / w, "y": (y + ch * 0.55) / h, "z": 0.0},  # left hip
                {"x": (x + cw * 0.65) / w, "y": (y + ch * 0.55) / h, "z": 0.0},  # right hip
            ]

        return None

    except Exception:
        return None
