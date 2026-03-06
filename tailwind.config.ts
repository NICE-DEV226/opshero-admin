import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["Inter", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
        display: ["Syne", "sans-serif"],
      },
      colors: {
        admin: {
          bg:       "#0a0e1a",
          surface:  "#0f1525",
          border:   "rgba(255,255,255,0.08)",
          accent:   "#6366f1",
          accent2:  "#a855f7",
          danger:   "#ef4444",
          warning:  "#f59e0b",
          success:  "#10b981",
          info:     "#3b82f6",
        },
      },
      animation: {
        "fade-in":  "fadeIn 0.3s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
