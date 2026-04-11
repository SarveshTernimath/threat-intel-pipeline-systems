"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, AlertTriangle, Activity, Crosshair } from "lucide-react";

interface StatsCardsProps {
  total: number;
  critical: number;
  high: number;
  latestAttackType: string;
}

function useAnimatedCounter(target: number, duration = 700): number {
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
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

interface CardConfig {
  label: string;
  sublabel: string;
  numericValue?: number;
  textValue?: string;
  icon: React.ElementType;
  accentColor: string;
  glowColor: string;
  borderColor: string;
  bgGradient: string;
  glowClass: string;
}

function StatCard({ label, sublabel, numericValue, textValue, icon: Icon, accentColor, glowColor, borderColor, bgGradient, glowClass }: CardConfig) {
  const animated = useAnimatedCounter(numericValue ?? 0);

  return (
    <div
      className={`relative overflow-hidden rounded-xl p-5 flex items-center gap-4 transition-all duration-300 hover:scale-[1.02] group cursor-default ${glowClass}`}
      style={{
        background: bgGradient,
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Top shimmer line */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />

      {/* Corner accent */}
      <div
        className="absolute top-0 right-0 w-12 h-12 opacity-10"
        style={{ background: `radial-gradient(circle at top right, ${accentColor}, transparent 70%)` }}
      />

      {/* Icon */}
      <div
        className="relative z-10 p-2.5 rounded-lg shrink-0 transition-all duration-300 group-hover:scale-110"
        style={{
          background: `${accentColor}18`,
          border: `1px solid ${accentColor}30`,
          boxShadow: `0 0 12px ${glowColor}`,
        }}
      >
        <Icon style={{ color: accentColor }} size={18} />
      </div>

      {/* Value */}
      <div className="relative z-10 min-w-0 flex-1">
        {textValue !== undefined ? (
          <p
            className="text-base font-bold font-mono truncate max-w-[130px] transition-all duration-300"
            style={{ color: accentColor, textShadow: `0 0 12px ${glowColor}` }}
            title={textValue}
          >
            {textValue || "—"}
          </p>
        ) : (
          <p
            className="text-2xl font-bold font-mono tabular-nums transition-all duration-300"
            style={{ color: accentColor, textShadow: `0 0 14px ${glowColor}` }}
          >
            {animated.toLocaleString()}
          </p>
        )}
        <p className="text-[14px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">{label}</p>
        <p className="text-[14px] text-gray-300 font-mono mt-0.5">{sublabel}</p>
      </div>

      {/* Hover glow veil */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
        style={{ background: `radial-gradient(ellipse at center, ${accentColor}08, transparent 70%)` }}
      />
    </div>
  );
}

export default function StatsCards({ total, critical, high, latestAttackType }: StatsCardsProps) {
  const cards: CardConfig[] = [
    {
      label: "Total Threats",
      sublabel: "All sources · live",
      numericValue: total,
      icon: Shield,
      accentColor: "#ff4757",
      glowColor: "rgba(255,71,87,0.4)",
      borderColor: "rgba(255,71,87,0.2)",
      bgGradient: "linear-gradient(135deg, rgba(255,71,87,0.06) 0%, rgba(10,18,36,0.9) 100%)",
      glowClass: "stats-glow-red",
    },
    {
      label: "Critical",
      sublabel: "Immediate action",
      numericValue: critical,
      icon: AlertTriangle,
      accentColor: "#ff2d3a",
      glowColor: "rgba(255,45,58,0.5)",
      borderColor: "rgba(255,45,58,0.25)",
      bgGradient: "linear-gradient(135deg, rgba(255,45,58,0.09) 0%, rgba(10,18,36,0.9) 100%)",
      glowClass: "stats-glow-red-bright",
    },
    {
      label: "High Severity",
      sublabel: "Priority escalation",
      numericValue: high,
      icon: Activity,
      accentColor: "#ff7f11",
      glowColor: "rgba(255,127,17,0.4)",
      borderColor: "rgba(255,127,17,0.2)",
      bgGradient: "linear-gradient(135deg, rgba(255,127,17,0.06) 0%, rgba(10,18,36,0.9) 100%)",
      glowClass: "stats-glow-orange",
    },
    {
      label: "Latest Vector",
      sublabel: "Attack classification",
      textValue: latestAttackType,
      icon: Crosshair,
      accentColor: "#00e5ff",
      glowColor: "rgba(0,229,255,0.35)",
      borderColor: "rgba(0,229,255,0.18)",
      bgGradient: "linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(10,18,36,0.9) 100%)",
      glowClass: "stats-glow-cyan",
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
