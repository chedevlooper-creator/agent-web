import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        fg: {
          primary: "var(--fg-primary)",
          secondary: "var(--fg-secondary)",
          muted: "var(--fg-muted)",
        },
        chrome: {
          DEFAULT: "var(--chrome)",
          elevated: "var(--chrome-elevated)",
          muted: "var(--chrome-muted)",
        },
        electric: {
          DEFAULT: "var(--electric)",
          hover: "var(--electric-hover)",
          muted: "var(--electric-muted)",
        },
        cyan: {
          DEFAULT: "var(--cyan)",
          muted: "var(--cyan-muted)",
        },
        lime: {
          DEFAULT: "var(--electric)",
          muted: "var(--electric-muted)",
        },
        magenta: {
          DEFAULT: "var(--magenta)",
          muted: "var(--magenta-muted)",
        },
        amber: {
          DEFAULT: "var(--amber)",
          muted: "var(--amber-muted)",
        },
        "amber-muted": "var(--amber-muted)",
        teal: {
          DEFAULT: "var(--teal)",
          muted: "var(--teal-muted)",
        },
        "teal-muted": "var(--teal-muted)",
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          muted: "var(--surface-muted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          muted: "var(--primary-muted)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          muted: "var(--accent-muted)",
          foreground: "var(--accent-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        border: {
          DEFAULT: "var(--border)",
          muted: "var(--border-muted)",
          strong: "var(--border-strong)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      width: {
        sidebar: "var(--sidebar-width)",
        "sidebar-collapsed": "var(--sidebar-collapsed)",
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down":
          "slide-down 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in":
          "scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "message-in":
          "message-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "float-in": "float-in 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "float-gentle": "float-gentle 4s ease-in-out infinite",
        "glow-breathe": "glow-breathe 2.5s ease-in-out infinite",
        "glow-ring": "glow-ring 3s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.92)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "message-in": {
          from: { transform: "translateY(12px) scale(0.97)", opacity: "0" },
          to: { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(99, 102, 241, 0)",
          },
          "50%": {
            boxShadow: "0 0 28px 8px rgba(99, 102, 241, 0.2)",
          },
        },
        "float-in": {
          from: { transform: "translateY(24px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.65" },
        },
        "glow-ring": {
          "0%, 100%": {
            boxShadow:
              "0 0 0 0 rgba(99, 102, 241, 0), 0 0 0 0 rgba(244, 114, 182, 0)",
          },
          "50%": {
            boxShadow:
              "0 0 16px 2px rgba(99, 102, 241, 0.12), 0 0 8px 1px rgba(244, 114, 182, 0.08)",
          },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-6px)" },
          "60%": { transform: "translateY(-3px)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
