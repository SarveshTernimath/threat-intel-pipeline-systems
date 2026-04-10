"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Shield, Terminal, Radio, Database, Cpu, Globe2, RefreshCw } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import SeverityFilter from "@/components/SeverityFilter";
import ThreatTable from "@/components/ThreatTable";
import ThreatMap from "@/components/ThreatMap";
import SkeletonLoader from "@/components/SkeletonLoader";
import StatsCards from "@/components/StatsCards";
import InsightsPanel from "@/components/InsightsPanel";
import { searchThreats, fetchGeoThreats, fetchAllThreats } from "@/services/api";
import { Threat, Severity } from "@/types";

const DEFAULT_KEYWORD = "attack";

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [threats, setThreats] = useState<Threat[]>([]);
  const [geoThreats, setGeoThreats] = useState<Threat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Hydration-safe clock
  useEffect(() => { setIsClient(true); }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setIsLoading(true);
    setError(null);
    setSearched(true);
    setSeverityFilter("all");
    try {
      const data = await searchThreats(q);
      setThreats(data);
      setLastUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to threat intelligence backend.");
      setThreats([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setSearched(true);
      try {
        const data = await fetchAllThreats(200);
        setThreats(data);
        setLastUpdatedAt(new Date());
      } catch {
        void handleSearch(DEFAULT_KEYWORD);
      } finally {
        setIsLoading(false);
      }
    };
    void loadAll();
  }, [handleSearch]);

  // Geo threats
  useEffect(() => {
    const fetchGeo = async () => {
      try { setGeoThreats(await fetchGeoThreats(100)); }
      catch (err) { console.error("Geo fetch failed", err); }
    };
    void fetchGeo();
    const id = setInterval(fetchGeo, 60000);
    return () => clearInterval(id);
  }, []);

  // Background refresh
  useEffect(() => {
    if (!searched || !query.trim()) return;
    const id = setInterval(async () => {
      try {
        const data = await searchThreats(query);
        setThreats(data);
        setLastUpdatedAt(new Date());
      } catch (err) { console.error("Refresh failed", err); }
    }, 5000);
    return () => clearInterval(id);
  }, [query, searched]);

  const severityCounts = useMemo(() =>
    threats.reduce<Record<string, number>>((acc, t) => {
      const s = (t.severity || "unknown").toLowerCase();
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {}),
  [threats]);

  const filteredResults = useMemo(() =>
    severityFilter === "all" ? threats : threats.filter((t) => (t.severity || "unknown").toLowerCase() === severityFilter),
  [threats, severityFilter]);

  const latestAttackType = useMemo(() => {
    const latest = threats.find((t) => t.attack_type?.trim());
    return latest?.attack_type?.trim() ?? "";
  }, [threats]);

  const activeGeoThreats = geoThreats.length > 0 ? geoThreats : threats.filter((t) => t.lat && t.lng);

  const now = new Date();
  const timeStr = isClient ? now.toLocaleTimeString("en-US", { hour12: false }) : "--:--:--";
  const dateStr = isClient ? now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "--- --, ----";

  const tickerItems = useMemo(() => {
    const recent = threats.slice(0, 20).map((t) =>
      `[${(t.severity || "low").toUpperCase()}] ${t.cve_id} — ${(t.attack_type || t.source || "UNK").toUpperCase()}`
    );
    return recent.length > 0 ? [...recent, ...recent] : ["THREAT INTEL PIPELINE ACTIVE — MONITORING ALL CHANNELS"];
  }, [threats]);

  return (
    <>
      {/* Global scanlines overlay */}
      <div className="scanlines" aria-hidden="true" />

      <main className="min-h-screen">

        {/* ══════════════════════════════════════════
            HEADER — RED CYBERPUNK HUD
            ══════════════════════════════════════════ */}
        <header
          className="sticky top-0 z-50 backdrop-blur-xl"
          style={{
            background: "rgba(0,0,0,0.9)",
            borderBottom: "1px solid rgba(255,0,0,0.18)",
            boxShadow: "0 1px 30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,0,0,0.06)",
          }}
        >
          {/* Nav bar */}
          <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2 rounded-lg relative"
                style={{
                  background: "rgba(255,0,0,0.1)",
                  border: "1px solid rgba(255,0,0,0.35)",
                  boxShadow: "0 0 18px rgba(255,0,0,0.25)",
                }}>
                <Shield className="text-red-500" size={18} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-widest text-white font-mono hud-flicker">
                  THREAT INTEL <span style={{ color: "#ff0033", textShadow: "0 0 10px rgba(255,0,51,0.8)" }}>SYSTEM</span>
                </h1>
                <p className="text-[9px] text-red-900 font-mono tracking-widest">
                  CYBERSECURITY INTELLIGENCE · LIVE INGESTION
                </p>
              </div>
            </div>

            {/* Center status chips */}
            <div className="hidden md:flex items-center gap-3">
              {[
                { icon: Radio,    label: "LIVE FEED",    color: "#ff0033" },
                { icon: Database, label: "ES CONNECTED", color: "#cc2200" },
                { icon: Cpu,      label: "NLP ACTIVE",   color: "#ff3311" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-[10px]"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}30`,
                    color,
                  }}>
                  <Icon size={10} className="animate-pulse" />
                  {label}
                </div>
              ))}
            </div>

            {/* Right: clock + threat count */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-mono font-bold text-white tabular-nums">{timeStr}</p>
                <p className="text-[9px] font-mono text-red-900">{dateStr}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-[10px]"
                style={{
                  background: "rgba(255,0,0,0.08)",
                  border: "1px solid rgba(255,0,0,0.25)",
                }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
                  style={{ boxShadow: "0 0 8px #ff0033" }} />
                <span className="text-red-400 font-bold tabular-nums">{threats.length}</span>
                <span className="text-red-900">THREATS</span>
              </div>
              {lastUpdatedAt && (
                <div className="hidden lg:flex items-center gap-1.5 text-[9px] font-mono text-red-900">
                  <RefreshCw size={8} />
                  {lastUpdatedAt.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* ── LIVE Ticker ── */}
          <div className="relative overflow-hidden h-6 border-t"
            style={{ borderColor: "rgba(255,0,0,0.08)", background: "rgba(255,0,0,0.03)" }}>
            <div className="ticker-content h-full flex items-center gap-8 px-4">
              {tickerItems.map((item, i) => (
                <span key={i} className="text-[9px] font-mono whitespace-nowrap"
                  style={{ color: item.includes("[CRITICAL]") ? "#ff0033" : item.includes("[HIGH]") ? "#cc3300" : "rgba(255,80,80,0.4)" }}>
                  ◆ {item}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* ══════════════════════════════════════════
            BODY
            ══════════════════════════════════════════ */}
        <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

          {/* Stats */}
          <StatsCards
            total={threats.length}
            critical={severityCounts.critical ?? 0}
            high={severityCounts.high ?? 0}
            latestAttackType={latestAttackType}
          />

          {/* Search */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal size={12} className="text-red-700" />
              <span className="text-[9px] text-red-800 font-mono uppercase tracking-widest">
                Intelligence Query Terminal
              </span>
              {query && (
                <span className="ml-auto text-[9px] font-mono" style={{ color: "rgba(255,0,0,0.4)" }}>
                  {isLoading ? "⟳ Scanning..." : `↑ "${query}"`}
                </span>
              )}
            </div>
            <SearchBar onSearch={handleSearch} isLoading={isLoading} initialValue={DEFAULT_KEYWORD} />
          </div>

          {isLoading ? (
            <div className="glass-card p-6"><SkeletonLoader /></div>
          ) : (
            <div className="space-y-6">
              {/* Insights + Wave */}
              <InsightsPanel threats={filteredResults} />

              {/* Map */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe2 size={13} className="text-red-700" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-red-700">
                      Global Threat Cartography
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-red-900">
                    <span className="text-red-600">{activeGeoThreats.length}</span> geo-tagged threats
                  </span>
                </div>
                <ThreatMap threats={activeGeoThreats} />
              </div>

              {/* Intel Table */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-red-900" />
                    <span className="text-[9px] text-red-900 font-mono uppercase tracking-widest">
                      Threat Intelligence Records
                    </span>
                  </div>
                  {filteredResults.length > 0 && (
                    <span className="text-[9px] font-mono" style={{ color: "rgba(255,0,0,0.35)" }}>
                      {filteredResults.length} record{filteredResults.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <SeverityFilter selected={severityFilter} onChange={setSeverityFilter} counts={severityCounts} />
                <ThreatTable threats={filteredResults} isLoading={isLoading} error={error} searched={searched} />
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="text-center py-5 mt-4" style={{ borderTop: "1px solid rgba(255,0,0,0.06)" }}>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <span className="text-[9px] font-mono text-red-950">THREAT INTEL PIPELINE SYSTEMS</span>
              {["NVD", "AlienVault OTX", "URLHAUS", "RSS FEEDS", "IP FEEDS"].map((src) => (
                <span key={src} className="text-[9px] font-mono" style={{ color: "rgba(255,0,0,0.2)" }}>
                  ◆ {src}
                </span>
              ))}
            </div>
            <p className="text-[8px] font-mono text-red-950 mt-2">
              Real-time threat ingestion · Elasticsearch · Redis · NLP enrichment
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
