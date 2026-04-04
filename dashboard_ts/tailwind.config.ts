import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./types/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        threat: {
          bg:      "#07070a",
          surface: "#0d0d10",
          border:  "#1c1c22",
          red:     "#dc2626",
          "red-dim": "#7f1d1d",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
