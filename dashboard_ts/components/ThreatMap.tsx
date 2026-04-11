"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import FlatThreatMap from "./FlatThreatMap";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#020811]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-900 border-t-cyan-400 animate-spin" />
        <span className="text-cyan-800 font-mono text-base tracking-widest animate-pulse">
          INITIALIZING GLOBAL RADAR
        </span>
      </div>
    </div>
  ),
});

interface ThreatMapProps {
  threats?: any[];
}

export default function ThreatMap({ threats = [] }: ThreatMapProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastElementClickRef = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 420 });
  const [mapMode, setMapMode] = useState<"3d" | "2d">("3d");

  // Interaction states
  const [hoverArc, setHoverArc] = useState<any>(null);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: 420 });
      }
    };
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleGlobeReady = () => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.enablePan = true;
      controls.autoRotateSpeed = 1.8;
      controls.enableZoom = true;
    }
  };

  const geoThreats = useMemo(() => {
    return threats.filter((t: any) => t.lat && t.lng);
  }, [threats]);

  const { arcsData, pointsData, ringsData } = useMemo(() => {
    if (!geoThreats || geoThreats.length === 0) {
      return { arcsData: [], pointsData: [], ringsData: [] };
    }

    const arcs = geoThreats
      .slice(0, 100)
      .map((threat: any, index: number) => {
        const nextThreat = geoThreats[index + 1];
        if (!nextThreat) return null;
        const sev = (threat.severity || "low").toLowerCase();
        // Premium neon color palette
        const color =
          sev === "critical" ? "#ff4757" :
          sev === "high"     ? "#ff7f11" :
          sev === "medium"   ? "#ffd32a" :
                               "#00e5ff";
        const sizeLevel = sev === "critical" ? 4 : sev === "high" ? 3 : sev === "medium" ? 2 : 1;

        return {
          startLat: threat.lat,
          startLng: threat.lng,
          endLat: nextThreat.lat,
          endLng: nextThreat.lng,
          color,
          sizeLevel,
          arcAlt: 0.28,
          animTime: sev === "critical" ? 1400 : sev === "high" ? 1600 : 1900,
          threat_data: {
            ...threat,
            realIP: threat.iocs?.ips?.[0] || "",
            location: threat.country || "",
            targetLat: nextThreat.lat.toFixed(4),
            targetLng: nextThreat.lng.toFixed(4),
          },
        };
      })
      .filter(Boolean) as any[];

    const points = arcs.map((arc) => ({
      lat: arc.startLat,
      lng: arc.startLng,
      size: 0.5,
      color: arc.color,
      original: arc,
    }));

    const rings = arcs.map((arc) => ({
      lat: arc.startLat,
      lng: arc.startLng,
      color: arc.color,
      size: arc.sizeLevel * 1.6,
      propSpeed: arc.sizeLevel >= 4 ? 2.2 : arc.sizeLevel >= 3 ? 1.8 : 1.3,
      repeatTime: arc.sizeLevel >= 4 ? 800 : arc.sizeLevel >= 3 ? 1000 : 1200,
      threat_data: arc.threat_data,
    }));

    return { arcsData: arcs, pointsData: points, ringsData: rings };
  }, [threats]);

  const handleElementClick = (elem: any) => {
    if (!elem) return;
    lastElementClickRef.current = Date.now();
    const data = elem.threat_data ? elem.threat_data : elem;
    setSelectedThreat({
      id: `${data.cve_id || "threat"}-${data.published_date || ""}`,
      ...data,
      displayLat: (elem.startLat || 0).toFixed(4),
      displayLng: (elem.startLng || 0).toFixed(4),
      displayIP: data.realIP || "",
    });
    requestAnimationFrame(() => {
      globeRef.current?.pointOfView({ lat: elem.startLat, lng: elem.startLng, altitude: 1.2 }, 800);
    });
  };

  const sevColor = (sev: string) => {
    const s = (sev || "low").toLowerCase();
    return s === "critical" ? "text-red-400" : s === "high" ? "text-orange-400" : s === "medium" ? "text-yellow-400" : "text-cyan-400";
  };

  return (
    <div className="w-full space-y-0">
      {/* Map mode tabs */}
      <div className="flex items-center gap-0 mb-0 self-start">
        {(["3d", "2d"] as const).map((mode) => (
          <button
            key={mode}
            id={`map-toggle-${mode}`}
            onClick={() => {
              setMapMode(mode);
              setSelectedThreat(null);
            }}
            className={`map-tab px-4 py-1.5 text-[15px] font-mono uppercase tracking-widest border ${
              mapMode === mode
                ? "active rounded-tl-md rounded-tr-md border-b-transparent"
                : "text-gray-400 border-transparent hover:text-gray-400"
            }`}
          >
            {mode === "3d" ? "⬡ 3D Globe" : "⬛ 2D Radar"}
          </button>
        ))}
        <div className="flex-1 border-b border-cyan-900/30 mb-[-1px]" />
      </div>

      {/* Map container */}
      <div className="relative overflow-hidden" style={{ borderRadius: mapMode === "3d" ? "0 12px 12px 12px" : "0 12px 12px 12px" }}>
        {mapMode === "2d" ? (
          <FlatThreatMap threats={geoThreats.length > 0 ? geoThreats : threats} />
        ) : (
          <div
            className="w-full relative cursor-crosshair"
            style={{
              height: 420,
              background: "radial-gradient(ellipse at center, #020d1f 0%, #010810 100%)",
              border: "1px solid rgba(0,229,255,0.12)",
              borderRadius: "0 12px 12px 12px",
              boxShadow: "0 0 40px rgba(0,229,255,0.05), inset 0 0 40px rgba(0,0,0,0.5)",
            }}
            ref={containerRef}
            onMouseLeave={() => setHoverArc(null)}
          >
            <Globe
              ref={globeRef}
              width={dimensions.width}
              height={dimensions.height}
              globeImageUrl="https://unpkg.com/three-globe@2.31.1/example/img/earth-dark.jpg"
              backgroundColor="rgba(0,0,0,0)"
              atmosphereColor="#00e5ff"
              atmosphereAltitude={0.18}
              enablePointerInteraction={true}

              arcsData={arcsData}
              arcColor={(d: any) => (d === hoverArc ? "#ffffff" : d.color)}
              arcDashLength={0.45}
              arcDashGap={0.18}
              arcDashAnimateTime={(d: any) => d.animTime}
              arcsTransitionDuration={0}
              arcAltitude="arcAlt"
              arcStroke={(d: any) => (d === hoverArc ? 1.4 : 0.7)}
              onArcHover={setHoverArc}
              onArcClick={(arc: any, event: any) => {
                event?.stopPropagation?.();
                handleElementClick(arc);
              }}

              pointsData={pointsData}
              pointColor={(d: any) => d.color}
              pointAltitude={0.01}
              pointRadius={0.9}
              pointResolution={12}
              onPointClick={(point: any, event: any) => {
                event?.stopPropagation?.();
                handleElementClick(point.original);
              }}

              ringsData={ringsData}
              ringColor="color"
              ringMaxRadius="size"
              ringPropagationSpeed="propSpeed"
              ringRepeatPeriod="repeatTime"

              onGlobeReady={handleGlobeReady}
              onGlobeClick={() => {
                if (Date.now() - lastElementClickRef.current < 350) return;
                setSelectedThreat(null);
              }}
            />

            {/* No geo data overlay */}
            {geoThreats.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span className="text-cyan-900 font-mono text-base tracking-widest animate-pulse text-center px-4">
                  Awaiting geo-tagged threat streams...
                </span>
              </div>
            )}

            {/* HUD Badge top-left */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-cyan-900/60 rounded backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(255,71,87,1)]" />
                <span className="text-[15px] font-mono text-red-400 tracking-widest font-semibold uppercase">
                  Live Threat Radar
                </span>
              </div>
            </div>

            {/* Arc count badge */}
            <div className="absolute top-4 right-4 pointer-events-none z-10">
              <div className="px-3 py-1.5 bg-black/60 border border-gray-800/60 rounded backdrop-blur-md">
                <span className="text-[15px] font-mono text-gray-400">
                  <span className="text-cyan-500">{arcsData.length}</span> ACTIVE ARCS
                </span>
              </div>
            </div>

            {/* Selected threat panel */}
            <div className="absolute bottom-4 right-4 pointer-events-none z-10 flex flex-col items-end">
              {selectedThreat && (
                <div className="glass-card p-4 w-72 pointer-events-auto animate-slide-in-right border-cyan-500/30 shadow-[0_0_24px_rgba(0,229,255,0.15)]">
                  <h3 className="text-[15px] font-mono font-bold text-cyan-400 mb-3 border-b border-cyan-900/50 pb-2 flex justify-between items-center tracking-widest">
                    ◈ TARGET LOCK
                    <button
                      onClick={() => setSelectedThreat(null)}
                      className="text-gray-400 hover:text-cyan-400 transition-colors text-base ml-2"
                    >
                      ✕
                    </button>
                  </h3>
                  <div className="space-y-2 text-[15px] font-mono">
                    {[
                      { label: "Origin IP", val: selectedThreat.displayIP || "—", cls: "text-red-400 font-bold" },
                      { label: "Location",  val: selectedThreat.location || "—", cls: "text-gray-300 truncate max-w-[130px]" },
                      { label: "Vector",    val: selectedThreat.attack_type || "UNKNOWN", cls: "text-cyan-300 truncate max-w-[130px]" },
                      { label: "Severity",  val: (selectedThreat.severity || "LOW").toUpperCase(), cls: `font-bold uppercase ${sevColor(selectedThreat.severity)}` },
                      { label: "Coords",    val: `[${selectedThreat.displayLat}, ${selectedThreat.displayLng}]`, cls: "text-gray-400" },
                      { label: "Date",      val: selectedThreat.published_date || "LIVE", cls: "text-gray-400 text-[14px]" },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="flex justify-between gap-2 border-b border-gray-900/60 pb-1.5">
                        <span className="text-gray-400 uppercase shrink-0">{label}</span>
                        <span className={cls} title={val}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none rounded-[0_12px_12px_12px]"
              style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.7)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
