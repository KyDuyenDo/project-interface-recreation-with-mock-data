/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        success: {
          50: "#ecfdf5",
          600: "#10b981",
          700: "#047857",
        },
        warning: {
          50: "#fffbeb",
          600: "#f59e0b",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          600: "#ef4444",
          700: "#b91c1c",
        },
        panel: {
          DEFAULT: "#ffffff",
          2: "#fafbfc",
        },
        sidebar: "#0f172a",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(16,24,40,.05)",
        DEFAULT: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
        lg: "0 12px 24px -8px rgba(16,24,40,.12), 0 4px 8px rgba(16,24,40,.04)",
        xl: "0 20px 50px rgba(15,23,42,.25)",
      },
      animation: {
        "fade-in": "fadeIn .15s ease",
        "slide-in-right": "slideInRight .2s ease",
        "scale-in": "scaleIn .15s ease",
        spin: "spin .8s linear infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideInRight: { from: { transform: "translateX(20px)", opacity: 0 }, to: { transform: "translateX(0)", opacity: 1 } },
        scaleIn: { from: { transform: "scale(.96)", opacity: 0 }, to: { transform: "scale(1)", opacity: 1 } },
      },
    },
  },
  plugins: [],
};
