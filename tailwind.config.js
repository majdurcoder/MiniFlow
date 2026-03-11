/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Geist Pixel", "monospace"],
        body: ["Geist Pixel", "monospace"],
        sans: ["-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Georgia", "New York", "Times New Roman", "serif"],
      },
      colors: {
        mini: {
          bg: "#FFFFFF",
          deep: "#F0F4F8",
          surface: "#F7F9FC",
          "surface-light": "#EEF2F7",
          highlight: "#D0DBE8",
          border: "#D6E0EA",
          accent: "#1E3A5F",
          "accent-light": "#2E5FA3",
          text: "#0F1923",
          "text-muted": "#5A6B7A",
          success: "#2D6A4F",
          warning: "#B45309",
          error: "#9B1C1C",
        },
        dash: {
          bg: "#F3F3F1",
          card: "#FFFFFF",
          yellow: "#FFFCF0",
          "yellow-border": "#EDE6C3",
          text: "#1C1C1E",
          "text-muted": "#8A8A8E",
          "text-soft": "#6B6B70",
          border: "#E5E5E3",
          badge: "#E8E8E5",
          "nav-hover": "#EBEBEA",
          "nav-active": "#E3E3E0",
          success: "#2D6A4F",
          error: "#9B1C1C",
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        blink: "blink 1s infinite",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.15)", opacity: "0.7" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        blink: {
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
