"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, AlertTriangle, Activity, Crosshair } from "lucide-react";

interface StatsCardsProps {
  total: number;
  critical: number;
  high: number;
  latestAttackType: string;
}

// Animates a number from 0 to `target` over `duration` ms
function useAnimatedCounter(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

interface CardConfig {
  label: string;
  numericValue?: number;
  textValue?: string;
  icon: React.ElementType;
  color: string;
  glowClass: string;
  borderClass: string;
  bgClass: string;
  iconBg: string;
}

function StatCard({
  label,
  numericValue,
  textValue,
  icon: Icon,
  color,
  glowClass,
  borderClass,
  bgClass,
  iconBg,
}: CardConfig) {
  const animated = useAnimatedCounter(numericValue ?? 0);

  return (
    <div
      className={`
        relative overflow-hidden
        ${bgClass} ${borderClass} border rounded-xl p-5
        flex items-center gap-4
        transition-all duration-300
        hover:scale-[1.02]
        group
        ${glowClass}
      `}
    >
      {/* Background glow blob */}
      <div
        className={`
          absolute inset-0 opacity-0 group-hover:opacity-100
          transition-opacity duration-500
          pointer-events-none
          ${bgClass.replace("bg-[", "bg-").replace("]", "")}
        `}
        aria-hidden="true"
      />

      <div className={`relative z-10 p-2.5 rounded-lg ${iconBg} shrink-0`}>
        <Icon className={color} size={20} />
      </div>

      <div className="relative z-10 min-w-0">
        {textValue !== undefined ? (
          <p
            className={`text-lg font-bold font-mono ${color} truncate max-w-[140px]`}
            title={textValue}
          >
            {textValue || "—"}
          </p>
        ) : (
          <p className={`text-2xl font-bold font-mono ${color} tabular-nums`}>
            {animated}
          </p>
        )}
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest mt-0.5">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function StatsCards({
  total,
  critical,
  high,
  latestAttackType,
}: StatsCardsProps) {
  const cards: CardConfig[] = [
    {
      label: "Total Threats",
      numericValue: total,
      icon: Shield,
      color: "text-red-400",
      glowClass: "stats-glow-red",
      borderClass: "border-red-900/40 hover:border-red-700/60",
      bgClass: "bg-[#0d0d10]",
      iconBg: "bg-red-900/20",
    },
    {
      label: "Critical",
      numericValue: critical,
      icon: AlertTriangle,
      color: "text-red-500",
      glowClass: "stats-glow-red-bright",
      borderClass: "border-red-800/50 hover:border-red-600/70",
      bgClass: "bg-[#0d0d10]",
      iconBg: "bg-red-900/30",
    },
    {
      label: "High",
      numericValue: high,
      icon: Activity,
      color: "text-orange-400",
      glowClass: "stats-glow-orange",
      borderClass: "border-orange-900/40 hover:border-orange-700/60",
      bgClass: "bg-[#0d0d10]",
      iconBg: "bg-orange-900/20",
    },
    {
      label: "Latest Attack Type",
      textValue: latestAttackType,
      icon: Crosshair,
      color: "text-cyan-400",
      glowClass: "stats-glow-cyan",
      borderClass: "border-cyan-900/40 hover:border-cyan-700/60",
      bgClass: "bg-[#0d0d10]",
      iconBg: "bg-cyan-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
