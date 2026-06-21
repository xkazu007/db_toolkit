import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@prisma/client", "ibm_db", "pg"]
};

export default nextConfig;
