"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Shield, Terminal, Radio, Database, Cpu, Globe2, RefreshCw, Wifi, Activity, Zap, ZapOff } from "lucide-react";
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
  const [pendingThreats, setPendingThreats] = useState<Threat[] | null>(null);
  const [geoThreats, setGeoThreats] = useState<Threat[]>([]);
  const [lockedWaveThreats, setLockedWaveThreats] = useState<Threat[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  
  const [liveMode, setLiveMode] = useState(false); // Default OFF for full stability

  // 1: Hydration-safe clock — tick every second for header
  useEffect(() => {
    setIsClient(true);
    const id = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 2: "Seconds ago" counter — increments every second
  useEffect(() => {
    if (!lastUpdatedAt) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  const applyNewData = useCallback((data: Threat[]) => {
    setThreats(data);
    setLockedWaveThreats(data);
    setPendingThreats(null);
    setLastUpdatedAt(new Date());
    setSecondsAgo(0);
  }, []);

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
      applyNewData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to threat intelligence backend.");
      setThreats([]);
    } finally {
      setIsLoading(false);
    }
  }, [applyNewData]);

  // Core background fetch function
  const fetchSilently = useCallback(async () => {
    if (isRefreshing || isLoading) return;
    setIsRefreshing(true);
    try {
      const fn = query ? () => searchThreats(query) : () => fetchAllThreats(50);
      const raw = await fn();
      const data = Array.from(new Map(raw.map((d: Threat) => [d.cve_id, d])).values());
      
      // If data is identical, ignore
      if (JSON.stringify(threats.map(t => t.cve_id)) === JSON.stringify(data.map(t => t.cve_id))) {
        return;
      }
      
      // It's different. Soft update!
      setPendingThreats(data);
    } catch {
      // Background fail is silent
    } finally {
      setIsRefreshing(false);
    }
  }, [query, threats, isRefreshing, isLoading]);

  // Initial manual load
  useEffect(() => {
    const loadInit = async () => {
      setIsLoading(true);
      try {
        const raw = await fetchAllThreats(50);
        const data = Array.from(new Map(raw.map((d: Threat) => [d.cve_id, d])).values());
        applyNewData(data);
        setSearched(true);
      } catch {
        void handleSearch(DEFAULT_KEYWORD);
      } finally {
        setIsLoading(false);
      }
    };
    void loadInit();
  }, [handleSearch, applyNewData]);

  // Live Mode polling (every 40 seconds)
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => {
      void fetchSilently();
    }, 40000);
    return () => clearInterval(id);
  }, [liveMode, fetchSilently]);

  // Geo threats (locked refresh every 90s to prevent map/graph flicker)
  useEffect(() => {
    const fetchGeo = async () => {
      try { setGeoThreats(await fetchGeoThreats(100)); }
      catch (err) { console.error("Geo fetch failed", err); }
    };
    void fetchGeo();
    const id = setInterval(fetchGeo, 90000);
    return () => clearInterval(id);
  }, []);

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
  
  // Wave bar uses locked state to bypass rapid updates
  const lockedActiveGeoThreats = geoThreats.length > 0 ? geoThreats : lockedWaveThreats.filter((t) => t.lat && t.lng);
  const lockedCriticalCount = useMemo(() => lockedWaveThreats.filter(t => (t.severity || "").toLowerCase() === "critical").length, [lockedWaveThreats]);

  const now = new Date();
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
    { icon: Radio,    label: "LIVE FEED",    color: "#ff0033", pulse: liveMode },
    { icon: Database, label: "ES CONNECTED", color: "#cc2200", pulse: false },
    { icon: Cpu,      label: "NLP ACTIVE",   color: "#ff3311", pulse: false },
  ];

  return (
    <>
      <div className="scanlines" aria-hidden="true" />
      <main className="min-h-screen relative">
        
        {/* Soft Update Floating Badge */}
        {pendingThreats && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] animate-slide-in-up">
            <button
              onClick={() => applyNewData(pendingThreats)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full shadow-2xl transition-all hover:scale-105"
              style={{
                background: "rgba(255,0,0,0.15)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,50,50,0.5)",
                color: "#ffcccc",
                boxShadow: "0 4px 20px rgba(255,0,0,0.3)"
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[14px] font-bold tracking-wider">
                NEW THREATS AVAILABLE • CLICK TO REFRESH
              </span>
            </button>
          </div>
        )}

        <header
          className="sticky top-0 z-50 backdrop-blur-xl"
          style={{
            background: "rgba(5,5,5,0.92)",
            borderBottom: "1px solid rgba(255,0,0,0.15)",
            boxShadow: "0 1px 30px rgba(0,0,0,0.9)",
          }}
        >
          <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2 rounded-lg relative"
                style={{ background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.35)" }}>
                <Shield className="text-red-500" size={18} />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-widest text-white font-mono">
                  THREAT INTEL <span style={{ color: "#ff2a2a" }}>SYSTEM</span>
                </h1>
                <p className="text-[13px] text-red-600 font-mono tracking-widest">
                  CYBERSECURITY INTELLIGENCE PIPELINE
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={() => setLiveMode(!liveMode)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-[13px] transition-all cursor-pointer hover:bg-white/5 mr-2"
                style={{
                  border: liveMode ? "1px solid rgba(255,50,50,0.5)" : "1px solid rgba(150,150,150,0.3)",
                  color: liveMode ? "#ff5555" : "#a0a0a0",
                  background: liveMode ? "rgba(255,0,0,0.05)" : "transparent"
                }}
              >
                {liveMode ? <Zap size={12} className="animate-pulse" /> : <ZapOff size={12} />}
                LIVE MODE: {liveMode ? "ON" : "OFF"}
              </button>

              {STATUS_CHIPS.map(({ icon: Icon, label, color, pulse }) => (
                <div key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[13px]"
                  style={{
                    background: `${color}10`,
                    border: `1px solid ${color}30`,
                    color,
                  }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: color,
                      animation: pulse ? "pulse 1.5s ease-in-out infinite" : "none",
                    }}
                  />
                  <Icon size={10} />
                  {label}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-[14px] font-mono font-bold text-white tabular-nums">{timeStr}</p>
                <p className="text-[13px] font-mono text-red-800">{dateStr}</p>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-[14px]"
                style={{ background: "rgba(255,0,0,0.08)", border: "1px solid rgba(255,0,0,0.2)" }}>
                <span className="text-red-400 font-bold tabular-nums">
                  {threats.length}
                </span>
                <span className="text-red-800">THREATS</span>
              </div>

              {lastUpdatedStr && (
                <div className="hidden lg:flex items-center gap-1.5 text-[13px] font-mono"
                  style={{ color: secondsAgo < 10 ? "#ff4444" : "rgba(255,80,80,0.45)" }}>
                  <Activity size={9} className={isRefreshing ? "animate-spin" : ""} />
                  <span>Updated {lastUpdatedStr}</span>
                </div>
              )}

              <button
                onClick={() => void handleSearch(query || DEFAULT_KEYWORD)}
                title="Force Refresh"
                className="p-1.5 rounded-md transition-all cursor-pointer hover:bg-red-500/10"
                style={{ border: "1px solid rgba(255,0,0,0.2)", color: "rgba(255,60,60,0.7)" }}
              >
                <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden h-6 border-t"
            style={{ borderColor: "rgba(255,0,0,0.1)", background: "rgba(255,0,0,0.04)" }}>
            <div className="ticker-content h-full flex items-center gap-8 px-4">
              {tickerItems.map((item, i) => (
                <span key={i} className="text-[13px] font-mono whitespace-nowrap"
                  style={{ color: item.includes("[CRITICAL]") ? "#ff2a2a" : item.includes("[HIGH]") ? "#cc3300" : "rgba(255,80,80,0.45)" }}>
                  ◆ {item}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
          <StatsCards
            total={threats.length}
            critical={severityCounts.critical ?? 0}
            high={severityCounts.high ?? 0}
            latestAttackType={latestAttackType}
          />

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
              <InsightsPanel threats={filteredResults} />

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
                      <span className="text-red-500">{activeGeoThreats.length}</span> geo-tagged
                    </span>
                  </div>
                </div>
                <ThreatMap threats={activeGeoThreats} />
                <ThreatWaveBar threatCount={lockedActiveGeoThreats.length} criticalCount={lockedCriticalCount} />
              </div>

              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-red-800" />
                    <span className="text-[14px] text-red-800 font-mono uppercase tracking-widest">
                      Threat Intelligence Records
                    </span>
                  </div>
                  {filteredResults.length > 0 && (
                    <span className="text-[14px] font-mono" style={{ color: "rgba(255,0,0,0.4)" }}>
                      {filteredResults.length} records
                    </span>
                  )}
                </div>
                <SeverityFilter selected={severityFilter} onChange={setSeverityFilter} counts={severityCounts} />
                <ThreatTable threats={filteredResults} isLoading={isLoading} error={error} searched={searched} />
              </div>
            </div>
          )}

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
              Real-time ingestion · Elasticsearch · Backend stable
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
