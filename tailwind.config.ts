import type { Config } from "tailwindcss";
// BETVANTA design tokens are CSS variables (src/app/globals.css); Tailwind maps to them so both themes switch together.
const v = (n: string) => `var(--${n})`;
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), raised: v("surface-raised"), sunken: v("surface-sunken"), brand: v("surface-brand"),
        ink: v("ink"), muted: v("ink-muted"), subtle: v("ink-subtle"), "on-brand": v("ink-on-brand"), "on-accent": v("ink-on-accent"),
        line: v("border"), "line-strong": v("border-strong"), primary: v("primary"), "primary-hover": v("primary-hover"),
        link: v("link"), accent: v("accent"), "accent-hover": v("accent-hover"), "accent-text": v("accent-text"),
        "accent-subtle": v("accent-subtle"), "teal-subtle": v("teal-subtle"), focus: v("focus"),
        success: v("success"), "success-subtle": v("success-subtle"), danger: v("danger"), "danger-subtle": v("danger-subtle"),
        warning: v("warning"), "warning-subtle": v("warning-subtle"), copper: "#C47C52", teal: "#123D3B", sand: "#EAE1D4", charcoal: "#172322",
      },
      fontFamily: { display: v("font-display"), sans: v("font-sans"), mono: v("font-mono") },
      borderRadius: { sm: "4px", md: "8px", lg: "12px", xl: "20px" },
      maxWidth: { content: "1200px" },
    },
  },
  plugins: [],
};
export default config;
