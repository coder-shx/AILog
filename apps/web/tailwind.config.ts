import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0d0f10",
          900: "#151819",
          850: "#1b1f20",
          800: "#232829"
        },
        signal: {
          green: "#5ee08e",
          cyan: "#52c7e8",
          amber: "#e7bb55",
          red: "#f87171"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
