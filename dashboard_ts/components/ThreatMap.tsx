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

export default function ThreatMap() {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

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
      controls.autoRotateSpeed = 1.8; // Smooth radar spin
      controls.enableZoom = false;    // Lock the camera field of view
    }
  };

  // Generate random mock arcs mimicking global cyber attacks
  const { arcsData, pointsData } = useMemo(() => {
    const numArcs = 25;
    const arcs = [...Array(numArcs).keys()].map(() => ({
      startLat: (Math.random() - 0.5) * 180,
      startLng: (Math.random() - 0.5) * 360,
      endLat: (Math.random() - 0.5) * 180,
      endLng: (Math.random() - 0.5) * 360,
      // Cycling through neon reds and warning oranges
      color: ['#ff0000', '#dc2626', '#f87171', '#ff4444'][Math.floor(Math.random() * 4)] 
    }));

    // Exploding points at the destination to simulate attack landing zones (glowing points)
    const points = arcs.map(arc => ({
      lat: arc.endLat,
      lng: arc.endLng,
      size: Math.random() * 0.5 + 0.2, // Randomizes point radius
      color: arc.color
    }));

    return { arcsData: arcs, pointsData: points };
  }, []);

  return (
    <div 
      className="w-full h-[400px] rounded-xl border border-red-900/40 relative overflow-hidden bg-[#050508] shadow-[0_0_30px_rgba(220,38,38,0.08)] flex items-center justify-center"
      ref={containerRef}
    >
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="rgba(0,0,0,0)" // Transparent to layer over our custom bg
        
        // Arc Config (Animated lasers)
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        arcStroke={0.6}
        
        // Points Config (Target glowing cities)
        pointsData={pointsData}
        pointColor="color"
        pointAltitude={0.01}
        pointRadius="size"
        
        // Handlers
        onGlobeReady={handleGlobeReady}
      />

      {/* Decorative Cyber Overlay HUD */}
      <div className="absolute top-5 left-5 pointer-events-none z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 border border-red-900/50 rounded backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]" />
          <span className="text-[10px] font-mono text-red-400 tracking-widest font-semibold uppercase">Live Threat Radar</span>
        </div>
      </div>
      
      {/* Scope Reticle / Vignette Overlay for aesthetics */}
      <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/5 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]" />
    </div>
  );
}
