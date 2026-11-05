import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `next dev`가 루트에 AGENTS.md를 자동으로 만들지 않게 한다. (프로젝트 지침은 CLAUDE.md 하나로 관리)
  agentRules: false,
};

export default nextConfig;
