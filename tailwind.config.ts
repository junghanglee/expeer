import type { Config } from "tailwindcss";

// Tailwind v4 uses CSS-based configuration in src/styles.css.
// This file exists only to satisfy tooling that expects a config file.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
