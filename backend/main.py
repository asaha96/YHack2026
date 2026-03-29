from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Praxis API", version="0.1.0")

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
