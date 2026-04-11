"use client";

import { useMemo } from "react";
import { Threat } from "@/types";
import { PieChart, List, AlertTriangle, Skull, Zap } from "lucide-react";
import ThreatWaveChart from "./ThreatWaveChart";

interface InsightsPanelProps {
  threats: Threat[];
}

export default function InsightsPanel({ threats }: InsightsPanelProps) {
  const stats = useMemo(() => {
    if (!threats || !threats.length) {
      return { total: 0, severities: {}, topAttacks: [], recent: [] };
    }

    const severities: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const attackTypes: Record<string, number> = {};

    threats.forEach((t) => {
      const sev = (t.severity || "low").toLowerCase();
      severities[sev] = (severities[sev] || 0) + 1;
      const aType = (t.attack_type || "").trim().toLowerCase();
      if (aType && aType !== "unknown") {
        attackTypes[aType] = (attackTypes[aType] || 0) + 1;
      }
    });

    const topAttacks = Object.entries(attackTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const recent = [...threats]
      .sort(
        (a, b) =>
          new Date(b.published_date || 0).getTime() -
          new Date(a.published_date || 0).getTime()
      )
      .slice(0, 5);

    return { total: threats.length, severities, topAttacks, recent };
  }, [threats]);

  if (!threats || !threats.length) return null;

  const SEV_CONFIG = {
    critical: { bar: "#ff4757", bg: "rgba(255,71,87,0.15)",  border: "rgba(255,71,87,0.3)",  text: "text-red-400" },
    high:     { bar: "#ff7f11", bg: "rgba(255,127,17,0.12)", border: "rgba(255,127,17,0.3)", text: "text-orange-400" },
    medium:   { bar: "#ffd32a", bg: "rgba(255,211,42,0.1)",  border: "rgba(255,211,42,0.25)",text: "text-yellow-400" },
    low:      { bar: "#00e5ff", bg: "rgba(0,229,255,0.07)",  border: "rgba(0,229,255,0.2)",  text: "text-cyan-400" },
  } as const;

  return (
    <div className="space-y-4">
      {/* Top row: distribution + latest pulses */}
      <div className="glass-card p-5 flex flex-col lg:flex-row gap-8">

        {/* ── Left: Severities + Top Vectors ── */}
        <div className="flex-1 space-y-5">
          <div className="flex items-center gap-2">
            <PieChart size={14} className="text-red-600" />
            <span className="text-[15px] font-mono font-bold uppercase tracking-widest text-red-600">
              Global Threat Insights
            </span>
          </div>

          {/* Severity bars */}
          <div className="space-y-2">
            <p className="text-[14px] text-gray-400 font-mono uppercase tracking-widest">Severity Distribution</p>
            {(["critical", "high", "medium", "low"] as const).map((sev) => {
              const count = stats.severities[sev] ?? 0;
              const pct = stats.total > 0 ? Math.max(2, (count / stats.total) * 100) : 0;
              const cfg = SEV_CONFIG[sev];
              return (
                <div key={sev} className="flex items-center gap-3 group">
                  <span className={`w-14 text-[14px] font-mono uppercase ${cfg.text} tracking-wider`}>{sev}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        background: cfg.bar,
                        boxShadow: `0 0 6px ${cfg.bar}80`,
                      }}
                    />
                  </div>
                  <div className="flex gap-2 text-[14px] font-mono w-14 justify-end">
                    <span className={cfg.text}>{count}</span>
                    <span className="text-gray-300">{Math.round((count / (stats.total || 1)) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Attack Vectors */}
          {stats.topAttacks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[14px] text-gray-400 font-mono uppercase tracking-widest">Top Attack Vectors</p>
              <div className="space-y-1.5">
                {stats.topAttacks.map(([type, count], i) => (
                  <div
                    key={type}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md"
                    style={{
                      background: i === 0 ? "rgba(0,229,255,0.07)" : "rgba(255,255,255,0.02)",
                      border: i === 0 ? "1px solid rgba(0,229,255,0.2)" : "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={10} className={i === 0 ? "text-red-500" : "text-gray-400"} />
                      <span className={`text-[14px] font-mono uppercase tracking-wider ${i === 0 ? "text-red-400" : "text-gray-500"}`}>
                        {type}
                      </span>
                    </div>
                    <span className={`text-[14px] font-mono font-bold ${i === 0 ? "text-red-400" : "text-gray-400"}`}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Latest pulse streams ── */}
        <div className="flex-1 lg:pl-6 lg:border-l border-gray-800/50 space-y-4">
          <div className="flex items-center gap-2">
            <List size={14} className="text-red-600" />
            <span className="text-[15px] font-mono font-bold uppercase tracking-widest text-red-600">
              Latest Pulse Streams
            </span>
          </div>
          <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
            {stats.recent.map((t, i) => (
              <div
                key={i}
                className="flex gap-3 items-start group p-2.5 rounded-md transition-all duration-200 animate-slide-in-up"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {t.severity === "critical" ? (
                    <Skull size={12} className="text-red-500 animate-pulse" />
                  ) : (
                    <AlertTriangle size={12} className="text-gray-400 group-hover:text-cyan-500 transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-mono font-semibold text-gray-300 group-hover:text-white transition-colors truncate">
                    {t.cve_id}
                    <span className="text-gray-300 font-normal ml-1">[{t.source}]</span>
                  </p>
                  <p className="text-[14px] font-mono text-gray-400 mt-0.5 line-clamp-2">
                    {t.description || "No context provided"}
                  </p>
                </div>
                <span className="text-[14px] font-mono text-gray-300 whitespace-nowrap shrink-0">
                  {t.published_date}
                </span>
              </div>
            ))}
            {stats.recent.length === 0 && (
              <p className="text-[15px] font-mono text-gray-300 animate-pulse">
                Awaiting intelligence streams...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Threat Wave Chart ── */}
      <div className="glass-card p-5">
        <ThreatWaveChart threats={threats} />
      </div>
    </div>
  );
}
