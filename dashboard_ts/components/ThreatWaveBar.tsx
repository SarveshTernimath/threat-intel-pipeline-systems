"use client";

interface ThreatWaveBarProps {
  threatCount: number;
  criticalCount: number;
}

export default function ThreatWaveBar({ threatCount, criticalCount }: ThreatWaveBarProps) {
  // Amplitude scales 0–40 based on threat count (max 100 threats = full amplitude)
  const amplitude = Math.min(40, Math.max(8, (threatCount / 100) * 40));
  // Glow intensity scales with critical count
  const glowOpacity = Math.min(0.8, 0.2 + (criticalCount / Math.max(threatCount, 1)) * 0.6);
  const glowColor = `rgba(255, 0, 0, ${glowOpacity})`;

  const mid = 50; // vertical center of viewBox (100 height)

  // Build a multi-segment sine-like path for the wave
  const wavePath = `M0,${mid} Q150,${mid - amplitude} 300,${mid} T600,${mid} T900,${mid} T1200,${mid}`;
  const wavePath2 = `M0,${mid} Q150,${mid + amplitude} 300,${mid} T600,${mid} T900,${mid} T1200,${mid}`;
  const wavePath3 = `M0,${mid} Q150,${mid - amplitude} 300,${mid} T600,${mid} T900,${mid} T1200,${mid}`;

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{
        height: 56,
        marginTop: 4,
        borderTop: "1px solid rgba(255,0,0,0.1)",
        background: "rgba(5,0,0,0.5)",
        borderRadius: "0 0 10px 10px",
      }}
      aria-label="Threat wave intensity visualizer"
    >
      {/* Glow overlay synced with threat intensity */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${glowColor}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <svg
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ display: "block" }}
      >
        <defs>
          <filter id="waveGlow" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="waveGradH" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,0,0,0)" />
            <stop offset="20%" stopColor="#ff1a1a" />
            <stop offset="80%" stopColor="#ff1a1a" />
            <stop offset="100%" stopColor="rgba(255,0,0,0)" />
          </linearGradient>
        </defs>

        {/* Background fill glow under wave */}
        <path
          d={`${wavePath} L1200,100 L0,100 Z`}
          fill="rgba(255,0,0,0.04)"
        />

        {/* Secondary faint wave (phase-shifted for depth) */}
        <path
          d={wavePath2}
          fill="none"
          stroke="rgba(255,0,0,0.15)"
          strokeWidth={1.2}
          opacity={0.5}
        >
          <animate
            attributeName="d"
            dur="5s"
            repeatCount="indefinite"
            values={`${wavePath2};${wavePath3};${wavePath2}`}
          />
        </path>

        {/* Main neon red wave */}
        <path
          d={wavePath}
          fill="none"
          stroke="url(#waveGradH)"
          strokeWidth={2.5}
          filter="url(#waveGlow)"
          style={{ filter: "drop-shadow(0 0 6px #ff0000)" }}
        >
          <animate
            attributeName="d"
            dur="3s"
            repeatCount="indefinite"
            values={`${wavePath};${wavePath2};${wavePath}`}
          />
        </path>

        {/* Center pulse dot */}
        <circle cx={600} cy={mid} r={3} fill="#ff0000" style={{ filter: "drop-shadow(0 0 5px #ff0000)" }}>
          <animate attributeName="r" values="3;5;3" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.4;1" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Label */}
      <div
        className="absolute bottom-1 right-3 flex items-center gap-2"
        style={{ pointerEvents: "none" }}
      >
        <span
          className="font-mono"
          style={{ fontSize: 8, color: "rgba(255,0,0,0.35)", letterSpacing: "0.1em" }}
        >
          THREAT INTENSITY · {threatCount} GEO-TAGGED · {criticalCount} CRITICAL
        </span>
      </div>
    </div>
  );
}
