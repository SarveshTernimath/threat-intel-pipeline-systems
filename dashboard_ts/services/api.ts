import { Threat } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function searchThreats(keyword: string): Promise<Threat[]> {
  if (!keyword.trim()) return [];

  const url = `${BASE_URL}/search?keyword=${encodeURIComponent(keyword.trim())}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `API error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  // Backend may return { results: [...] } or array directly
  if (Array.isArray(data)) return data as Threat[];
  if (Array.isArray(data?.results)) return data.results as Threat[];
  if (Array.isArray(data?.hits)) return data.hits as Threat[];

  return [];
}

export async function fetchGeoThreats(limit: number = 50): Promise<Threat[]> {
  const url = `${BASE_URL}/geo-threats?limit=${limit}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data as Threat[];
  return [];
}
