import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves project sites from /<repo-name>/, so the built
  // asset paths need that prefix. Local dev/preview stays at "/".
  base: process.env.GITHUB_PAGES ? "/sango-kingdom/" : "/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as never);
