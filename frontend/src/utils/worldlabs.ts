// ---------------------------------------------------------------------------
// World Labs Marble API client (frontend)
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.worldlabs.ai/marble/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorldAssets {
  thumbnail_url?: string | null;
  caption?: string | null;
  imagery?: { pano_url?: string | null } | null;
  mesh?: { collider_mesh_url?: string | null } | null;
  splats?: { spz_urls?: Record<string, string> | null } | null;
}

export interface World {
  world_id: string;
  display_name: string;
  world_marble_url: string;
  model?: string | null;
  tags?: string[] | null;
  assets?: WorldAssets | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiHeaders(): HeadersInit {
  const key = import.meta.env.VITE_WORLD_LABS_API ?? "";
  if (!key) throw new Error("VITE_WORLD_LABS_API is not set");
  return {
    "Content-Type": "application/json",
    "WLT-Api-Key": key,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function getWorld(worldId: string): Promise<World> {
  const res = await fetch(`${BASE_URL}/worlds/${worldId}`, {
    method: "GET",
    headers: apiHeaders(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`getWorld failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// SPZ quality selection — prefer highest resolution available
// ---------------------------------------------------------------------------

const SPZ_QUALITY_PREFERENCE = ["full_res", "500k", "100k"] as const;

export function selectSpzUrl(world: World): string | null {
  const urls = world.assets?.splats?.spz_urls;
  if (!urls) return null;

  for (const quality of SPZ_QUALITY_PREFERENCE) {
    if (urls[quality]) return urls[quality];
  }

  const values = Object.values(urls) as string[];
  return values[0] ?? null;
}
