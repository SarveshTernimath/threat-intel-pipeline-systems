"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";

// Dynamically import react-globe.gl to avoid SSR "window not defined" errors
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#07070a]">
      <span className="text-red-500 font-mono text-xs tracking-widest animate-pulse">
        [ INITIALIZING GLOBAL RADAR ]
      </span>
    </div>
  )
});

interface ThreatMapProps {
  threats?: any[];
}

export default function ThreatMap({ threats = [] }: ThreatMapProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastElementClickRef = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Interaction states
  const [hoverArc, setHoverArc] = useState<any>(null);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);

  // Auto-resize the globe when the parent container sizes up
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 400,
        });
      }
    };

    window.addEventListener("resize", updateDimensions);
    updateDimensions();

    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Securely patch auto-rotation when the globe finishes mounting its webgl context
  const handleGlobeReady = () => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.enablePan = true;
      controls.autoRotateSpeed = 1.8; // Smooth radar spin
      controls.enableZoom = true;    // Lock the camera field of view
    }
  };

  const geoThreats = useMemo(() => {
    const valid = threats.filter((t: any) => t.lat && t.lng);
    console.log("Geo threats:", valid.length);
    return valid;
  }, [threats]);

  // Generate arcs/points strictly from real geo (no mock coordinates)
  const { arcsData, pointsData, ringsData } = useMemo(() => {
    if (!geoThreats || geoThreats.length === 0) {
      return { arcsData: [], pointsData: [], ringsData: [] };
    }

    const arcs = geoThreats
      .slice(0, 100)
      .map((threat: any, index: number) => {
        const nextThreat = geoThreats[index + 1];
        if (!nextThreat) return null;

        // Map severity: critical -> bright red, high -> orange, medium -> yellow, low -> cyan
        const sev = (threat.severity || "low").toLowerCase();
        
        // As requested by user, default all other priorities to bright cyan, except critical which stays red
        let color = sev === "critical" ? "#ff3b3b" : "#00ffff"; 
        let sizeLevel = sev === "critical" ? 4 : sev === "high" ? 3 : sev === "medium" ? 2 : 1;

        return {
          startLat: threat.lat,
          startLng: threat.lng,
          endLat: nextThreat.lat,
          endLng: nextThreat.lng,
          color,
          sizeLevel,
          arcAlt: 0.25,
          animTime: 1800,
          threat_data: {
            ...threat,
            realIP: threat.iocs?.ips?.[0] || "",
            location: threat.country || "",
            targetLat: nextThreat.lat.toFixed(4),
            targetLng: nextThreat.lng.toFixed(4)
          }
        };
      })
      .filter(Boolean) as any[];

    // Explicit click-target points exactly overlaying the arc origins
    const points = arcs.map(arc => ({
      lat: arc.startLat,
      lng: arc.startLng,
      size: 0.4,
      color: arc.color,
      original: arc
    }));

    // Pulsing Rings at origin points
    const rings = arcs.map(arc => ({
      lat: arc.startLat,
      lng: arc.startLng,
      color: arc.color,
      size: arc.sizeLevel * 1.5, // size based on severity
      propSpeed: arc.sizeLevel >= 4 ? 2.0 : arc.sizeLevel >= 3 ? 1.6 : 1.2,
      repeatTime: arc.sizeLevel >= 4 ? 900 : arc.sizeLevel >= 3 ? 1100 : 1300,
      threat_data: arc.threat_data
    }));

    return { arcsData: arcs, pointsData: points, ringsData: rings };
  }, [threats]);

  const handleElementClick = (elem: any) => {
    console.log("CLICKED ELEMENT:", elem);

    if (!elem) return;
    lastElementClickRef.current = Date.now();

    // SAFE threat data extraction ensuring we map UI requirements
    const data = elem.threat_data ? elem.threat_data : elem;
    
    setSelectedThreat({
      id: `${data.cve_id || "threat"}-${data.published_date || ""}`,
      ...data,
      displayLat: (elem.startLat || 0).toFixed(4),
      displayLng: (elem.startLng || 0).toFixed(4),
      displayIP: data.realIP || ""
    });

    console.log("SELECTED:", data);

    // Smooth isolated zoom pointing exactly to element root coordinates
    requestAnimationFrame(() => {
      globeRef.current?.pointOfView(
        {
          lat: elem.startLat,
          lng: elem.startLng,
          altitude: 1.3
        },
        800
      );
    });
  };

  return (
    <div
      className="w-full h-[400px] rounded-xl border border-red-900/40 relative bg-[#050508] shadow-[0_0_30px_rgba(220,38,38,0.08)] flex items-center justify-center cursor-crosshair"
      style={{ pointerEvents: "auto", position: "relative" }}
      ref={containerRef}
      onMouseLeave={() => setHoverArc(null)}
    >
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="rgba(0,0,0,0)" // Transparent to layer over our custom bg
        enablePointerInteraction={true}

        // Arc Config (Animated lasers)
        arcsData={arcsData}
        arcColor={(d: any) => d === hoverArc ? "#ffffff" : d.color}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={(d: any) => d.animTime}
        arcsTransitionDuration={0}
        arcAltitude="arcAlt"
        arcStroke={(d: any) => d === hoverArc ? 1.2 : 0.6}
        onArcHover={setHoverArc}
        onArcClick={(arc: any, event: any) => {
          console.log("ARC CLICK WORKING", arc);
          event?.stopPropagation?.();
          handleElementClick(arc);
        }}

        // Points Config (Target clickable origins)
        pointsData={pointsData}
        pointColor={(d: any) => d.color}
        pointAltitude={0.01}
        pointRadius={0.8}
        pointResolution={12}
        onPointClick={(point: any, event: any) => {
          console.log("POINT CLICK WORKING", point);
          event?.stopPropagation?.();
          handleElementClick(point.original);
        }}

        // Rings Config (Pulsing nodes at origins)
        ringsData={ringsData}
        ringColor="color"
        ringMaxRadius="size"
        ringPropagationSpeed="propSpeed"
        ringRepeatPeriod="repeatTime"

        // Handlers
        onGlobeReady={handleGlobeReady}
        onGlobeClick={() => {
          // Prevent globe click from immediately clearing a recent point/arc selection.
          if (Date.now() - lastElementClickRef.current < 350) return;
          setSelectedThreat(null);
        }}
      />

      {geoThreats.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <span className="text-red-500 font-mono text-sm tracking-widest animate-pulse text-center px-4">
            No geolocation data available for current threats
          </span>
        </div>
      )}

      {/* Decorative Cyber Overlay HUD */}
      <div className="absolute top-5 left-5 pointer-events-none z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 border border-red-900/50 rounded backdrop-blur-sm self-start">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]" />
          <span className="text-[10px] font-mono text-red-400 tracking-widest font-semibold uppercase">Live Threat Radar</span>
        </div>
      </div>

      {/* Dynamic Tooltip Panel rendering currently tracked target */}
      <div className="absolute bottom-5 right-5 pointer-events-none z-10 flex flex-col items-end">
        {selectedThreat && (
          <div className="bg-black/90 border border-cyan-500/50 rounded-lg p-5 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.3)] w-72 pointer-events-auto transition-all animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xs font-mono font-bold text-cyan-400 mb-4 border-b border-cyan-900/60 pb-3 flex justify-between items-center tracking-widest">
              TARGET LOCK ESTABLISHED
              <button
                onClick={() => setSelectedThreat(null)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </h3>

            <div className="space-y-3 text-[11px] font-mono">
              <div className="flex justify-between border-b border-gray-800/60 pb-1.5">
                <span className="text-gray-500 uppercase">Origin IP</span>
                <span className="text-red-400 font-bold">{selectedThreat.displayIP}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/60 pb-1.5">
                <span className="text-gray-500 uppercase">Location</span>
                <span className="text-gray-300 truncate max-w-[120px]" title={selectedThreat.location}>{selectedThreat.location}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/60 pb-1.5">
                <span className="text-gray-500 uppercase">Vector</span>
                <span className="text-cyan-300 truncate max-w-[120px]" title={selectedThreat.attack_type || "UNKNOWN"}>{selectedThreat.attack_type || "UNKNOWN"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/60 pb-1.5">
                <span className="text-gray-500 uppercase">Severity</span>
                <span className={`uppercase font-bold ${selectedThreat.severity === 'critical' ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' :
                  selectedThreat.severity === 'high' ? 'text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]' :
                    selectedThreat.severity === 'medium' ? 'text-yellow-500' : 'text-cyan-500'
                  }`}>
                  {selectedThreat.severity || "LOW"}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-800/60 pb-1.5">
                <span className="text-gray-500 uppercase">Coords</span>
                <span className="text-gray-300 tracking-wider">
                  [{selectedThreat.displayLat}, {selectedThreat.displayLng}]
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-500 uppercase">Timestamp</span>
                <span className="text-gray-600 text-[10px] truncate max-w-[150px] text-right">{selectedThreat.published_date || "LIVE"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scope Reticle / Vignette Overlay for aesthetics */}
      <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/5 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]" />
    </div>
  );
}
