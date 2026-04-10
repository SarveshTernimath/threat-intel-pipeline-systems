"use client";

import { useMemo } from "react";
import { Threat } from "@/types";
import { Activity } from "lucide-react";

interface ThreatWaveChartProps {
  threats: Threat[];
}

export default function ThreatWaveChart({ threats }: ThreatWaveChartProps) {
  const chartData = useMemo(() => {
    const groups: Record<string, { total: number; critical: number; high: number }> = {};

    threats.forEach((t) => {
      const date = (t.published_date || "").slice(0, 10);
      if (!date || date.length < 8) return;
      if (!groups[date]) groups[date] = { total: 0, critical: 0, high: 0 };
      groups[date].total++;
      const sev = (t.severity || "low").toLowerCase();
      if (sev === "critical") groups[date].critical++;
      else if (sev === "high") groups[date].high++;
    });

    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-20);
  }, [threats]);

  if (chartData.length < 2) return null;

  const W = 1000;
  const H = 140;
  const padX = 8;
  const padY = 16;
  const innerH = H - padY * 2;
  const innerW = W - padX * 2;

  const totals = chartData.map(([, v]) => v.total);
  const critTotals = chartData.map(([, v]) => v.critical);
  const maxVal = Math.max(...totals, 1);

  const toX = (i: number) => padX + (i / (chartData.length - 1)) * innerW;
  const toY = (v: number) => padY + (1 - v / maxVal) * innerH;

  const buildSmoothPath = (values: number[]) => {
    if (values.length < 2) return "";
    let d = `M ${toX(0)} ${toY(values[0])}`;
    for (let i = 1; i < values.length; i++) {
      const x0 = toX(i - 1), y0 = toY(values[i - 1]);
      const x1 = toX(i), y1 = toY(values[i]);
      const cpx = (x0 + x1) / 2;
      d += ` C ${cpx} ${y0}, ${cpx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(totals);
  const areaPath = `${linePath} L ${toX(chartData.length - 1)} ${H} L ${toX(0)} ${H} Z`;
  const critLine = buildSmoothPath(critTotals);
  const critArea = `${critLine} L ${toX(chartData.length - 1)} ${H} L ${toX(0)} ${H} Z`;

  const tickIndices = [0, Math.floor(chartData.length / 2), chartData.length - 1];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-red-500" />
          <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest">
            Threat Activity Timeline
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-gray-600">
            <span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Total
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-gray-600">
            <span className="w-3 h-0.5 bg-red-800 inline-block rounded" /> Critical
          </span>
        </div>
      </div>

      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          background: "rgba(5, 0, 0, 0.9)",
          border: "1px solid rgba(255, 0, 0, 0.12)",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: 120, display: "block" }}
        >
          <defs>
            {/* Main red gradient fill */}
            <linearGradient id="redAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff0000" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ff0000" stopOpacity="0.01" />
            </linearGradient>
            {/* Critical darker red fill */}
            <linearGradient id="critRedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cc0000" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#cc0000" stopOpacity="0.01" />
            </linearGradient>
            {/* Red line gradient */}
            <linearGradient id="redLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff0000" />
              <stop offset="100%" stopColor="#ff4d4d" />
            </linearGradient>
            {/* Neon red glow filter */}
            <filter id="redNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="subtleRedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <line
              key={pct}
              x1={0} y1={toY(maxVal * pct)} x2={W} y2={toY(maxVal * pct)}
              stroke="rgba(255,0,0,0.07)" strokeWidth={1}
            />
          ))}

          {/* Tick verticals */}
          {tickIndices.map((idx) => (
            <line
              key={idx}
              x1={toX(idx)} y1={padY} x2={toX(idx)} y2={H}
              stroke="rgba(255,0,0,0.08)" strokeWidth={1} strokeDasharray="3,3"
            />
          ))}

          {/* Area fills */}
          <path d={areaPath} fill="url(#redAreaGrad)" />
          <path d={critArea} fill="url(#critRedGrad)" />

          {/* Main neon red line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#redLineGrad)"
            strokeWidth={2.5}
            filter="url(#redNeonGlow)"
            style={{ filter: "drop-shadow(0 0 8px #ff0000)" }}
          />

          {/* Critical line */}
          <path
            d={critLine}
            fill="none"
            stroke="#cc0000"
            strokeWidth={1.4}
            filter="url(#subtleRedGlow)"
            opacity={0.75}
          />

          {/* Glow dots on main line */}
          {totals.map((v, i) =>
            tickIndices.includes(i) ? (
              <circle
                key={i}
                cx={toX(i)} cy={toY(v)} r={3.5}
                fill="#ff0000"
                style={{ filter: "drop-shadow(0 0 6px red)" }}
              />
            ) : (
              <circle
                key={i}
                cx={toX(i)} cy={toY(v)} r={1.8}
                fill="#ff4d4d"
                opacity={0.5}
              />
            )
          )}

          {/* Y-axis value labels */}
          {[0.5, 1].map((pct) => (
            <text
              key={pct}
              x={W - 4} y={toY(maxVal * pct) - 3}
              textAnchor="end"
              fill="rgba(255,0,0,0.25)"
              fontSize={8}
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.round(maxVal * pct)}
            </text>
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between px-2 pb-2">
          {tickIndices.map((idx) => (
            <span key={idx} className="text-[8px] font-mono text-red-900">
              {chartData[idx]?.[0]?.slice(5) ?? ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
