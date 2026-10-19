import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/managed-ui",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3003",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 3003",
    url: "http://127.0.0.1:3003/login",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      FAMILYOS_BUILD_DIR: ".next-managed-test",
      NEXT_PUBLIC_FAMILYOS_MANAGED_ACCESS: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://familyos-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_DB_SCHEMA: "familyos",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-local-test-fixture",
      SUPABASE_SERVICE_ROLE_KEY: "server-local-test-fixture",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3003",
    },
  },
});
