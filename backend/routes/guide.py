"""
AI Guide endpoint: receives the current view state (visible organs, selected structure,
existing annotations) and returns contextual narration + new annotations.

The agent dynamically understands what's on screen and leads the surgeon through.
"""

import json
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from services.agent import _parse_json_response
from services.llm import KimiAPIError, chat_completions
from services.session import add_to_session

_log = logging.getLogger(__name__)

router = APIRouter()

GUIDE_PROMPT = """You are an AI surgical guide actively leading a surgeon through an anatomy simulation. You can SEE what's currently on screen.

CURRENT VIEW STATE:
- Visible layers: {visible_layers}
- Selected structure: {selected}
- Existing annotations on screen: {annotations}
- Camera region: {camera_region}

Your job: Look at what's on screen and LEAD the surgeon. Don't wait for them to ask — proactively guide them.

If they just selected a structure → explain what it is, what's nearby, what to watch for.
If annotations are showing → build on them, point to the next important thing.
If nothing is selected → suggest where to look first and why.

Respond with JSON:
{{
  "narration": "What you say out loud to the surgeon (2-3 sentences, direct, clinical)",
  "new_annotations": [
    {{
      "label": "short label",
      "type": "danger|action|info",
      "position": [x, y, z],
      "narration": "why this annotation matters"
    }}
  ],
  "next_focus": "what the surgeon should look at next"
}}

Be specific. Reference real anatomy. Lead them step by step. Coordinates should be in range: x: -200 to 200, y: -200 to -50, z: 800 to 1300."""


class GuideRequest(BaseModel):
    session_id: str
    visible_layers: list[str] = ["organs", "vascular", "skeleton"]
    selected_structure: str | None = None
    existing_annotations: list[dict] = []
    camera_region: str = "abdominal overview"


class GuideResponse(BaseModel):
    narration: str
    new_annotations: list[dict]
    next_focus: str


@router.post("/guide", response_model=GuideResponse)
async def get_guidance(req: GuideRequest):
    prompt = GUIDE_PROMPT.format(
        visible_layers=", ".join(req.visible_layers),
        selected=req.selected_structure or "nothing selected",
        annotations=json.dumps(req.existing_annotations[:5]) if req.existing_annotations else "none yet",
        camera_region=req.camera_region,
    )

    try:
        messages = [{"role": "user", "content": prompt}]
        response = await chat_completions(messages, max_completion_tokens=800)

        text = response.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]

        result = _parse_json_response(text)
        if not result:
            result = {"narration": text, "new_annotations": [], "next_focus": ""}

        # Add camera positions to annotations
        for ann in result.get("new_annotations", []) or []:
            if not isinstance(ann, dict):
                continue
            pos = ann.get("position", [0, -100, 1000])
            ann["camera_position"] = [pos[0] + 150, pos[1] + 50, pos[2] + 200]
            ann["camera_target"] = pos

        add_to_session(req.session_id, {"type": "guide", "data": result})

        return GuideResponse(
            narration=str(result.get("narration", "") or ""),
            new_annotations=[x for x in (result.get("new_annotations") or []) if isinstance(x, dict)],
            next_focus=str(result.get("next_focus", "") or ""),
        )

    except KimiAPIError:
        raise
    except Exception as e:
        _log.exception("guide: unexpected error after LLM call")
        return GuideResponse(
            narration="Could not parse the guide response. Please try again.",
            new_annotations=[],
            next_focus="",
        )
