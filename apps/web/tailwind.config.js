import typography from "@tailwindcss/typography";

/**
 * Theme-aware color scale backed by CSS variables (space-separated RGB channels),
 * so opacity modifiers like `bg-surface-2/60` keep working. Values per theme live
 * in src/app/globals.css under [data-theme="…"].
 */
const scale = (name, steps) =>
  Object.fromEntries(steps.map((step) => [step, `rgb(var(--${name}-${step}) / <alpha-value>)`]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // Large desktop / ultrawide
        "3xl": "1920px",
      },
      colors: {
        // Custom design system colors
        brand: scale("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        surface: scale("surface", [0, 1, 2, 3, 4, 5]),
        // Text/neutral scale: light-on-dark in dark themes, inverted in the light theme
        gray: scale("gray", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        // Hairlines and subtle overlays (white in dark themes, ink in light)
        line: "rgb(var(--line) / <alpha-value>)",
        // HTTP Method colors
        method: {
          get: "#22c55e",
          post: "#3b82f6",
          put: "#f59e0b",
          patch: "#a855f7",
          delete: "#ef4444",
          head: "#06b6d4",
          options: "#6b7280",
        },
        // Status code colors
        status: {
          info: "#94a3b8",
          success: "#22c55e",
          redirect: "#3b82f6",
          "client-error": "#f59e0b",
          "server-error": "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": "0.625rem",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "slide-in-left": "slideInLeft 0.25s ease-out",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
};
