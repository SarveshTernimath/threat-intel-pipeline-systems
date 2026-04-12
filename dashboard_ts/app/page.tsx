"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Shield, Terminal, Radio, Database, Cpu, Globe2, RefreshCw, Wifi, Activity } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import SeverityFilter from "@/components/SeverityFilter";
import ThreatTable from "@/components/ThreatTable";
import ThreatMap from "@/components/ThreatMap";
import SkeletonLoader from "@/components/SkeletonLoader";
import StatsCards from "@/components/StatsCards";
import InsightsPanel from "@/components/InsightsPanel";
import ThreatWaveBar from "@/components/ThreatWaveBar";
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
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [displayCount, setDisplayCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const fetchAllRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Hydration-safe clock — tick every second
  useEffect(() => {
    setIsClient(true);
    const id = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // "Seconds ago" counter — increments every second after last update
  useEffect(() => {
    if (!lastUpdatedAt) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  // Smooth display count interpolator previous -> new over time
  useEffect(() => {
    const target = threats.length;
    const id = setInterval(() => {
      setDisplayCount((prev) => {
        if (prev === target) {
          clearInterval(id);
          return prev;
        }
        const diff = target - prev;
        // Faster step if difference is large
        const step = Math.max(1, Math.floor(Math.abs(diff) / 10));
        return prev < target ? prev + step : prev - step;
      });
    }, 50);
    return () => clearInterval(id);
  }, [threats.length]);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setIsLoading(true);
    setError(null);
    setSearched(true);
    setSeverityFilter("all");
    try {
      const raw = await searchThreats(q);
      const data = Array.from(new Map(raw.map((d: Threat) => [d.cve_id, d])).values());
      setThreats((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(data)) {
          setLastUpdatedAt(new Date());
          setSecondsAgo(0);
          return data;
        }
        return prev;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to threat intelligence backend.");
      setThreats([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Core fetch function for all-threats (used on initial load + polling)
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const raw = await fetchAllThreats(50);
      const data = Array.from(new Map(raw.map((d: Threat) => [d.cve_id, d])).values());
      setThreats((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(data)) {
          setLastUpdatedAt(new Date());
          setSecondsAgo(0);
          return data;
        }
        return prev;
      });
      setSearched(true);
    } catch {
      if (!silent) void handleSearch(DEFAULT_KEYWORD);
    } finally {
      if (!silent) setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, [handleSearch]);

  // Store ref so interval always uses the latest version
  useEffect(() => { fetchAllRef.current = () => fetchAll(true); }, [fetchAll]);

  // Initial load
  useEffect(() => { void fetchAll(false); }, [fetchAll]);

  // 20-second auto-refresh (silent, no loading spinner)
  useEffect(() => {
    const id = setInterval(() => {
      if (fetchAllRef.current) void fetchAllRef.current();
    }, 20000);
    return () => clearInterval(id);
  }, []);

  // Geo threats with 60s refresh
  useEffect(() => {
    const fetchGeo = async () => {
      try { setGeoThreats(await fetchGeoThreats(100)); }
      catch (err) { console.error("Geo fetch failed", err); }
    };
    void fetchGeo();
    const id = setInterval(fetchGeo, 60000);
    return () => clearInterval(id);
  }, []);

  // Background search refresh (only when user has active search query)
  useEffect(() => {
    if (!searched || !query.trim()) return;
    const id = setInterval(async () => {
      try {
        const raw = await searchThreats(query);
        const data = Array.from(new Map(raw.map((d: Threat) => [d.cve_id, d])).values());
        setThreats((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            setLastUpdatedAt(new Date());
            setSecondsAgo(0);
            return data;
          }
          return prev;
        });
      } catch (err) { console.error("Refresh failed", err); }
    }, 20000);
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
  // clockTick drives re-render every second for live clock
  void clockTick;
  const timeStr = isClient ? now.toLocaleTimeString("en-US", { hour12: false }) : "--:--:--";
  const dateStr = isClient ? now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "--- --, ----";

  const lastUpdatedStr = isClient && lastUpdatedAt
    ? secondsAgo < 5
      ? "just now"
      : secondsAgo < 60
      ? `${secondsAgo}s ago`
      : `${Math.floor(secondsAgo / 60)}m ago`
    : null;

  const tickerItems = useMemo(() => {
    const recent = threats.slice(0, 20).map((t) =>
      `[${(t.severity || "low").toUpperCase()}] ${t.cve_id} — ${(t.attack_type || t.source || "UNK").toUpperCase()}`
    );
    return recent.length > 0 ? [...recent, ...recent] : ["THREAT INTEL PIPELINE ACTIVE — MONITORING ALL CHANNELS"];
  }, [threats]);

  const STATUS_CHIPS = [
    { icon: Radio,    label: "LIVE FEED",    color: "#ff0033", pulse: true  },
    { icon: Database, label: "ES CONNECTED", color: "#cc2200", pulse: false },
    { icon: Cpu,      label: "NLP ACTIVE",   color: "#ff3311", pulse: false },
    { icon: Wifi,     label: "STREAMING",    color: "#dd1100", pulse: true  },
  ];

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
            background: "rgba(0,0,0,0.92)",
            borderBottom: "1px solid rgba(255,0,0,0.2)",
            boxShadow: "0 1px 30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,0,0,0.07)",
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
                <h1 className="text-base font-bold tracking-widest text-white font-mono hud-flicker">
                  THREAT INTEL <span style={{ color: "#ff0033", textShadow: "0 0 10px rgba(255,0,51,0.8)" }}>SYSTEM</span>
                </h1>
                <p className="text-[13px] text-red-600 font-mono tracking-widest animate-pulse">
                  ● STREAMING LATEST THREAT INTELLIGENCE — LIVE FEED
                </p>
              </div>
            </div>

            {/* Center status chips */}
            <div className="hidden md:flex items-center gap-2">
              {STATUS_CHIPS.map(({ icon: Icon, label, color, pulse }) => (
                <div key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[13px]"
                  style={{
                    background: `${color}14`,
                    border: `1px solid ${color}35`,
                    color,
                    boxShadow: pulse ? `0 0 8px ${color}30` : "none",
                  }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: color,
                      boxShadow: `0 0 5px ${color}`,
                      animation: pulse ? "pulse 1.5s ease-in-out infinite" : "none",
                    }}
                  />
                  <Icon size={10} />
                  {label}
                </div>
              ))}
            </div>

            {/* Right: clock + threat count + last updated */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-[14px] font-mono font-bold text-white tabular-nums">{timeStr}</p>
                <p className="text-[13px] font-mono text-red-800">{dateStr}</p>
              </div>

              {/* Threat count with animation */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-[14px]"
                style={{
                  background: "rgba(255,0,0,0.08)",
                  border: "1px solid rgba(255,0,0,0.28)",
                  boxShadow: isRefreshing ? "0 0 12px rgba(255,0,0,0.2)" : "none",
                  transition: "box-shadow 0.4s ease",
                }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
                  style={{ boxShadow: "0 0 8px #ff0033" }} />
                <span className="text-red-400 font-bold tabular-nums" style={{ minWidth: "2ch", textAlign: "right" }}>
                  {displayCount}
                </span>
                <span className="text-red-800">THREATS</span>
              </div>

              {/* Last updated — live "X seconds ago" */}
              {lastUpdatedStr && (
                <div className="hidden lg:flex items-center gap-1.5 text-[13px] font-mono"
                  style={{ color: secondsAgo < 10 ? "#ff4444" : "rgba(255,80,80,0.45)" }}>
                  <Activity size={9} className={isRefreshing ? "animate-spin" : ""} />
                  <span>Updated {lastUpdatedStr}</span>
                </div>
              )}

              {/* Manual refresh button */}
              <button
                onClick={() => void fetchAll(false)}
                title="Refresh now"
                className="p-1.5 rounded-md transition-all"
                style={{
                  background: "rgba(255,0,0,0.07)",
                  border: "1px solid rgba(255,0,0,0.2)",
                  color: "rgba(255,60,60,0.7)",
                }}
              >
                <RefreshCw size={12} className={isLoading || isRefreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* ── LIVE auto-updated Ticker ── */}
          <div className="relative overflow-hidden h-6 border-t"
            style={{ borderColor: "rgba(255,0,0,0.1)", background: "rgba(255,0,0,0.04)" }}>
            <div className="ticker-content h-full flex items-center gap-8 px-4">
              {tickerItems.map((item, i) => (
                <span key={i} className="text-[13px] font-mono whitespace-nowrap"
                  style={{ color: item.includes("[CRITICAL]") ? "#ff0033" : item.includes("[HIGH]") ? "#cc3300" : "rgba(255,80,80,0.45)" }}>
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
            total={displayCount}
            critical={severityCounts.critical ?? 0}
            high={severityCounts.high ?? 0}
            latestAttackType={latestAttackType}
          />

          {/* Search */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal size={12} className="text-red-700" />
              <span className="text-[14px] text-red-700 font-mono uppercase tracking-widest">
                Intelligence Query Terminal
              </span>
              {query && (
                <span className="ml-auto text-[14px] font-mono" style={{ color: "rgba(255,0,0,0.4)" }}>
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
                    <span className="text-[14px] font-mono uppercase tracking-widest text-red-700">
                      Global Threat Cartography
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[14px] font-mono text-red-800">
                      <span className="text-red-500">{activeGeoThreats.length}</span> geo-tagged threats
                    </span>
                    {lastUpdatedStr && (
                      <span className="text-[12px] font-mono" style={{ color: "rgba(255,80,80,0.4)" }}>
                        ↻ {lastUpdatedStr}
                      </span>
                    )}
                  </div>
                </div>
                <ThreatMap threats={activeGeoThreats} />
                {/* Wave bar synced below globe */}
                <ThreatWaveBar threatCount={activeGeoThreats.length} criticalCount={severityCounts.critical ?? 0} />
              </div>

              {/* Intel Table */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-red-800" />
                    <span className="text-[14px] text-red-800 font-mono uppercase tracking-widest">
                      Threat Intelligence Records
                    </span>
                    {/* Live stream label */}
                    <span className="text-[12px] font-mono px-2 py-0.5 rounded-full animate-pulse"
                      style={{
                        background: "rgba(255,0,0,0.08)",
                        border: "1px solid rgba(255,0,0,0.2)",
                        color: "#ff4444",
                      }}>
                      ● LIVE STREAM
                    </span>
                  </div>
                  {filteredResults.length > 0 && (
                    <span className="text-[14px] font-mono" style={{ color: "rgba(255,0,0,0.4)" }}>
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
          <footer className="text-center py-5 mt-4" style={{ borderTop: "1px solid rgba(255,0,0,0.07)" }}>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <span className="text-[13px] font-mono text-red-900">THREAT INTEL PIPELINE SYSTEMS</span>
              {["NVD", "AlienVault OTX", "URLHAUS", "RSS FEEDS", "IP FEEDS"].map((src) => (
                <span key={src} className="text-[13px] font-mono" style={{ color: "rgba(255,0,0,0.22)" }}>
                  ◆ {src}
                </span>
              ))}
            </div>
            <p className="text-[12px] font-mono text-red-900 mt-2">
              Real-time threat ingestion · Elasticsearch · Redis · NLP enrichment · Auto-refreshes every 20s
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
