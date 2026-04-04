import { Threat } from "@/types";

const BASE_URL =
  "https://threat-intel-pipeline-systems-backend.onrender.com";

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
