import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1', 
    'localhost', 
    /^run-agent-.*\.agent-sandbox-.*\.trae\.ai$/
  ],
};

export default nextConfig;
