import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://localhost:7071/api"}/:path*`, // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;
