/**
 * In dev, use `/api` so Vite proxies to the backend — works from phone on LAN.
 * Set `VITE_API_URL` (e.g. `http://192.168.1.10:8000/api`) if you need an explicit API host.
 */
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "/api" : "http://localhost:8000/api");

export interface Risk {
  structure: string;
  distance_mm: number;
  severity: "low" | "medium" | "high";
  note: string;
}

export interface Modification {
  type: "incision" | "highlight" | "label" | "zone" | "heatmap" | "measurement" | "corridor";
  coordinates: number[][];
  color: string;
  label: string;
  delay_ms?: number;
  duration_ms?: number;
  animation?: "draw" | "pulse" | "fade";
  score?: number;
  radius?: number;
  distance_mm?: number;
  risk_gradient?: number[];
  scenario?: string;
  scenario_label?: string;
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

export interface SkeletonResponse {
  organ_positions: Record<string, number[]>;
  organ_count: number;
  skeleton_detected: boolean;
}

export async function sendSkeleton(
  sessionId: string,
  keypoints: { x: number; y: number; z?: number }[]
): Promise<SkeletonResponse> {
  const res = await fetch(`${API_BASE}/skeleton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, keypoints }),
  });
  if (!res.ok) throw new Error(`Skeleton failed: ${res.statusText}`);
  return res.json();
}

export async function getReferencePositions(): Promise<SkeletonResponse> {
  const res = await fetch(`${API_BASE}/skeleton/reference`);
  if (!res.ok) throw new Error(`Reference failed: ${res.statusText}`);
  return res.json();
}

export async function getSummary(
  sessionId: string
): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/summary/${sessionId}`);
  if (!res.ok) throw new Error(`Summary failed: ${res.statusText}`);
  return res.json();
}
