import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "@workspace/ui": fileURLToPath(
        new URL("../../packages/ui/src", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "e2e/**"],
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
})
