"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Shield, Terminal, Activity, Database } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import SeverityFilter from "@/components/SeverityFilter";
import ThreatTable from "@/components/ThreatTable";
import ThreatMap from "@/components/ThreatMap";
import SkeletonLoader from "@/components/SkeletonLoader";
import { searchThreats } from "@/services/api";
import { Threat, Severity } from "@/types";

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Threat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setIsLoading(true);
    setError(null);
    setSearched(true);
    setSeverityFilter("all");

    try {
      const data = await searchThreats(q);
      setResults(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to threat intelligence backend."
      );
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searched || !query.trim()) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await searchThreats(query);
        setResults(data);
      } catch (err) {
        // Silently ignore background errors to avoid UX disruption
        console.error("Background refresh failed", err);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [query, searched]);

  const severityCounts = useMemo(() => {
    return results.reduce<Record<string, number>>((acc, t) => {
      const s = (t.severity || "unknown").toLowerCase();
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
  }, [results]);

  const filteredResults = useMemo(() => {
    if (severityFilter === "all") return results;
    return results.filter(
      (t) => (t.severity || "unknown").toLowerCase() === severityFilter
    );
  }, [results, severityFilter]);

  const stats = [
    { label: "Total Threats", value: results.length, icon: Database, color: "text-red-400" },
    { label: "Critical",      value: severityCounts.critical ?? 0, icon: Shield,   color: "text-red-500" },
    { label: "High",          value: severityCounts.high ?? 0,     icon: Activity, color: "text-orange-400" },
    { label: "Sources",       value: [...new Set(results.map((r) => r.source))].length, icon: Terminal, color: "text-gray-400" },
  ];

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
              LIVE
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-[#0d0d10] border border-gray-800/80 rounded-xl p-4 flex items-center gap-4 hover:border-gray-700 transition-colors"
            >
              <div className="p-2.5 bg-gray-900 rounded-lg">
                <Icon className={color} size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white">{value}</p>
                <p className="text-xs text-gray-600 font-mono">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search Card */}
        <div className="bg-[#0d0d10] border border-gray-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-red-500" />
            <span className="text-xs text-gray-500 font-mono uppercase tracking-widest">
              Threat Search
            </span>
          </div>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
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
              <ThreatMap threats={filteredResults} />
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
