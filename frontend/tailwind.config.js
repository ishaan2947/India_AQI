/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aqi: {
          good: "#00E400",
          moderate: "#FFFF00",
          sensitive: "#FF7E00",
          unhealthy: "#FF0000",
          veryUnhealthy: "#8F3F97",
          hazardous: "#7E0023",
        },
        ink: {
          900: "#0b1220",
          800: "#111a2e",
          700: "#1a253f",
          600: "#243150",
          200: "#cdd5e0",
          100: "#e6ebf2",
        },
      },
      fontFamily: {
        sans: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
