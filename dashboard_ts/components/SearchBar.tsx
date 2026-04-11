"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

interface Props {
  onSearch: (query: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

export default function SearchBar({ onSearch, isLoading, initialValue = "" }: Props) {
  const [isClient, setIsClient] = useState(false);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!value.trim() && initialValue.trim()) setValue(initialValue.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;
    debounceRef.current = setTimeout(() => { onSearch(value); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center gap-3">
        {/* Input */}
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200"
            style={{ color: focused ? "#00e5ff" : "#374151" }}
            size={16}
          />
          <input
            id="threat-search-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search CVE ID, keyword, attack vector..."
            autoComplete="off"
            style={{
              background: focused ? "rgba(0,229,255,0.04)" : "rgba(4,10,22,0.9)",
              border: `1px solid ${focused ? "rgba(0,229,255,0.4)" : "rgba(255,255,255,0.07)"}`,
              boxShadow: focused ? "0 0 20px rgba(0,229,255,0.1), inset 0 0 12px rgba(0,229,255,0.03)" : "none",
              transition: "all 0.25s ease",
            }}
            className="w-full pl-11 pr-4 py-3.5 rounded-lg text-gray-100 placeholder-gray-700 font-mono text-base focus:outline-none"
          />
          {/* Animated bottom border on focus */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px rounded-b-lg transition-all duration-300"
            style={{
              background: focused
                ? "linear-gradient(90deg, transparent, rgba(0,229,255,0.6), transparent)"
                : "transparent",
            }}
          />
        </div>

        {/* SCAN button */}
        <button
          id="search-submit-btn"
          type="submit"
          disabled={!isClient || isLoading || value.trim() === ""}
          className="relative px-7 py-3.5 rounded-lg font-bold text-base tracking-widest font-mono transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden group"
          style={{
            background: isLoading
              ? "rgba(0,229,255,0.08)"
              : "linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,180,220,0.08))",
            border: "1px solid rgba(0,229,255,0.35)",
            color: "#00e5ff",
            boxShadow: isLoading ? "none" : "0 0 16px rgba(0,229,255,0.15)",
          }}
        >
          {/* Hover shimmer */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "linear-gradient(135deg, rgba(0,229,255,0.1), transparent)" }} />
          <span className="relative z-10 flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                SCANNING
              </>
            ) : (
              "⬡ SCAN"
            )}
          </span>
        </button>
      </div>
    </form>
  );
}
