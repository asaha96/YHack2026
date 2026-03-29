"""
LiveKit Agent Worker for SurgiVision.

Runs as a separate process from the FastAPI server.
Joins LiveKit rooms, subscribes to phone video tracks,
processes frames with MediaPipe Pose, and sends pose/organ
data back via data channels. Also handles AI agent analysis
and TTS voice responses.

Usage:
    python livekit_agent.py dev
"""

import asyncio
import json
import logging
import time
import os
import sys
import numpy as np
from pathlib import Path

log = logging.getLogger("surgivision-agent")

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from livekit import agents, rtc, api
from livekit.agents import AgentServer, JobContext, AutoSubscribe

from services.pose import PoseDetector
from services.skeleton import compute_full_body_mapping, compute_2d_overlay_positions
from services.agent import analyze_live_pose
from services.tts import generate_speech

# Frame processing throttle
MIN_FRAME_INTERVAL = 1.0 / 12  # ~12 FPS max
AGENT_DEBOUNCE_SECONDS = 3.0
REQUIRED_LANDMARK_COUNT = 33
TTS_SAMPLE_RATE = 24000
TTS_CHUNK_SIZE = 480  # 20ms at 24kHz
FRAME_ERROR_LOG_INTERVAL = 5.0  # Log frame errors at most every 5s

server = AgentServer()


def _safe_create_task(coro) -> asyncio.Task:
    """Create an async task with error logging."""
    task = asyncio.create_task(coro)
    task.add_done_callback(_handle_task_exception)
    return task


