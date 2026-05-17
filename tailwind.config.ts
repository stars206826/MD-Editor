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
        background: "#fefcf3",
        foreground: "#3d3229",
        card: "#ffffff",
        muted: "#8b7355",
        border: "rgba(180, 160, 130, 0.25)",
        primary: "#d97706",
        accent: "#fef3c7",
        danger: "#dc2626",
      },
      boxShadow: {
        panel: "0 8px 32px rgba(120, 80, 30, 0.08)",
        warm: "0 4px 20px rgba(180, 130, 60, 0.1)",
      },
    },
  },
  plugins: [typography],
};

export default config;
