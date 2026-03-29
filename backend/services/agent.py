import os
import json
from typing import Any

from services.llm import chat_completions

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
  "modifications": [{"type": "incision|highlight|label|zone|heatmap|measurement|corridor", "coordinates": [[x,y,z]], "color": "string", "label": "string", "delay_ms": number, "duration_ms": number, "animation": "draw|pulse|fade"}],
  "recommendations": ["string"]
}

## Modification Types

**Standard types:**
- `incision` — line drawn along coordinates. Use animation: "draw".
- `highlight` — glowing sphere at a point. Use animation: "pulse".
- `label` — text label at a point. Use animation: "fade".
- `zone` — transparent sphere marking a region.

**Measurement type** — shows distance between two structures:
- Provide exactly 2 coordinates (start and end points).
- Include `"distance_mm": number` with the measured distance.
- Label should describe what's being measured (e.g. "Portal vein → incision margin").
- Use this for every high-severity risk to visualize clearance margins.

**Corridor type** — shows surgical approach path with risk gradient:
- Provide 4-6 coordinates defining the approach path from entry to target.
- Include `"risk_gradient": [0.1, 0.3, 0.7, 0.9]` — array of 0-1 scores (one per coordinate) indicating risk level along the path (0=safe green, 1=dangerous red).
- Use this when the surgeon traces an incision or asks about an approach vector.

**Scenario grouping** — for comparing alternative approaches:
- When the surgeon asks "what if" or about alternatives, add `"scenario": "snake_case_name"` and `"scenario_label": "Human Readable Name"` to each modification.
- Group all modifications for one approach under the same scenario name.
- Default scenario (when not comparing) is `"primary_plan"`.

For modifications, use delay_ms to stagger when each annotation appears (synced with your narration timing). The first annotation should appear at delay_ms: 500, and subsequent ones spaced ~2000ms apart. Use animation: "draw" for lines and measurements, "pulse" for highlights and zones, "fade" for labels and corridors.

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


def _parse_json_response(text: str) -> dict:
    """Best-effort JSON object from model output; never raises.

    Models may emit chain-of-thought then a final JSON block. Prefer the last
    top-level object that includes ``narration`` (schema match).
    """
    text = (text or "").strip()
    if not text:
        return {}
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    dec = json.JSONDecoder()
    candidates: list[dict[str, Any]] = []
    i, n = 0, len(text)
    while i < n:
        if text[i] != "{":
            i += 1
            continue
        try:
            obj, end = dec.raw_decode(text, i)
            if isinstance(obj, dict):
                candidates.append(obj)
            i = end
        except json.JSONDecodeError:
            i += 1
    for obj in reversed(candidates):
        if "narration" in obj:
            return obj
    return candidates[-1] if candidates else {}


def _normalize_agent_response(result: dict[str, Any]) -> dict[str, Any]:
    """Ensure Pydantic ChatResponse / ActionResponse always get valid shapes."""
    def list_of_dicts(key: str) -> list[dict]:
        v = result.get(key, [])
        if not isinstance(v, list):
            return []
        return [x for x in v if isinstance(x, dict)]

    recs = result.get("recommendations", [])
    if not isinstance(recs, list):
        recs = []
    recs = [str(x) for x in recs]

    narr = result.get("narration", "")
    if narr is None:
        narr = ""
    if not isinstance(narr, str):
        narr = str(narr)

    return {
        "narration": narr,
        "risks": list_of_dicts("risks"),
        "modifications": list_of_dicts("modifications"),
        "recommendations": recs,
    }


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
            prev = last.get("response") or {}
            narr = prev.get("narration")
            if isinstance(narr, str) and narr.strip():
                snippet = narr[:200]
                history_context = (
                    f"\nContext from last interaction: {json.dumps(snippet)}\n"
                )

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

    text = await chat_completions(messages, max_completion_tokens=2000)
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

    text = await chat_completions(messages, max_completion_tokens=800)
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

    text = await chat_completions(messages, max_completion_tokens=1500)
    result = _parse_json_response(text)

    if not result:
        result = {
            "narration": text,
            "risks": [],
            "modifications": [],
            "recommendations": [],
        }

    return _normalize_agent_response(result)