def _handle_task_exception(task: asyncio.Task) -> None:
    """Log exceptions from fire-and-forget tasks."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc:
        log.error("Background task failed: %s", exc, exc_info=exc)


@server.rtc_session(agent_name="surgivision-agent")
async def entrypoint(ctx: JobContext):
    """Main agent entry point — called when a room needs an agent."""
    pose_detector = PoseDetector()
    agent_triggered = False

    # Shared mutable state — protected by lock for async safety
    state_lock = asyncio.Lock()
    state = {
        "last_frame_time": 0.0,
        "last_agent_time": 0.0,
        "last_pose_data": None,
        "gesture_context": [],
        "last_frame_error_time": 0.0,
    }

    # Audio source for TTS playback
    audio_source = rtc.AudioSource(sample_rate=TTS_SAMPLE_RATE, num_channels=1)
    audio_track = rtc.LocalAudioTrack.create_audio_track(
        "agent-audio", audio_source
    )

    async def process_video_track(track: rtc.Track):
        """Process incoming video frames from the phone camera."""
        nonlocal agent_triggered

        video_stream = rtc.VideoStream(track)

        async for event in video_stream:
            now = time.time()

            # Throttle frame processing
            async with state_lock:
                if now - state["last_frame_time"] < MIN_FRAME_INTERVAL:
                    continue
                state["last_frame_time"] = now

            frame = event.frame

            # Convert LiveKit VideoFrame to RGB numpy array
            try:
                buf = frame.convert(rtc.VideoBufferType.RGBA).data
                arr = np.frombuffer(buf, dtype=np.uint8)
                arr = arr.reshape((frame.height, frame.width, 4))
                rgb = arr[:, :, :3].copy()  # drop alpha, ensure contiguous
            except (ValueError, RuntimeError) as e:
                # Throttle error logging to avoid spam
                async with state_lock:
                    if now - state["last_frame_error_time"] > FRAME_ERROR_LOG_INTERVAL:
                        state["last_frame_error_time"] = now
                        log.warning("Frame conversion error: %s", e)
                continue

            # Run pose detection in thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            pose_result = await loop.run_in_executor(
                None, pose_detector.process_ndarray, rgb
            )

            if pose_result:
                landmarks = pose_result["landmarks"]

                # Validate landmark count before mapping
                if len(landmarks) < REQUIRED_LANDMARK_COUNT:
                    continue

                fw = pose_result["frame_width"]
                fh = pose_result["frame_height"]

                # Compute full body mapping
                body_mapping = compute_full_body_mapping(landmarks)
                overlay_2d = compute_2d_overlay_positions(landmarks, fw, fh)

                pose_payload = {
                    "type": "pose_update",
                    "landmarks": landmarks,
                    "connections": pose_result["connections"],
                    "bbox": pose_result["bbox"],
                    "organ_positions": body_mapping["organ_positions"],
                    "bone_positions": body_mapping["bone_positions"],
                    "muscle_positions": body_mapping["muscle_positions"],
                    "overlay_2d": overlay_2d,
                    "frame_width": fw,
                    "frame_height": fh,
                    "timestamp": now,
                }

                async with state_lock:
                    state["last_pose_data"] = pose_payload

                # Send pose data via lossy channel — low-latency matters more
                # than guaranteed delivery for real-time skeleton overlay
                await ctx.room.local_participant.publish_data(
                    payload=json.dumps(pose_payload),
                    reliable=False,
                    topic="pose_update",
                )

                # Auto-trigger agent on first detection
                if not agent_triggered:
                    agent_triggered = True
                    async with state_lock:
                        state["last_agent_time"] = now
                    _safe_create_task(
                        trigger_agent(ctx, pose_payload, audio_source)
                    )

            else:
                # No person detected
                await ctx.room.local_participant.publish_data(
                    payload=json.dumps({
                        "type": "pose_update",
                        "landmarks": None,
                        "detected": False,
                        "timestamp": now,
                    }),
                    reliable=False,
                    topic="pose_update",
                )

    # Event: track subscribed (phone publishes video)
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind == rtc.TrackKind.KIND_VIDEO:
            log.info("Subscribed to video track from %s", participant.identity)
            _safe_create_task(process_video_track(track))

    # Event: data received (laptop sends speech/requests/gestures)
    @ctx.room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket):
        # Schedule async handler to use the lock
        _safe_create_task(_handle_data(data_packet))

    async def _handle_data(data_packet: rtc.DataPacket):
        topic = data_packet.topic or ""

        try:
            text = data_packet.data.decode("utf-8")
            msg = json.loads(text)
        except (UnicodeDecodeError, json.JSONDecodeError):
            msg = {}

        async with state_lock:
            # Accumulate gesture context for agent analysis
            if topic == "gesture_action":
                gesture_type = msg.get("type", "unknown")
                organ = msg.get("organ", "unknown")
                state["gesture_context"].append(f"{gesture_type} on {organ}")
                # Keep only last 10 gestures
                state["gesture_context"] = state["gesture_context"][-10:]
                return

            if topic not in ("speech", "request_agent"):
                return
            if not state["last_pose_data"]:
                return

            now = time.time()
            if now - state["last_agent_time"] < AGENT_DEBOUNCE_SECONDS:
                return
            state["last_agent_time"] = now

            user_speech = msg.get("text") if topic == "speech" else None
            gesture_summary = "; ".join(state["gesture_context"][-5:]) if state["gesture_context"] else None
            pose_snapshot = state["last_pose_data"]
            state["gesture_context"] = []

        _safe_create_task(
            trigger_agent(ctx, pose_snapshot, audio_source, user_speech, gesture_summary)
        )

    # Connect to room (subscribe to video tracks only)
    await ctx.connect(auto_subscribe=AutoSubscribe.VIDEO_ONLY)

    # Publish audio track for TTS responses
    audio_options = rtc.TrackPublishOptions()
    audio_options.source = rtc.TrackSource.SOURCE_MICROPHONE
    await ctx.room.local_participant.publish_track(audio_track, audio_options)

    print(f"Agent joined room: {ctx.room.name}")


async def trigger_agent(
    ctx: JobContext,
    pose_data: dict,
    audio_source: rtc.AudioSource,
    user_speech: str | None = None,
    gesture_context: str | None = None,
) -> None:
    """Call the AI agent to generate anatomy labels and optionally speak."""
    organ_positions = pose_data.get("organ_positions", {})
    landmarks = pose_data.get("landmarks") or []
    visible = [
        lm["name"] for lm in landmarks
        if isinstance(lm, dict) and lm.get("visibility", 0) > 0.5
    ]

    # Combine user speech with gesture context
    combined_speech = user_speech or ""
    if gesture_context:
        combined_speech = f"{combined_speech} [Recent gestures: {gesture_context}]".strip()

    try:
        result = await analyze_live_pose(
            organ_positions=organ_positions,
            visible_landmarks=visible,
            user_speech=combined_speech if combined_speech else None,
        )

        # Send labels via reliable channel — annotations must arrive intact
        await ctx.room.local_participant.publish_data(
            payload=json.dumps({
                "type": "agent_labels",
                "labels": result.get("labels", []),
                "narration": result.get("narration", ""),
            }),
            reliable=True,
            topic="agent_labels",
        )

        # Generate TTS audio for narration
        narration = result.get("narration", "")
        if narration:
            await speak_narration(narration, audio_source)

    except (asyncio.TimeoutError, ValueError, KeyError) as e:
        log.error("Agent analysis failed: %s", e)
    except Exception as e:
        log.error("Unexpected agent error: %s", e, exc_info=True)


async def speak_narration(text: str, audio_source: rtc.AudioSource) -> None:
    """Convert narration text to speech and publish as audio frames."""
    try:
        audio_bio = await generate_speech(text)
        if not audio_bio:
            return
        audio_bytes = audio_bio.read()

        try:
            import io
            from pydub import AudioSegment

            audio_seg = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
            audio_seg = audio_seg.set_frame_rate(TTS_SAMPLE_RATE).set_channels(1).set_sample_width(2)
            pcm_data = np.frombuffer(audio_seg.raw_data, dtype=np.int16)

            for i in range(0, len(pcm_data), TTS_CHUNK_SIZE):
                chunk = pcm_data[i : i + TTS_CHUNK_SIZE]
                if len(chunk) < TTS_CHUNK_SIZE:
                    chunk = np.pad(chunk, (0, TTS_CHUNK_SIZE - len(chunk)))

                audio_frame = rtc.AudioFrame.create(TTS_SAMPLE_RATE, 1, TTS_CHUNK_SIZE)
                np.copyto(
                    np.frombuffer(audio_frame.data, dtype=np.int16),
                    chunk,
                )
                await audio_source.capture_frame(audio_frame)

        except ImportError:
            log.warning("pydub not installed, skipping TTS audio playback")

    except (OSError, ValueError) as e:
        log.error("TTS generation failed: %s", e)
    except Exception as e:
        log.error("Unexpected TTS error: %s", e, exc_info=True)


if __name__ == "__main__":
    agents.cli.run_app(server)
