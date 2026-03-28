import os
import base64
from io import BytesIO
from typing import Any, Union, Optional

_model = None
_processor = None
_tokenizer = None


def _lazy_load():
    """Lazy load BiomedCLIP to avoid slow startup."""
    global _model, _processor, _tokenizer

    if _model is not None:
        return

    try:
        import torch
        from open_clip import create_model_from_pretrained, get_tokenizer

        model, processor = create_model_from_pretrained(
            "hf-hub:microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224"
        )
        tokenizer = get_tokenizer(
            "hf-hub:microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224"
        )

        model.eval()
        _model = model
        _processor = processor
        _tokenizer = tokenizer
        print("BiomedCLIP loaded successfully")
    except Exception as e:
        print(f"BiomedCLIP not available: {e}")
        print("Falling back to LLM-based semantic querying")


async def semantic_query(
    query_text: str,
    image_base64: Optional[str] = None,
    organ_metadata: Optional[dict[str, Any]] = None,
) -> dict:
    """
    Process a semantic query about the anatomy.
    Uses BiomedCLIP if available, otherwise falls back to LLM reasoning.
    """
    _lazy_load()

    if _model is not None and image_base64:
        return await _biomedclip_query(query_text, image_base64)
    else:
        return await _llm_fallback_query(query_text, organ_metadata)


async def _biomedclip_query(query_text: str, image_base64: str) -> dict:
    """Use BiomedCLIP to compute similarity between query and image regions."""
    import torch
    from PIL import Image

    # Decode image
    image_data = base64.b64decode(image_base64)
    image = Image.open(BytesIO(image_data)).convert("RGB")

    # Process image and text
    image_input = _processor(image).unsqueeze(0)
    text_input = _tokenizer([query_text])

    with torch.no_grad():
        image_features = _model.encode_image(image_input)
        text_features = _model.encode_text(text_input)

        # Compute similarity
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        similarity = (image_features @ text_features.T).item()

    # Generate regions based on similarity score and query context
    # For a real implementation, we'd use attention maps / GradCAM
    # For hackathon, we map high similarity to known anatomical regions
    regions = _map_query_to_regions(query_text, similarity)

    return {
        "method": "biomedclip",
        "similarity_score": round(similarity, 4),
        "regions": regions,
        "explanation": f"BiomedCLIP similarity: {similarity:.2%}. Identified {len(regions)} relevant regions.",
    }


async def _llm_fallback_query(
    query_text: str, organ_metadata: Optional[dict[str, Any]]
) -> dict:
    """Use Groq LLM to reason about the query based on known anatomy."""
    import json
    import httpx

    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

    organ_context = ""
    if organ_metadata:
        organ_context = f"\nKnown organs and positions: {json.dumps(organ_metadata)}"

    message = f"""Given this semantic query about a 3D anatomical model:

Query: "{query_text}"
{organ_context}

Identify the most relevant anatomical regions and return as JSON:
{{
  "regions": [
    {{"center": [x, y, z], "radius": 0.3, "score": 0.0-1.0, "label": "region name"}}
  ],
  "explanation": "Brief explanation of findings"
}}

Use realistic 3D coordinates based on standard abdominal anatomy positioning.
Score represents relevance (1.0 = most relevant)."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [{"role": "user", "content": message}],
                "temperature": 0.5,
                "max_completion_tokens": 800,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"]

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            result = json.loads(text[start:end])
        else:
            result = {"regions": [], "explanation": text}

    return {
        "method": "llm_reasoning",
        "similarity_score": None,
        "regions": result.get("regions", []),
        "explanation": result.get("explanation", ""),
    }


def _map_query_to_regions(query: str, similarity: float) -> list[dict]:
    """Map a text query + similarity score to known anatomical regions."""
    query_lower = query.lower()

    # Known anatomical regions with approximate positions
    all_regions = {
        "vascular": [
            {"center": [0.0, 0.0, -0.5], "radius": 0.3, "label": "Aorta"},
            {"center": [0.15, 0.3, 0.0], "radius": 0.2, "label": "Portal Vein"},
        ],
        "hepatic": [
            {"center": [0.0, 0.5, 0.2], "radius": 0.5, "label": "Liver"},
        ],
        "renal": [
            {"center": [-0.8, -0.2, -0.3], "radius": 0.25, "label": "Left Kidney"},
            {"center": [0.8, -0.2, -0.3], "radius": 0.25, "label": "Right Kidney"},
        ],
        "digestive": [
            {"center": [-0.3, 0.8, 0.5], "radius": 0.3, "label": "Stomach"},
            {"center": [0.0, -0.1, -0.1], "radius": 0.3, "label": "Pancreas"},
        ],
    }

    matched_regions = []
    for category, regions in all_regions.items():
        relevance = 0.3  # base relevance
        if category in query_lower or any(
            r["label"].lower() in query_lower for r in regions
        ):
            relevance = 0.9
        elif "density" in query_lower and category == "vascular":
            relevance = 0.85
        elif "blood" in query_lower and category == "vascular":
            relevance = 0.9

        for region in regions:
            matched_regions.append(
                {**region, "score": round(relevance * similarity, 3)}
            )

    # Sort by score descending
    matched_regions.sort(key=lambda r: r["score"], reverse=True)
    return matched_regions[:5]
