"use client";

import { Severity } from "@/types";

interface Props {
  selected: Severity | "all";
  onChange: (val: Severity | "all") => void;
  counts: Record<string, number>;
}

const LEVELS: {
  label: string;
  value: Severity | "all";
  accent: string;
  glow: string;
}[] = [
  { label: "All",      value: "all",      accent: "rgba(148,163,184,0.7)", glow: "rgba(148,163,184,0.2)" },
  { label: "Critical", value: "critical", accent: "#ff4757",               glow: "rgba(255,71,87,0.3)"   },
  { label: "High",     value: "high",     accent: "#ff7f11",               glow: "rgba(255,127,17,0.3)"  },
  { label: "Medium",   value: "medium",   accent: "#ffd32a",               glow: "rgba(255,211,42,0.25)" },
  { label: "Low",      value: "low",      accent: "#00e5ff",               glow: "rgba(0,229,255,0.25)"  },
];

export default function SeverityFilter({ selected, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[9px] text-gray-700 font-mono uppercase tracking-widest mr-1">Filter:</span>
      {LEVELS.map(({ label, value, accent, glow }) => {
        const isActive = selected === value;
        const count =
          value === "all"
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[value] ?? 0);

        return (
          <button
            key={value}
            id={`filter-${value}`}
            onClick={() => onChange(value)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[9px] font-mono font-semibold tracking-wider transition-all duration-200"
            style={{
              background: isActive ? `${accent}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${isActive ? accent : "rgba(255,255,255,0.07)"}`,
              color: isActive ? accent : "rgba(148,163,184,0.5)",
              boxShadow: isActive ? `0 0 12px ${glow}` : "none",
              transform: isActive ? "scale(1.02)" : "scale(1)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isActive ? accent : "rgba(148,163,184,0.3)",
                boxShadow: isActive ? `0 0 5px ${accent}` : "none",
              }}
            />
            {label}
            {count > 0 && (
              <span
                className="text-[8px] rounded px-1 py-0.5"
                style={{
                  background: isActive ? `${accent}22` : "rgba(255,255,255,0.05)",
                  color: isActive ? accent : "rgba(148,163,184,0.4)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
