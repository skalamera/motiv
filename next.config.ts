import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cheerio + parse5 can break when bundled into the RSC server chunk on Vercel; load from node_modules.
  serverExternalPackages: ["cheerio"],
  // Makes GOOGLE_MAPS_API available to client components (Maps JS runs in the browser).
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/env
  env: {
    GOOGLE_MAPS_API: process.env.GOOGLE_MAPS_API ?? "",
  },
};

export default nextConfig;
