"""
Server-side pose detection using MediaPipe Pose.

Decodes JPEG frames from the phone camera and extracts
33 body landmarks for skeleton overlay and organ mapping.
"""

import numpy as np
import cv2
import mediapipe as mp

# MediaPipe Pose connection pairs for skeleton drawing
POSE_CONNECTIONS = [
    # Torso
    (11, 12), (11, 23), (12, 24), (23, 24),
    # Right arm
    (12, 14), (14, 16),
    # Left arm
    (11, 13), (13, 15),
    # Right leg
    (24, 26), (26, 28),
    # Left leg
    (23, 25), (25, 27),
    # Shoulders to ears
    (11, 0), (12, 0),
]

LANDMARK_NAMES = {
    0: "nose",
    1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
    4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
    7: "left_ear", 8: "right_ear",
    9: "mouth_left", 10: "mouth_right",
    11: "left_shoulder", 12: "right_shoulder",
    13: "left_elbow", 14: "right_elbow",
    15: "left_wrist", 16: "right_wrist",
    17: "left_pinky", 18: "right_pinky",
    19: "left_index", 20: "right_index",
    21: "left_thumb", 22: "right_thumb",
    23: "left_hip", 24: "right_hip",
    25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle",
    29: "left_heel", 30: "right_heel",
    31: "left_foot_index", 32: "right_foot_index",
}


def _extract_pose_result(pose_landmarks, frame_w: int, frame_h: int) -> dict:
    """Extract landmarks, bbox, and connections from MediaPipe pose results."""
    landmarks = []
    for i, lm in enumerate(pose_landmarks.landmark):
        landmarks.append({
            "index": i,
            "name": LANDMARK_NAMES.get(i, f"landmark_{i}"),
            "x": lm.x,
            "y": lm.y,
            "z": lm.z,
            "visibility": lm.visibility,
        })

    visible = [lm for lm in landmarks if lm["visibility"] > 0.5]
    if visible:
        xs = [lm["x"] for lm in visible]
        ys = [lm["y"] for lm in visible]
        bbox = {
            "x_min": min(xs),
            "y_min": min(ys),
            "x_max": max(xs),
            "y_max": max(ys),
        }
    else:
        bbox = None

    return {
        "landmarks": landmarks,
        "connections": POSE_CONNECTIONS,
        "bbox": bbox,
        "frame_width": frame_w,
        "frame_height": frame_h,
    }


class PoseDetector:
    """Wraps MediaPipe Pose for server-side frame processing."""

    def __init__(self):
        self.pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def process_frame(self, jpeg_bytes: bytes) -> dict | None:
        """
        Decode a JPEG frame and run pose detection.

        Returns dict with landmarks, connections, bbox or None if no person detected.
        """
        nparr = np.frombuffer(jpeg_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return None

        frame_h, frame_w = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_frame)

        if not results.pose_landmarks:
            return None

        return _extract_pose_result(results.pose_landmarks, frame_w, frame_h)

    def process_ndarray(self, rgb_frame: np.ndarray) -> dict | None:
        """
        Run pose detection on a raw RGB numpy array.

        Used by LiveKit agent which receives raw video frames directly.
        """
        if rgb_frame is None or rgb_frame.size == 0:
            return None

        frame_h, frame_w = rgb_frame.shape[:2]
        results = self.pose.process(rgb_frame)

        if not results.pose_landmarks:
            return None

        return _extract_pose_result(results.pose_landmarks, frame_w, frame_h)

    def close(self):
        """Release MediaPipe resources."""
        self.pose.close()
