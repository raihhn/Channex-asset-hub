import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.ASSETHUB_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("/assethub_test")) {
  throw new Error("Booking E2E requires ASSETHUB_DATABASE_URL pointing to assethub_test.");
}

export default defineConfig({
  testDir: "./tests/persistence-e2e",
  workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3100" },
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3100",
    url: "http://127.0.0.1:3100/api/booking/requests",
    reuseExistingServer: false,
    env: {
      ASSETHUB_DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED: "true",
    },
  },
});
