"use client";

import { Severity } from "@/types";

interface Props {
  selected: Severity | "all";
  onChange: (val: Severity | "all") => void;
  counts: Record<string, number>;
}

const LEVELS: { label: string; value: Severity | "all"; color: string; dot: string }[] = [
  { label: "All",      value: "all",      color: "border-gray-600 text-gray-300 hover:border-gray-400",       dot: "bg-gray-400" },
  { label: "Critical", value: "critical", color: "border-red-700 text-red-400 hover:border-red-500",           dot: "bg-red-500"  },
  { label: "High",     value: "high",     color: "border-orange-700 text-orange-400 hover:border-orange-500",  dot: "bg-orange-500" },
  { label: "Medium",   value: "medium",   color: "border-yellow-700 text-yellow-400 hover:border-yellow-500",  dot: "bg-yellow-500" },
  { label: "Low",      value: "low",      color: "border-green-800 text-green-400 hover:border-green-600",     dot: "bg-green-500" },
];

const ACTIVE: Record<string, string> = {
  all:      "bg-gray-800 border-gray-400 text-white",
  critical: "bg-red-900/40 border-red-500 text-red-300",
  high:     "bg-orange-900/40 border-orange-500 text-orange-300",
  medium:   "bg-yellow-900/30 border-yellow-500 text-yellow-300",
  low:      "bg-green-900/30 border-green-600 text-green-300",
};

export default function SeverityFilter({ selected, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-600 font-mono uppercase tracking-widest mr-1">Filter:</span>
      {LEVELS.map(({ label, value, color, dot }) => {
        const isActive = selected === value;
        const count = value === "all"
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[value] ?? 0);

        return (
          <button
            key={value}
            id={`filter-${value}`}
            onClick={() => onChange(value)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono
              transition-all duration-200
              ${isActive ? ACTIVE[value] : `bg-transparent ${color}`}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
            {count > 0 && (
              <span className="opacity-60 text-[10px]">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
