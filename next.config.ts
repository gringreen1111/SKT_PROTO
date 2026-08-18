import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // v1 프로토타입(v1/index.html)은 빌드 대상이 아니다.
  outputFileTracingExcludes: { "*": ["./v1/**"] },
};

export default nextConfig;
