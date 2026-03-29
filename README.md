# Praxis

Patient-specific surgical simulation platform. Upload a CT or MRI scan, reconstruct a 3D model of the patient's interior, then practice the procedure with hand-tracked gestures while an AI assistant guides you through every step.

## Problem

Training surgeons is expensive and disconnected from reality. Cadavers are scarce, generic simulation software doesn't reflect patient-specific anatomy, and residents have no way to rehearse on the exact conditions they'll face in the OR — tumors, vessel anomalies, or complications unique to each patient.

## Solution

Praxis takes a patient's CT/MRI scan and reconstructs their exact anatomy as a navigable 3D model. Surgeons can then simulate the procedure using hand tracking (no special hardware — just a webcam) while an AI assistant labels danger zones, recommends incision paths, and narrates risks in real-time.

## How It Works

```
Upload CT/MRI → 3D Reconstruction → AI Labeling → Hand-Tracked Simulation → Session Report
```

1. **Upload** a DICOM or NIfTI scan (or use the sample dataset)
2. **Reconstruct** — isosurface extraction via marching cubes, exported as mesh + Gaussian splat
3. **Label** — AI analyzes the anatomy, identifies key structures and risk zones
4. **Simulate** — practice the procedure with hand gestures; AI responds to each action
5. **Report** — export a surgical plan PDF with approach, risks, and contingencies

## Features

**3D Reconstruction Pipeline**
- NIfTI and DICOM parsing (nibabel, pydicom)
- Multi-threshold isosurface extraction (bone, contrast tissue, soft tissue)
- OBJ mesh export (fallback) + Gaussian splat export (.splat format)
- 128 pre-loaded BodyParts3D anatomy parts across 5 layers (skeleton, organs, muscles, vascular, skin)

**Hand-Tracked Surgery Simulation**
- MediaPipe Hands with 5 gesture types:
  - **Point** (index finger) — inspect/hover over structures
  - **Pinch** (thumb + index) — select and trigger AI analysis
  - **Two fingers** (index + middle) — trace incision paths
  - **Fist** — retract tissue, AI describes what's exposed
  - **Spread** (pinch → open) — zoom into area for detail
- Position smoothing (4-frame average) for stable tracking
- Works with any standard webcam

**AI Surgical Assistant**
- Groq API with Llama 4 Scout (17B, 16E instruct)
- System prompt trained as senior attending surgeon mentoring a resident
- Returns structured JSON: narration, risks (with severity + proximity), 3D modifications, recommendations
- Session context maintained across interactions
- BiomedCLIP semantic querying for anatomy search ("find areas of high vascular density")

**Real-Time 3D Annotations**
- Timed annotation playback synced to AI narration
- Incision lines drawn progressively, zones pulse in, labels fade
- CSS2DRenderer for floating text labels in 3D space
- Heatmap overlays for semantic query results

**Voice**
- Groq TTS (PlayAI Dialog model) for narration
- ElevenLabs conversational AI agent (optional, for bidirectional voice)
- Web Speech API for voice input

**Session Summary**
- Full session history with all actions and AI responses
- PDF export with approach, risk inventory, scenarios explored, contingencies
- Generated via LLM from accumulated session context

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| 3D Rendering | Three.js, CSS2DRenderer, @mkkellogg/gaussian-splats-3d |
| Hand Tracking | MediaPipe Hands (CDN) |
| Backend | FastAPI, Python 3.14, uvicorn |
| LLM | Groq API (Llama 4 Scout 17B-16E) |
| TTS | Groq TTS (PlayAI Dialog) |
| Medical Imaging | nibabel (NIfTI), pydicom (DICOM), scikit-image (marching cubes) |
| Semantic Search | BiomedCLIP (Microsoft, via open_clip) |
| Mesh Processing | trimesh, fast-simplification |
| PDF Export | jsPDF |

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- Groq API key ([console.groq.com](https://console.groq.com))

### Install

```bash
# Clone
git clone https://github.com/asaha96/YHack2026.git
cd YHack2026

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Configure

```bash
# From project root
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### Run

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 ��� Frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
├── backend/
│   ├── main.py                  # FastAPI app, CORS, route registration
│   ├── routes/
│   │   ├── action.py            # POST /api/action — gesture actions
│   │   ├── chat.py              # POST /api/chat — follow-up questions
│   │   ├── upload.py            # POST /api/upload — CT/MRI file upload
│   │   ├── reconstruct.py       # POST /api/reconstruct — trigger 3D reconstruction
│   │   ├── query.py             # POST /api/query — BiomedCLIP semantic search
│   │   ├── narrate.py           # POST /api/narrate — Groq TTS
│   │   └── summary.py           # GET /api/summary/:id — session report
│   └── services/
│       ├── agent.py             # Groq LLM agent (system prompt, structured output)
│       ├── reconstruct.py       # CT/MRI → mesh → splat pipeline
│       ├── biomedclip.py        # BiomedCLIP + LLM fallback
│       ├── tts.py               # Groq TTS integration
│       └── session.py           # In-memory session state
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx      # Landing page
│   │   │   └── AppPage.tsx      # Main app (upload → reconstruct → simulate)
│   │   ├── components/
│   │   │   ├── LayeredAnatomyViewer.tsx  # 3D anatomy with layer controls
│   │   │   ├── SplatViewer.tsx          # Gaussian splat renderer
│   │   │   ├── HandTracker.tsx          # MediaPipe hand tracking + gestures
│   │   │   ├── ChatPanel.tsx            # Chat + voice input + semantic search
│   │   │   ├── UploadPanel.tsx          # CT/MRI upload drag-and-drop
│   │   │   ├── NarrationPlayer.tsx      # Voice agent controls
│   │   │   └── SummaryView.tsx          # Session summary + PDF export
│   │   ├── hooks/
│   │   │   ├── useAnnotationSync.ts     # Timed 3D annotation playback
│   │   │   ├── useGestures.ts           # Gesture type definitions
│   │   │   └── useRaycast.ts            # 3D raycasting helper
│   │   └── utils/
│   │       └── api.ts                   # Backend API client
│   └── public/
│       ├── models/anatomy/      # 128 BodyParts3D OBJ meshes (5 layers)
│       └── splats/              # Gaussian splat files
└── data/
    └── sample_ct/               # Sample synthetic CT (NIfTI)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload CT/MRI scan |
| POST | `/api/upload/sample` | Use sample dataset |
| POST | `/api/reconstruct` | Trigger 3D reconstruction |
| GET | `/api/reconstruct/:id` | Check reconstruction status |
| POST | `/api/action` | Send gesture action for AI analysis |
| POST | `/api/chat` | Send chat message |
| POST | `/api/query` | BiomedCLIP semantic search |
| POST | `/api/narrate` | Generate TTS audio |
| GET | `/api/summary/:id` | Generate session summary |

## Anatomy Data

128 real anatomical meshes from [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) (CC BY-SA 2.1 JP), organized in 5 toggleable layers:

- **Skeleton** (69 parts) — full rib cage, spine (C3-L5), sacrum, limb bones, skull
- **Organs** (25 parts) — heart, lungs, liver, kidneys, stomach, spleen, aorta, trachea
- **Muscles** (22 parts) — pectorals, deltoids, trapezius, abdominals, glutes
- **Vascular** (11 parts) — vena cava, coronaries, renal/mesenteric/pulmonary vessels
- **Skin** (1 part) — full body surface (transparent by default)

## License

MIT
