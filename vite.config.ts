import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { ProxyOptions } from "vite";

export const localDevelopmentActor = "wang-yang";

export const localApiProxy: ProxyOptions = {
  target: "http://127.0.0.1:8090",
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest) => {
      proxyRequest.removeHeader("x-actor");
      proxyRequest.setHeader("X-Actor", localDevelopmentActor);
    });
  },
};

export default defineConfig({
  base: "/overview-monitoring/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 63200,
    strictPort: true,
    allowedHosts: ["all"],
    proxy: {
      "/api": localApiProxy,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/testing/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
