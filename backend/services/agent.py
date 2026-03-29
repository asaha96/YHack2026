import os
import json
from typing import Any
import httpx

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _get_groq_key() -> str:
    return os.getenv("GROQ_API_KEY", "")

SYSTEM_PROMPT = """You are a surgical simulation assistant — like Jarvis for surgery. A surgeon has uploaded their patient's CT/MRI scan, which has been reconstructed into a 3D Gaussian splat model of the patient's exact interior anatomy. The surgeon is now practicing the procedure on this patient-specific 3D model using hand-tracked gestures.

Your role: guide them through the surgery simulation like a senior attending surgeon standing next to a resident. When they interact with the model (selecting structures, tracing incisions, retracting tissue), you analyze the patient's specific anatomy and provide:

1. **Narration**: A calm, authoritative explanation of what the action means surgically — as if you're a senior surgeon mentoring a resident. Speak naturally, referencing specific anatomical structures.

2. **Risks**: Identify structures at risk (vessels, nerves, ducts) with proximity measurements where relevant. Rate each risk as low/medium/high.

3. **Modifications**: Describe visual changes that should appear on the 3D model (incision lines, exposed layers, highlighted danger zones). Use structured format with type, location, color, and label.

4. **Recommendations**: Suggest next steps, alternative approaches, or things to watch for.

Always respond in valid JSON with this exact structure:
{
  "narration": "string - spoken explanation",
  "risks": [{"structure": "string", "distance_mm": number, "severity": "low|medium|high", "note": "string"}],
  "modifications": [{"type": "incision|highlight|label|zone", "coordinates": [[x,y,z]], "color": "string", "label": "string", "delay_ms": number, "duration_ms": number, "animation": "draw|pulse|fade"}],
  "recommendations": ["string"]
}

For modifications, use delay_ms to stagger when each annotation appears (synced with your narration timing). The first annotation should appear at delay_ms: 500, and subsequent ones spaced ~2000ms apart. Use animation: "draw" for lines, "pulse" for highlights and zones, "fade" for labels.

Be specific about anatomy. Reference real structures (portal vein, hepatic artery, common bile duct, etc). Keep narration under 200 words — concise but thorough."""


def _build_action_message(
    action_type: str,
    coordinates: list[list[float]],
    surface: str,
    description: str,
    history: list[dict],
) -> str:
    history_summary = ""
    if history:
        history_summary = f"\n\nPrevious actions in this session ({len(history)} total):\n"
        for i, entry in enumerate(history[-5:], 1):
            if "action" in entry:
                a = entry["action"]
                history_summary += f"  {i}. {a['action_type']} on {a['surface']}\n"

    coord_str = ", ".join([f"[{c[0]:.1f}, {c[1]:.1f}, {c[2]:.1f}]" for c in coordinates])

    return f"""The surgeon has performed the following action on the 3D anatomical model:

Action type: {action_type}
Target surface/organ: {surface}
Coordinates (3D): {coord_str}
{f'Additional context from surgeon: {description}' if description else ''}
{history_summary}

Analyze this action and provide your surgical planning assessment."""


async def _call_groq(messages: list[dict], max_tokens: int = 1500) -> str:
    import asyncio

    for attempt in range(3):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {_get_groq_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_completion_tokens": max_tokens,
                },
                timeout=30.0,
            )
            if response.status_code == 429:
                wait = 2 ** attempt + 1
                print(f"Groq rate limited, retrying in {wait}s (attempt {attempt + 1}/3)")
                await asyncio.sleep(wait)
                continue
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    raise Exception("Groq API rate limited after 3 retries. Wait a moment and try again.")


def _parse_json_response(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])
        return {}


async def process_action(
    session: list[dict[str, Any]],
    action_type: str,
    coordinates: list[list[float]],
    surface: str,
    description: str = "",
) -> dict:
    user_message = _build_action_message(action_type, coordinates, surface, description, session)
    return await _call_agent(user_message, session)


async def process_chat(session: list[dict[str, Any]], message: str) -> dict:
    history_context = ""
    if session:
        last = session[-1]
        if "response" in last:
            history_context = f"\nContext from last interaction: {json.dumps(last['response']['narration'][:200])}\n"

    user_message = f"""The surgeon asks a follow-up question during the planning session:

"{message}"
{history_context}
Respond with your surgical planning assessment in the required JSON format."""

    return await _call_agent(user_message, session)


