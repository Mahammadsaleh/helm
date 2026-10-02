import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/": ["./data/imported/**/*", "./data/checkpoints/**/*"],
    "/api/analyze": ["./data/imported/**/*", "./data/checkpoints/**/*"],
  },
};

export default nextConfig;
