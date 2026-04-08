"use client";

import { Threat, Severity } from "@/types";
import { ShieldAlert, ShieldOff } from "lucide-react";

interface Props {
  threats: Threat[];
  isLoading: boolean;
  error: string | null;
  searched: boolean;
}

const SEVERITY_STYLES: Record<Severity | string, string> = {
  critical: "bg-red-900/50 text-red-400 border border-red-700/60",
  high:     "bg-orange-900/40 text-orange-400 border border-orange-700/50",
  medium:   "bg-yellow-900/30 text-yellow-400 border border-yellow-700/50",
  low:      "bg-green-900/30 text-green-400 border border-green-700/50",
  unknown:  "bg-gray-800 text-gray-400 border border-gray-700",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-yellow-400",
  low:      "bg-green-500",
  unknown:  "bg-gray-500",
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || "unknown").toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold ${SEVERITY_STYLES[s] ?? SEVERITY_STYLES.unknown}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[s] ?? SEVERITY_DOT.unknown}`} />
      {s.toUpperCase()}
    </span>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldOff className="text-gray-700 mb-4" size={48} strokeWidth={1} />
      <p className="text-gray-500 font-mono text-sm">
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
      <ShieldAlert className="text-red-700 mb-4" size={48} strokeWidth={1} />
      <p className="text-red-500 font-mono text-sm font-semibold">CONNECTION FAILURE</p>
      <p className="text-gray-600 font-mono text-xs mt-2 max-w-md">{message}</p>
    </div>
  );
}

const COLS = ["CVE ID", "Description", "Severity", "Source", "Date"];

export default function ThreatTable({ threats, isLoading, error, searched }: Props) {
  if (isLoading) return null; // SkeletonLoader rendered above in page.tsx

  if (error) return <ErrorState message={error} />;

  if (threats.length === 0) return <EmptyState searched={searched} />;

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm font-mono min-w-[800px]">
        <thead>
          <tr className="bg-[#0d0d0f] border-b border-gray-800">
            {COLS.map((col) => (
              <th
                key={col}
                className="px-5 py-3 text-left text-xs text-gray-600 uppercase tracking-widest font-semibold whitespace-nowrap"
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
              className="
                border-b border-gray-900/60 bg-[#0a0a0c]
                hover:bg-[#111116] transition-colors duration-150
                group
              "
            >
              <td className="px-5 py-4 whitespace-nowrap">
                <span className="text-red-400 font-semibold group-hover:text-red-300 transition-colors">
                  {t.cve_id || "—"}
                </span>
              </td>
              <td className="px-5 py-4 max-w-xs">
                <p className="text-gray-300 leading-relaxed line-clamp-2 text-xs">
                  {t.description || "No description available."}
                </p>
                {t.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.keywords.slice(0, 4).map((kw, kwIndex) => (
                      <span
                        key={`${kw}-${kwIndex}`}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900 text-gray-500 border border-gray-800"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-5 py-4 whitespace-nowrap">
                <SeverityBadge severity={t.severity} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-gray-400 text-xs">
                {t.source || "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-gray-500 text-xs">
                {t.published_date || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
