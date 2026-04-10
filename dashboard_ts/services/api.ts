import { Threat } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, maxRetries = 6, delayMs = 5000): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      // Render cold-starts often throw 502/521/503 during wake cycles.
      if (res.status === 521 || res.status === 502 || res.status === 503) {
        throw new Error(`Cold boot 5xx status: ${res.status}`);
      }

      if (!res.ok) {
        // Break fast for non-recovery HTTP logic errors (404/400)
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      attempt++;
      // If we've exhausted our cold-start waiting period, throw back to UI Handler
      if (attempt >= maxRetries) {
        throw err;
      }
      // Wait for 5 seconds before hitting Render again to let it wake up
      await sleep(delayMs);
    }
  }
}

export async function searchThreats(keyword: string): Promise<Threat[]> {
  if (!keyword.trim()) return [];
  const url = `${BASE_URL}/search?keyword=${encodeURIComponent(keyword.trim())}`;

  const data = await fetchWithRetry(url);

  if (Array.isArray(data)) return data as Threat[];
  if (Array.isArray(data?.results)) return data.results as Threat[];
  if (Array.isArray(data?.hits)) return data.hits as Threat[];
  return [];
}

export async function fetchGeoThreats(limit: number = 50): Promise<Threat[]> {
  const url = `${BASE_URL}/geo-threats?limit=${limit}`;
  const data = await fetchWithRetry(url);

  if (Array.isArray(data)) return data as Threat[];
  return [];
}

export async function fetchAllThreats(limit: number = 100): Promise<Threat[]> {
  const url = `${BASE_URL}/all-threats?limit=${limit}`;
  const data = await fetchWithRetry(url);

  if (Array.isArray(data)) return data as Threat[];
  return [];
}