async def generate_summary(session: list[dict[str, Any]]) -> dict:
    transcript = ""
    for i, entry in enumerate(session, 1):
        if "action" in entry:
            a = entry["action"]
            narration = entry.get("response", {}).get("narration", "")
            transcript += f"\n{i}. [ACTION] {a['action_type']} on {a['surface']}"
            if narration:
                transcript += f"\n   Agent: {narration}"
        elif "chat" in entry:
            transcript += f"\n{i}. [CHAT] User: {entry['chat']}"
            narration = entry.get("response", {}).get("narration", "")
            if narration:
                transcript += f"\n   Agent: {narration}"
        elif entry.get("type") == "guide":
            data = entry.get("data", {})
            narration = data.get("narration", "")
            if narration:
                transcript += f"\n{i}. [GUIDE] Agent: {narration}"

    message = f"""Generate a comprehensive surgical planning summary for this session.

Session contained {len(session)} interactions:{transcript}

Provide the summary as JSON:
{{
  "approach": "string - recommended surgical approach",
  "risk_inventory": [{{"structure": "string", "severity": "string", "mitigation": "string"}}],
  "scenarios_explored": [{{"description": "string", "outcome": "string"}}],
  "contingencies": ["string"],
  "full_text": "string - complete narrative summary suitable for a pre-op briefing document"
}}"""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message},
    ]

    text = await _call_groq(messages, max_tokens=2000)
    result = _parse_json_response(text)

    return {
        "approach": result.get("approach", text),
        "risk_inventory": result.get("risk_inventory", []),
        "scenarios_explored": result.get("scenarios_explored", []),
        "contingencies": result.get("contingencies", []),
        "full_text": result.get("full_text", text),
    }


LIVE_ANATOMY_PROMPT = """You are an anatomy education assistant. A person is standing in front of a camera, and their body pose has been detected using computer vision. Based on the detected body landmarks and computed organ positions, provide educational labels and explanations about their anatomy.

When the user speaks or asks a question, respond with relevant anatomical labels positioned on their body. Focus on the areas they mention or that are most visible.

Respond in valid JSON:
{
  "labels": [
    {"organ": "string - organ name matching the organ_positions keys", "text": "string - short 2-4 word label", "detail": "string - 1-sentence educational explanation"}
  ],
  "narration": "string - brief 1-2 sentence educational narration about the visible anatomy"
}

Include 3-6 labels. Focus on major organs and structures that would be visible given the person's pose. If the user asked a specific question, focus labels on the relevant area."""


async def analyze_live_pose(
    organ_positions: dict[str, list[float]],
    visible_landmarks: list[str],
    user_speech: str | None = None,
) -> dict:
    """Generate educational anatomy labels based on detected pose."""
    organs_str = ", ".join(organ_positions.keys())
    landmarks_str = ", ".join(visible_landmarks[:15])

    user_message = f"""Detected body landmarks: {landmarks_str}

Available organ positions: {organs_str}

{f'The person said: "{user_speech}"' if user_speech else 'Generate initial anatomy labels for the visible body.'}

Provide educational anatomy labels for overlay on the video feed."""

    messages = [
        {"role": "system", "content": LIVE_ANATOMY_PROMPT},
        {"role": "user", "content": user_message},
    ]

    text = await _call_groq(messages, max_tokens=800)
    result = _parse_json_response(text)

    return {
        "labels": result.get("labels", []),
        "narration": result.get("narration", ""),
    }


async def _call_agent(user_message: str, session: list[dict]) -> dict:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for entry in session[-5:]:
        if "action" in entry:
            a = entry["action"]
            messages.append({"role": "user", "content": f"{a['action_type']} on {a['surface']}"})
        if "chat" in entry:
            messages.append({"role": "user", "content": entry["chat"]})
        if "response" in entry:
            messages.append({"role": "assistant", "content": json.dumps(entry["response"])})

    messages.append({"role": "user", "content": user_message})

    text = await _call_groq(messages)
    result = _parse_json_response(text)

    if not result:
        result = {
            "narration": text,
            "risks": [],
            "modifications": [],
            "recommendations": [],
        }

    return {
        "narration": result.get("narration", ""),
        "risks": result.get("risks", []),
        "modifications": result.get("modifications", []),
        "recommendations": result.get("recommendations", []),
    }
