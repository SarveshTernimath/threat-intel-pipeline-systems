"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

interface Props {
  onSearch: (query: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

export default function SearchBar({ onSearch, isLoading, initialValue = "" }: Props) {
  const [isClient, setIsClient] = useState(false);
  const [value, setValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!value.trim() && initialValue.trim()) {
      setValue(initialValue.trim());
    }
    // Intentionally not tracking `value` to avoid resetting user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            size={18}
          />
          <input
            id="threat-search-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search CVE ID, keyword, attack type..."
            className="
              w-full pl-11 pr-4 py-3.5
              bg-[#0d0d0f] border border-gray-800 rounded-lg
              text-gray-100 placeholder-gray-600
              font-mono text-sm
              focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/50
              transition-all duration-200
            "
          />
        </div>
        <button
          id="search-submit-btn"
          type="submit"
          disabled={!isClient || isLoading || value.trim() === ""}
          className="
            px-6 py-3.5 rounded-lg font-semibold text-sm
            bg-red-700 hover:bg-red-600 active:bg-red-800
            text-white transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            border border-red-600/30
            flex items-center gap-2
          "
        >
          {isLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            "SCAN"
          )}
        </button>
      </div>
    </form>
  );
}
