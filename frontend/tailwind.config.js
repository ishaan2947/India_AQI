/**
 * Design tokens. See ../DESIGN.md for the reasoning behind every value here —
 * this file is the machine-readable half of that document.
 *
 * Two rules worth repeating at the top of the file, because they are the ones
 * that get broken first:
 *
 *   1. Saturated colour means AQI. The neutral ramp is warm grey-brown
 *      ("smoke"), never navy, so the yellows and oranges of the scale stay
 *      legible instead of turning acid against a blue ground.
 *   2. Anything that carries type uses `smoke-500` or lighter, and anything
 *      that takes its colour from the AQI scale uses the `*-text` variant when
 *      it is colouring glyphs rather than filling a shape. Contrast ratios are
 *      in DESIGN.md §3 and were measured, not guessed.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // CPCB (Central Pollution Control Board) India bands. Not US EPA:
        // this is an Indian site and the top of the EPA scale compresses
        // exactly the range most of these cities live in.
        aqi: {
          good: "#4FA64B",
          satisfactory: "#9FC93C",
          moderate: "#F2D73B",
          poor: "#F08B33",
          veryPoor: "#E54B38",
          severe: "#A8262B",
          // Lightened variants for when the category colour has to carry
          // glyphs on a dark ground.
          "good-text": "#7FD177",
          "satisfactory-text": "#BFE05C",
          "moderate-text": "#F7E364",
          "poor-text": "#F8A95C",
          "veryPoor-text": "#F4705D",
          "severe-text": "#E86E72",

          // Old EPA-named keys, kept pointing at the nearest CPCB band so
          // the not-yet-redesigned pages keep working. Same shim as `ink`
          // below; goes away with it.
          sensitive: "#F08B33",
          unhealthy: "#F4705D",
          veryUnhealthy: "#E54B38",
          hazardous: "#A8262B",
        },

        // The neutral ramp. Warm, because the subject is smoke and the hero is
        // a photograph lit at sunset — a blue-black ground fought both.
        smoke: {
          950: "#0C0B0A",
          900: "#131110",
          850: "#1A1817",
          800: "#231F1D",
          700: "#302B28",
          600: "#5A534C",
          500: "#8A837A",
          300: "#B3ABA2",
          200: "#D5CEC6",
          100: "#EFEAE4",
        },

        // The paper sections. Dark is right for a photograph and a basemap;
        // it is not right for six hundred words of prose, which is why the
        // story and the how-it-works page are set on paper instead. Measured
        // against #F6F3EE: ink 16.6:1, soft 10.1:1, muted 5.4:1.
        paper: {
          DEFAULT: "#F6F3EE",
          ink: "#171412",
          soft: "#413A34",
          muted: "#6B6258",
          rule: "#D9D1C6",
          sunk: "#EDE8E0",
        },

        // The one non-AQI colour, sampled off the hero photograph's golden
        // band so the warm accent comes out of the image rather than a wheel.
        // Used for rules and hover states where AQI colour would imply a
        // reading that isn't there.
        dusk: {
          200: "#E6D2B6",
          300: "#CBB08B",
          500: "#9A8260",
        },

        // ---------------------------------------------------------------
        // Compatibility shim. The map, forecasts and city-detail pages are
        // still on the old `ink-*` navy ramp and the old EPA category names;
        // they are the next pass. Aliasing rather than deleting means those
        // pages inherit the warm ground immediately instead of rendering
        // unstyled the moment the tokens change underneath them.
        // Delete this block once the last `ink-*` / `aqi-unhealthy` class is
        // gone from src/ (`grep -rE "-(ink)-|aqi-(unhealthy|hazardous|sensitive|veryUnhealthy)" src/`).
        // ---------------------------------------------------------------
        ink: {
          900: "#0C0B0A",
          800: "#131110",
          700: "#302B28",
          600: "#5A534C",
          200: "#D5CEC6",
          100: "#EFEAE4",
        },
      },

      fontFamily: {
        // Archivo carries a width axis, which is the reason it is here: the
        // hero numeral runs wide so it reads as a plotted figure, labels run
        // normal. Newsreader carries prose — a serif at a real measure is the
        // clearest signal that this is writing about air, not a SaaS panel.
        display: [
          "Archivo",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        sans: [
          "Archivo",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: ["Newsreader", "Georgia", "Times New Roman", "serif"],
        // Mono is for literal code only — see DESIGN.md §4. No bundled mono
        // face: if we are showing code, the reader's own mono is fine.
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },

      fontSize: {
        // One clamped ramp from 375px to 2560px, so there are no breakpoint
        // jumps in the type and nothing needs an sm:/lg: size override.
        label: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.09em" }],
        micro: ["0.75rem", { lineHeight: "1.1rem" }],
        body: ["1.0625rem", { lineHeight: "1.65" }],
        "body-lg": ["1.1875rem", { lineHeight: "1.65" }],
        row: ["clamp(1.05rem, 1.5vw, 1.4rem)", { lineHeight: "1.2" }],
        lead: ["clamp(1.25rem, 2vw, 1.75rem)", { lineHeight: "1.32" }],
        head: [
          "clamp(1.5rem, 2.6vw, 2.25rem)",
          { lineHeight: "1.12", letterSpacing: "-0.02em" },
        ],
        display: [
          "clamp(2.4rem, 6.2vw, 5rem)",
          { lineHeight: "0.98", letterSpacing: "-0.03em" },
        ],
        mega: [
          "clamp(5.5rem, 17vw, 15rem)",
          { lineHeight: "0.82", letterSpacing: "-0.045em" },
        ],
      },

      letterSpacing: {
        wordmark: "0.14em",
      },

      spacing: {
        // Band rhythm. Restricted on purpose: vertical space should be
        // recognisable rather than arbitrary.
        band: "4rem",
        "band-lg": "8rem",
        gutter: "1rem",
        "gutter-lg": "2.5rem",
      },

      maxWidth: {
        prose: "62ch",
        data: "1400px",
      },

      transitionTimingFunction: {
        air: "cubic-bezier(0.22, 0.68, 0.16, 1)",
      },

      transitionDuration: {
        tap: "140ms",
        move: "320ms",
        enter: "680ms",
        settle: "1600ms",
      },
    },
  },
  plugins: [],
};
