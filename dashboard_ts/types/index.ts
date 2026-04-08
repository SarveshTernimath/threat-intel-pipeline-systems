export type Severity = "critical" | "high" | "medium" | "low" | "unknown";

export interface Geo {
  country?: string;
  city?: string;
  org?: string;
  lat?: number;
  lon?: number;
}

export interface EnrichedIP {
  ip: string;
  geo?: Geo;
}

export interface IOCs {
  ips: string[];
  enriched_ips: EnrichedIP[];
  domains: string[];
  hashes: string[];
}

export interface Threat {
  cve_id: string;
  description: string;
  source: string;
  published_date: string;
  severity: Severity;
  keywords: string[];
  attack_type: string;
  iocs: IOCs;
  // Geo-enrichment fields from worker
  lat?: number;
  lng?: number;
  country?: string;
  risk_score?: number;
  indicators?: string[];
}

export interface SearchResponse {
  results: Threat[];
  total: number;
  query: string;
}
