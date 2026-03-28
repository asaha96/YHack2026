const API_BASE = "http://localhost:8000/api";

export interface Risk {
  structure: string;
  distance_mm: number;
  severity: "low" | "medium" | "high";
  note: string;
}

export interface Modification {
  type: "incision" | "highlight" | "label" | "zone" | "heatmap";
  coordinates: number[][];
  color: string;
  label: string;
  delay_ms?: number;
  duration_ms?: number;
  animation?: "draw" | "pulse" | "fade";
  score?: number;
  radius?: number;
}

export interface AgentResponse {
  narration: string;
  risks: Risk[];
  modifications: Modification[];
  recommendations: string[];
}

export interface SummaryResponse {
  approach: string;
  risk_inventory: { structure: string; severity: string; mitigation: string }[];
  scenarios_explored: { description: string; outcome: string }[];
  contingencies: string[];
  full_text: string;
}

export async function sendAction(
  sessionId: string,
  actionType: string,
  coordinates: number[][],
  surface: string,
  description = ""
): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      action_type: actionType,
      coordinates,
      surface,
      description,
    }),
  });
  if (!res.ok) throw new Error(`Action failed: ${res.statusText}`);
  return res.json();
}

export async function sendChat(
  sessionId: string,
  message: string
): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);
  return res.json();
}

export async function getNarrationAudio(text: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/narrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Narration failed: ${res.statusText}`);
  return res.blob();
}

export interface SemanticRegion {
  center: number[];
  radius: number;
  score: number;
  label: string;
}

export interface SemanticQueryResponse {
  method: string;
  similarity_score: number | null;
  regions: SemanticRegion[];
  explanation: string;
}

export async function sendSemanticQuery(
  sessionId: string,
  queryText: string,
  imageBase64?: string
): Promise<SemanticQueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      query_text: queryText,
      image_base64: imageBase64 || null,
    }),
  });
  if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
  return res.json();
}

export async function getSummary(
  sessionId: string
): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/summary/${sessionId}`);
  if (!res.ok) throw new Error(`Summary failed: ${res.statusText}`);
  return res.json();
}
