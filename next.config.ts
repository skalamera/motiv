import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Makes GOOGLE_MAPS_API available to client components (Maps JS runs in the browser).
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/env
  env: {
    GOOGLE_MAPS_API: process.env.GOOGLE_MAPS_API ?? "",
  },
};

export default nextConfig;
