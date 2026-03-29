import logging

from fastapi import FastAPI
from fastapi.exceptions import ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
from dotenv import load_dotenv

from services.llm import KimiAPIError

_log = logging.getLogger("uvicorn.error")

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Praxis API", version="0.1.0")


@app.exception_handler(KimiAPIError)
async def kimi_api_error_handler(_request, exc: KimiAPIError):
    hint = None
    if exc.upstream_status == 401:
        hint = (
            "Bearer token rejected. In .env set K2_API_KEY=IFM-... with no quotes, "
            "no spaces around =, then restart the API process so .env reloads. "
            "Confirm the key is active in the K2 Think dashboard. "
            "URL should be KIMI_BASE_URL=https://api.k2think.ai/v1"
        )
    elif exc.upstream_status == 404:
        hint = "Unknown model — check KIMI_MODEL (default MBZUAI-IFM/K2-Think-v2)."
    elif exc.upstream_status == 503:
        hint = (
            "Could not connect to the inference server. Check KIMI_BASE_URL, firewall, "
            "and that you are online. For K2 Think use https://api.k2think.ai/v1"
        )

    body: dict = {
        "detail": exc.detail[:2000],
        "upstream_status": exc.upstream_status,
    }
    if hint:
        body["hint"] = hint
    # Network / unreachable upstream → 503; auth and upstream HTTP errors → 502
    status = 503 if exc.upstream_status == 503 else 502
    return JSONResponse(status_code=status, content=body)


@app.exception_handler(ResponseValidationError)
async def response_validation_handler(_request, exc: ResponseValidationError):
    """LLM output did not match response_model (common when the model returns extra types)."""
    _log.warning("Response validation failed: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "type": "ResponseValidationError",
            "detail": str(exc)[:4000],
            "hint": "The inference API returned content that failed Pydantic checks; "
            "see detail. Often risks/modifications need to be a list of objects.",
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


from routes.action import router as action_router
from routes.chat import router as chat_router
from routes.narrate import router as narrate_router
from routes.summary import router as summary_router
from routes.query import router as query_router
from routes.upload import router as upload_router
from routes.reconstruct import router as reconstruct_router
from routes.poi import router as poi_router
from routes.skeleton import router as skeleton_router
from routes.guide import router as guide_router
from routes.livekit_token import router as livekit_router

app.include_router(action_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(narrate_router, prefix="/api")
app.include_router(summary_router, prefix="/api")
app.include_router(query_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(reconstruct_router, prefix="/api")
app.include_router(poi_router, prefix="/api")
app.include_router(skeleton_router, prefix="/api")
app.include_router(guide_router, prefix="/api")
app.include_router(livekit_router, prefix="/api")
