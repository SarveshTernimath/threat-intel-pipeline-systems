"use client";

import { useMemo } from "react";
import { Threat, Severity } from "@/types";
import { PieChart, List, AlertTriangle, Skull } from "lucide-react";

interface InsightsPanelProps {
  threats: Threat[];
}

export default function InsightsPanel({ threats }: InsightsPanelProps) {
  const stats = useMemo(() => {
    if (!threats || !threats.length) {
      return { total: 0, severities: {}, mostCommonAttack: "—", recent: [] };
    }

    const severities: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const attackTypes: Record<string, number> = {};

    threats.forEach(t => {
      const sev = (t.severity || "low").toLowerCase();
      severities[sev] = (severities[sev] || 0) + 1;
      
      const aType = (t.attack_type || "").trim().toLowerCase();
      if (aType && aType !== "unknown") {
        attackTypes[aType] = (attackTypes[aType] || 0) + 1;
      }
    });

    const sortedAttackTypes = Object.entries(attackTypes).sort((a, b) => b[1] - a[1]);
    const mostCommonAttack = sortedAttackTypes.length > 0 ? sortedAttackTypes[0][0] : "—";

    // Sort by date descending (assuming ISO format YYYY-MM-DD or full timestamp in published_date)
    const recent = [...threats].sort((a, b) => {
      return new Date(b.published_date || 0).getTime() - new Date(a.published_date || 0).getTime();
    }).slice(0, 5);

    return { total: threats.length, severities, mostCommonAttack, recent };
  }, [threats]);

  if (!threats || !threats.length) return null;

  const sevColors: Record<string, string> = {
    critical: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
    high: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]", 
    medium: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]",
    low: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
  };

  const getBarWidth = (val: number, max: number) => {
    return max > 0 ? Math.max(2, (val / max) * 100) : 0;
  };

  return (
    <div className="bg-[#0b0b0e] border border-gray-800/80 rounded-xl p-6 flex flex-col lg:flex-row gap-8 shadow-[0_0_30px_rgba(34,211,238,0.03)]">
      {/* Metrics & Distribution */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-2 mb-4 text-cyan-400">
          <PieChart size={18} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-cyan-400">Global Threat Insights</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900/40 rounded-lg border border-gray-800">
            <p className="text-[10px] text-gray-500 font-mono uppercase mb-1 tracking-widest">Total Dataset</p>
            <p className="text-2xl font-bold font-mono text-white tabular-nums">{stats.total}</p>
          </div>
          <div className="p-4 bg-cyan-900/10 rounded-lg border border-cyan-900/30">
            <p className="text-[10px] text-cyan-600/70 font-mono uppercase mb-1 tracking-widest">Top Vector</p>
            <p className="text-lg font-bold font-mono text-cyan-400 truncate tracking-wide uppercase">
              {stats.mostCommonAttack}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Density Distribution</p>
          {(["critical", "high", "medium", "low"] as const).map(sev => {
            const count = stats.severities[sev];
            const width = getBarWidth(count, stats.total);
            const percentage = count > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={sev} className="flex items-center gap-4 group">
                <span className={`w-16 text-[10px] font-mono uppercase text-gray-400 group-hover:text-white transition-colors`}>{sev}</span>
                <div className="flex-1 h-1.5 bg-gray-900/80 rounded-full overflow-hidden">
                  <div className={`h-full ${sevColors[sev]} transition-all duration-1000 ease-out`} style={{ width: `${width}%` }} />
                </div>
                <div className="w-16 flex justify-between text-[10px] font-mono">
                  <span className="text-gray-300">{count}</span>
                  <span className="text-gray-600">{percentage}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Threats */}
      <div className="flex-1 lg:pl-8 lg:border-l border-gray-800/80">
        <div className="flex items-center gap-2 mb-4 text-cyan-400">
          <List size={18} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-cyan-400">Latest Pulse Streams</h2>
        </div>
        <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 break-words">
          {stats.recent.map((t, i) => (
            <div key={i} className="flex gap-3 items-start group">
              <div className="mt-0.5">
                {t.severity === "critical" ? (
                  <Skull size={14} className="text-red-500 animate-pulse" />
                ) : (
                  <AlertTriangle size={14} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-gray-300 break-words group-hover:text-white transition-colors">
                  {t.cve_id} <span className="text-gray-600 opacity-60">[{t.source}]</span>
                </p>
                <p className="text-[10px] font-mono text-gray-500 break-words mt-1 line-clamp-2">
                  {t.description || "No vulnerability context provided"}
                </p>
              </div>
              <div className="text-[10px] font-mono text-gray-600 whitespace-nowrap opacity-60">
                {t.published_date}
              </div>
            </div>
          ))}
          {stats.recent.length === 0 && (
            <p className="text-xs font-mono text-gray-600">Awaiting intelligence packet streams...</p>
          )}
        </div>
      </div>
    </div>
  );
}
