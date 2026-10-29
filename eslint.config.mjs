import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

export default defineConfig([
  // Next's TypeScript override omits .mts/.cts; our operator declarations use .d.mts.
  ...nextVitals.map((config) =>
    config.name === "next/typescript"
      ? { ...config, files: ["**/*.{ts,tsx,mts,cts}"] }
      : config,
  ),
  prettier,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    ".local/**",
    "test-results/**",
    "out/**",
    "playwright-report/**",
  ]),
]);
