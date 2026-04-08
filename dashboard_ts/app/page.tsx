"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Shield, Terminal } from "lucide-react";
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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to threat intelligence backend."
      );
      setThreats([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load: fetch ALL threats (match_all) so dashboard shows 100+ immediately.
  // When user searches explicitly, searchThreats() is called. Both coexist safely.
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setSearched(true);
      try {
        const data = await fetchAllThreats(200);
        setThreats(data);
        setLastUpdatedAt(new Date());
      } catch {
        // Fallback to keyword search if /all-threats fails (e.g. old deployment still deploying)
        void handleSearch(DEFAULT_KEYWORD);
      } finally {
        setIsLoading(false);
      }
    };
    void loadAll();
  }, [handleSearch]);

  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const data = await fetchGeoThreats(100);
        setGeoThreats(data);
      } catch (err) {
        console.error("Failed to load geo threats", err);
      }
    };
    void fetchGeo();
    
    // Refresh geo data every 10 seconds
    const intervalId = setInterval(fetchGeo, 10000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!searched || !query.trim()) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await searchThreats(query);
        setThreats(data);
        setError(null);
        setLastUpdatedAt(new Date());
      } catch (err) {
        // Silently ignore background errors to avoid UX disruption
        console.error("Background refresh failed", err);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [query, searched]);

  const severityCounts = useMemo(() => {
    return threats.reduce<Record<string, number>>((acc, t) => {
      const s = (t.severity || "unknown").toLowerCase();
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
  }, [threats]);

  const filteredResults = useMemo(() => {
    if (severityFilter === "all") return threats;
    return threats.filter(
      (t) => (t.severity || "unknown").toLowerCase() === severityFilter
    );
  }, [threats, severityFilter]);

  const latestAttackType = useMemo(() => {
    const latest = threats.find((t) => t.attack_type && t.attack_type.trim());
    return latest?.attack_type?.trim() ?? "";
  }, [threats]);

  return (
    <main className="min-h-screen bg-[#07070a] text-gray-100">
      {/* Top nav */}
      <header className="border-b border-gray-900 bg-[#09090c]">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900/20 rounded-lg border border-red-900/40">
              <Shield className="text-red-500" size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white font-mono">
                THREAT INTEL PLATFORM
              </h1>
              <p className="text-[11px] text-gray-600 font-mono tracking-widest">
                CYBERSECURITY INTELLIGENCE DASHBOARD
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-green-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              LIVE FEED ACTIVE
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 border border-cyan-900/40 rounded px-2 py-0.5">
              SYNC {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "--:--:--"}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-400 border border-gray-800 rounded px-2 py-0.5">
              {threats.length} THREATS
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* Stats Row */}
        <StatsCards
          total={threats.length}
          critical={severityCounts.critical ?? 0}
          high={severityCounts.high ?? 0}
          latestAttackType={latestAttackType}
        />

        {/* Search Card */}
        <div className="bg-[#0d0d10] border border-gray-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-red-500" />
            <span className="text-xs text-gray-500 font-mono uppercase tracking-widest">
              Threat Search
            </span>
          </div>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} initialValue={DEFAULT_KEYWORD} />
          {query && (
            <p className="text-xs font-mono text-gray-600">
              {isLoading ? "Scanning..." : `Showing results for `}
              {!isLoading && <span className="text-gray-400">&quot;{query}&quot;</span>}
            </p>
          )}
        </div>

        {/* Results Card */}
        <div className="bg-[#0d0d10] border border-gray-800/80 rounded-xl p-6 space-y-4">
          {/* Filter row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <SeverityFilter
              selected={severityFilter}
              onChange={setSeverityFilter}
              counts={severityCounts}
            />
            {filteredResults.length > 0 && (
              <span className="text-xs font-mono text-gray-700">
                {filteredResults.length} record{filteredResults.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Table / Skeleton */}
          {isLoading ? (
            <SkeletonLoader />
          ) : (
            <div className="space-y-8">
              <InsightsPanel threats={filteredResults} />
              <ThreatMap threats={geoThreats.length > 0 ? geoThreats : threats.filter(t => t.lat && t.lng)} />
              <ThreatTable
                threats={filteredResults}
                isLoading={isLoading}
                error={error}
                searched={searched}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center py-4 border-t border-gray-900">
          <p className="text-xs font-mono text-gray-800">
            THREAT INTEL PIPELINE SYSTEMS · DATA VIA{" "}
            <span className="text-gray-700">NVD · OTX · RSS</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
