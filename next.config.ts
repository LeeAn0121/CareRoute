import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/CareRoute',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
