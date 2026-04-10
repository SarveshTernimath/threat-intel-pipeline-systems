"use client";

import { Threat, Severity } from "@/types";
import { ShieldAlert, ShieldOff } from "lucide-react";

interface Props {
  threats: Threat[];
  isLoading: boolean;
  error: string | null;
  searched: boolean;
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || "unknown").toLowerCase();
  const cls =
    s === "critical" ? "sev-critical" :
    s === "high"     ? "sev-high" :
    s === "medium"   ? "sev-medium" :
    s === "low"      ? "sev-low" :
                       "sev-unknown";
  const dot =
    s === "critical" ? "#ff4757" :
    s === "high"     ? "#ff7f11" :
    s === "medium"   ? "#ffd32a" :
    s === "low"      ? "#00e5ff" :
                       "#64748b";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: dot, boxShadow: `0 0 4px ${dot}` }} />
      {s.toUpperCase()}
    </span>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldOff className="text-gray-800 mb-4" size={52} strokeWidth={1} />
      <p className="text-gray-600 font-mono text-sm">
        {searched ? "No threats matched your query." : "Enter a keyword to scan the threat database."}
      </p>
      {searched && (
        <p className="text-gray-700 font-mono text-xs mt-2">
          Try broader terms like &quot;sql&quot;, &quot;xss&quot;, or &quot;rce&quot;
        </p>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldAlert className="text-red-900 mb-4" size={52} strokeWidth={1} />
      <p className="text-red-500 font-mono text-sm font-bold tracking-widest">CONNECTION FAILURE</p>
      <p className="text-gray-600 font-mono text-xs mt-2 max-w-md">{message}</p>
    </div>
  );
}

const COLS = ["CVE ID", "Description", "Severity", "Source", "Date"];

export default function ThreatTable({ threats, isLoading, error, searched }: Props) {
  if (isLoading) return null;
  if (error) return <ErrorState message={error} />;
  if (threats.length === 0) return <EmptyState searched={searched} />;

  return (
    <div
      className="w-full overflow-x-auto rounded-xl"
      style={{
        border: "1px solid rgba(0,229,255,0.08)",
        background: "rgba(4, 10, 22, 0.8)",
      }}
    >
      <table className="w-full text-sm font-mono min-w-[800px]">
        <thead>
          <tr
            style={{
              background: "rgba(0,229,255,0.04)",
              borderBottom: "1px solid rgba(0,229,255,0.1)",
            }}
          >
            {COLS.map((col) => (
              <th
                key={col}
                className="px-5 py-3 text-left text-[9px] uppercase tracking-widest font-semibold whitespace-nowrap"
                style={{ color: "rgba(0,229,255,0.4)" }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {threats.map((t, i) => (
            <tr
              key={`${t.cve_id}-${i}`}
              className="cyber-row group"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            >
              <td className="px-5 py-4 whitespace-nowrap relative z-10">
                <span
                  className="font-bold text-xs transition-all duration-200 group-hover:text-red-300"
                  style={{
                    color: "#ff6b78",
                    textShadow: "0 0 8px rgba(255,71,87,0.4)",
                  }}
                >
                  {t.cve_id || "—"}
                </span>
              </td>
              <td className="px-5 py-4 max-w-xs relative z-10">
                <p className="text-gray-400 leading-relaxed line-clamp-2 text-xs group-hover:text-gray-300 transition-colors">
                  {t.description || "No description available."}
                </p>
                {t.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.keywords.slice(0, 3).map((kw, kwIndex) => (
                      <span
                        key={`${kw}-${kwIndex}`}
                        className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                        style={{
                          background: "rgba(0,229,255,0.06)",
                          border: "1px solid rgba(0,229,255,0.12)",
                          color: "rgba(0,229,255,0.5)",
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-5 py-4 whitespace-nowrap relative z-10">
                <SeverityBadge severity={t.severity} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap relative z-10">
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-mono"
                  style={{
                    background: "rgba(192,132,252,0.08)",
                    border: "1px solid rgba(192,132,252,0.18)",
                    color: "rgba(192,132,252,0.7)",
                  }}
                >
                  {t.source || "—"}
                </span>
              </td>
              <td className="px-5 py-4 whitespace-nowrap relative z-10">
                <span className="text-[10px] font-mono text-gray-600">
                  {t.published_date || "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
