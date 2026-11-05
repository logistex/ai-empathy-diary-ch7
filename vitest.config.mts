import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 'server-only'는 서버 컴포넌트 밖에서 import하면 오류를 낸다. 테스트에서는 빈 모듈로 바꾼다.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    // 기본은 node 환경. 화면 컴포넌트 테스트는 파일 맨 위에 `// @vitest-environment jsdom` 을 쓴다.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "db/**/*.test.{ts,mjs}", "test/**/*.test.{ts,tsx}"],
  },
});
