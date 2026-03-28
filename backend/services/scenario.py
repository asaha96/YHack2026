"""
Trauma scenario simulation service.
Generates 3 ranked intervention plans given scene context and patient assessment.
"""

import os
import json
from typing import Any
import httpx


def _get_groq_key() -> str:
    return os.getenv("GROQ_API_KEY", "")


SCENE_ANALYSIS_PROMPT = """You are a field trauma assessment AI. Analyze this emergency scene photo.
Identify and return JSON:
{
  "terrain": "road|building|wilderness|vehicle|industrial|residential",
  "hazards": ["list of visible hazards"],
  "equipment_visible": ["any medical equipment visible"],
  "people_count": number,
  "lighting": "daylight|dusk|night|indoor",
  "vehicles": ["types of vehicles visible"],
  "notes": "any other relevant observations"
}"""


INJURY_PARSE_PROMPT = """Parse this paramedic's verbal injury assessment into structured data. Return JSON:
{
  "injuries": [
    {"location": "body part", "type": "fracture|laceration|burn|crush|internal|head|spinal", "severity": "minor|moderate|critical"}
  ],
  "consciousness": "alert|verbal|pain|unresponsive",
  "age_estimate": "string",
  "mechanism": "how the injury occurred",
  "vitals_mentioned": {"pulse": "if mentioned", "breathing": "if mentioned", "bp": "if mentioned"},
  "summary": "one-line summary of patient state"
}"""


SCENARIO_PROMPT = """You are an emergency medicine AI advising a field paramedic. You must generate exactly 3 intervention plans ranked by estimated survival probability.

SCENE CONTEXT:
{scene_context}

PATIENT ASSESSMENT:
{patient_context}

AVAILABLE EQUIPMENT: {equipment}
RESPONDERS ON SCENE: {responders}
DISTANCE TO HOSPITAL: {hospital_distance}

Generate 3 plans as JSON array. Each plan must be immediately actionable with the equipment available in this environment. Be specific — not "apply pressure" but "apply direct pressure to the right femoral wound using gauze from the trauma kit, maintain for 3 minutes minimum."

Return exactly:
[
  {{
    "name": "short plan name",
    "survival_probability": number 0-100,
    "time_estimate_min": number,
    "steps": [
      {{"order": 1, "action": "specific action", "duration_sec": number, "critical": boolean, "warning": "optional warning"}}
    ],
    "equipment_needed": ["list"],
    "risks": ["what could go wrong"],
    "rationale": "why this approach in 1-2 sentences"
  }}
]

Rank by survival_probability descending. Be realistic — field conditions, limited equipment, no OR."""


async def analyze_scene(image_base64: str | None, form_data: dict) -> dict:
    """Analyze scene from photo + form data."""
    if image_base64:
        try:
            return await _analyze_scene_photo(image_base64, form_data)
        except Exception as e:
            print(f"Scene photo analysis failed: {e}, using form data only")

    # Form-only fallback
    return {
        "terrain": form_data.get("location_type", "unknown"),
        "hazards": form_data.get("hazards", []),
        "equipment_visible": [],
        "people_count": form_data.get("responders", 1),
        "lighting": form_data.get("weather", "daylight"),
        "vehicles": [],
        "notes": "",
        **form_data,
    }


async def _analyze_scene_photo(image_base64: str, form_data: dict) -> dict:
    """Use Groq Vision to analyze scene photo."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {_get_groq_key()}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [
                    {"role": "system", "content": SCENE_ANALYSIS_PROMPT},
                    {"role": "user", "content": [
                        {"type": "text", "text": f"Additional context from responder: {json.dumps(form_data)}"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                    ]},
                ],
                "temperature": 0.3,
                "max_completion_tokens": 500,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"]
        result = _parse_json(text)
        # Merge form data as overrides
        result.update({k: v for k, v in form_data.items() if v})
        return result


async def parse_injuries(transcript: str) -> dict:
    """Parse voice transcript into structured injury data."""
    import asyncio

    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {_get_groq_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                    "messages": [
                        {"role": "system", "content": INJURY_PARSE_PROMPT},
                        {"role": "user", "content": transcript},
                    ],
                    "temperature": 0.2,
                    "max_completion_tokens": 600,
                },
                timeout=20.0,
            )
            if response.status_code == 429:
                await asyncio.sleep(2 ** attempt + 1)
                continue
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"]
            return _parse_json(text)

    return {"injuries": [], "consciousness": "unknown", "summary": transcript}


async def generate_scenarios(
    scene_context: dict,
    patient_assessment: dict,
    equipment: list[str],
    responders: int,
    hospital_distance: str,
) -> list[dict]:
    """Generate 3 ranked intervention scenarios."""
    import asyncio

    prompt = SCENARIO_PROMPT.format(
        scene_context=json.dumps(scene_context, indent=2),
        patient_context=json.dumps(patient_assessment, indent=2),
        equipment=", ".join(equipment) if equipment else "basic first aid kit",
        responders=responders,
        hospital_distance=hospital_distance,
    )

    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {_get_groq_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                    "max_completion_tokens": 2000,
                },
                timeout=30.0,
            )
            if response.status_code == 429:
                await asyncio.sleep(2 ** attempt + 1)
                continue
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"]
            scenarios = _parse_json(text)

            if isinstance(scenarios, list):
                return sorted(scenarios, key=lambda s: s.get("survival_probability", 0), reverse=True)
            if isinstance(scenarios, dict) and "scenarios" in scenarios:
                return sorted(scenarios["scenarios"], key=lambda s: s.get("survival_probability", 0), reverse=True)

            return scenarios if isinstance(scenarios, list) else []

    return []


def _parse_json(text: str) -> Any:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Find first [ or {
        for i, c in enumerate(text):
            if c in "[{":
                end_char = "]" if c == "[" else "}"
                depth = 0
                for j in range(i, len(text)):
                    if text[j] == c:
                        depth += 1
                    elif text[j] == end_char:
                        depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[i:j+1])
                        except json.JSONDecodeError:
                            break
                break
        return {"raw": text}
