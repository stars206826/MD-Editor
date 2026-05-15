import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        card: "#111827",
        muted: "#94a3b8",
        border: "rgba(148, 163, 184, 0.2)",
        primary: "#38bdf8",
        accent: "#1e293b",
        danger: "#ef4444",
      },
      boxShadow: {
        panel: "0 20px 60px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [typography],
};

export default config;
