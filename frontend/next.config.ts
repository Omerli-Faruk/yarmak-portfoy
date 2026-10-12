import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker imajı için yalnızca gereken dosyaları .next/standalone altına toplar.
  output: "standalone",
};

export default nextConfig;
