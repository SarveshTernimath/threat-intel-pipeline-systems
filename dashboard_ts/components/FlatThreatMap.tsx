"use client";

import { useMemo, useRef, useState } from "react";

interface FlatThreatMapProps {
  threats: any[];
}

const SEV_STYLE: Record<string, { color: string; glow: string; size: number; ring: string }> = {
  critical: { color: "#ff4757", glow: "rgba(255,71,87,0.9)",   size: 7, ring: "rgba(255,71,87,0.25)" },
  high:     { color: "#ff7f11", glow: "rgba(255,127,17,0.9)",  size: 5, ring: "rgba(255,127,17,0.2)" },
  medium:   { color: "#ffd32a", glow: "rgba(255,211,42,0.8)",  size: 4, ring: "rgba(255,211,42,0.15)" },
  low:      { color: "#00e5ff", glow: "rgba(0,229,255,0.7)",   size: 3, ring: "rgba(0,229,255,0.12)" },
};

function getSevStyle(sev: string) {
  return SEV_STYLE[(sev || "low").toLowerCase()] ?? SEV_STYLE.low;
}

export default function FlatThreatMap({ threats }: FlatThreatMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ threat: any; x: number; y: number } | null>(null);

  const geoThreats = useMemo(
    () => threats.filter((t: any) => t.lat != null && t.lng != null).slice(0, 200),
    [threats]
  );

  // Equirectangular projection: earth-dark.jpg IS equirectangular so coords map directly
  const toPos = (lat: number, lng: number) => ({
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height: 420, background: "#020811" }}
    >
      {/* Equirectangular world map background (same texture as globe, flattened) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://unpkg.com/three-globe@2.31.1/example/img/earth-dark.jpg"
        alt="World Map"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "fill", opacity: 0.55, userSelect: "none", pointerEvents: "none" }}
        draggable={false}
      />

      {/* Lat/Lng grid overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 500"
        preserveAspectRatio="none"
      >
        {/* Latitude lines */}
        {[-60, -40, -20, 0, 20, 40, 60].map((lat) => {
          const y = ((90 - lat) / 180) * 500;
          return (
            <line
              key={lat}
              x1={0} y1={y} x2={1000} y2={y}
              stroke={lat === 0 ? "rgba(0,229,255,0.2)" : "rgba(0,229,255,0.06)"}
              strokeWidth={1}
              strokeDasharray={lat === 0 ? "0" : "4,6"}
            />
          );
        })}
        {/* Longitude lines */}
        {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lng) => {
          const x = ((lng + 180) / 360) * 1000;
          return (
            <line
              key={lng}
              x1={x} y1={0} x2={x} y2={500}
              stroke={lng === 0 ? "rgba(0,229,255,0.2)" : "rgba(0,229,255,0.06)"}
              strokeWidth={1}
              strokeDasharray={lng === 0 ? "0" : "4,6"}
            />
          );
        })}
      </svg>

      {/* Threat markers */}
      {geoThreats.map((t: any, i: number) => {
        const { x, y } = toPos(t.lat, t.lng);
        const style = getSevStyle(t.severity);
        return (
          <div
            key={`${t.cve_id}-${i}`}
            className="absolute threat-dot-2d"
            style={{ left: `${x}%`, top: `${y}%` }}
            onMouseEnter={() => setTooltip({ threat: t, x, y })}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Pulsing ring */}
            <div
              className="absolute rounded-full animate-ping"
              style={{
                width: style.size * 3.5,
                height: style.size * 3.5,
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                background: style.ring,
                border: `1px solid ${style.color}55`,
                animationDuration:
                  t.severity === "critical" ? "0.9s" : t.severity === "high" ? "1.4s" : "2.2s",
              }}
            />
            {/* Core dot */}
            <div
              className="relative rounded-full"
              style={{
                width: style.size,
                height: style.size,
                background: style.color,
                boxShadow: `0 0 6px ${style.glow}, 0 0 14px ${style.glow}`,
              }}
            />
          </div>
        );
      })}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none animate-slide-in-right"
          style={{
            left: tooltip.x > 75 ? "auto" : `calc(${tooltip.x}% + 10px)`,
            right: tooltip.x > 75 ? `calc(${100 - tooltip.x}% + 10px)` : "auto",
            top: tooltip.y > 70 ? "auto" : `calc(${tooltip.y}% + 10px)`,
            bottom: tooltip.y > 70 ? `calc(${100 - tooltip.y}% + 10px)` : "auto",
          }}
        >
          <div className="glass-card px-3 py-2 min-w-[180px] border-cyan-500/30 text-[10px] font-mono">
            <p className="text-red-400 font-bold mb-1">{tooltip.threat.cve_id || "—"}</p>
            <p className="text-gray-400">
              <span className="text-gray-600 uppercase">LOC: </span>
              {tooltip.threat.country || "Unknown"}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-600 uppercase">SEV: </span>
              <span className={
                tooltip.threat.severity === "critical" ? "text-red-400" :
                tooltip.threat.severity === "high" ? "text-orange-400" :
                tooltip.threat.severity === "medium" ? "text-yellow-400" : "text-cyan-400"
              }>
                {(tooltip.threat.severity || "low").toUpperCase()}
              </span>
            </p>
            {tooltip.threat.attack_type && (
              <p className="text-gray-400">
                <span className="text-gray-600 uppercase">VEC: </span>
                {tooltip.threat.attack_type}
              </p>
            )}
          </div>
        </div>
      )}

      {/* HUD Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-cyan-900/60 rounded backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,229,255,1)]" />
          <span className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase font-semibold">
            2D Threat Radar
          </span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between">
        <div className="flex gap-3">
          {(["critical","high","medium","low"] as const).map((s) => {
            const count = geoThreats.filter((t: any) => (t.severity||"low").toLowerCase() === s).length;
            const style = getSevStyle(s);
            if (!count) return null;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.color, boxShadow: `0 0 5px ${style.glow}` }} />
                <span className="text-[9px] font-mono text-gray-500 uppercase">{s} <span style={{ color: style.color }}>{count}</span></span>
              </div>
            );
          })}
        </div>
        <span className="text-[9px] font-mono text-gray-700">{geoThreats.length} GEO TARGETS</span>
      </div>

      {/* No data overlay */}
      {geoThreats.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-cyan-900 font-mono text-sm animate-pulse">
            Awaiting geo-tagged threat streams...
          </span>
        </div>
      )}

      {/* Vignette */}
      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
        boxShadow: "inset 0 0 80px rgba(0,0,0,0.75)",
      }} />
    </div>
  );
}
