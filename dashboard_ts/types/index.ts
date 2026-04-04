export type Severity = "critical" | "high" | "medium" | "low" | "unknown";

export interface IOCs {
  ips: string[];
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
}

export interface SearchResponse {
  results: Threat[];
  total: number;
  query: string;
}
