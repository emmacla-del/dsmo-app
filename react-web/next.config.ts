import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev only: lets a second browser session sign in on 127.0.0.1:3000 with
  // its own storage while another uses localhost:3000 (two E2E runs at
  // once). No effect on `next build` or production.
  allowedDevOrigins: ["127.0.0.1"],
  // The dashboard was withdrawn on 2026-11-07. Old bookmarks land on the first
  // staff queue; RequireAdminRole sends a role that may not open it to that
  // role's own first page. Temporary, because the dashboard will come back.
  async redirects() {
    return [{ source: "/admin/pilotage", destination: "/admin/inscriptions", permanent: false }];
  },
  // Dev only, and only when asked for: CAMLEAP_DEV_API_PROXY=http://localhost:3004
  // forwards /api/* to the local API, so the site and the API share one
  // origin (set NEXT_PUBLIC_API_URL=http://localhost:3000/api with it). For
  // browsers that only let a page reach its own origin, such as Claude's
  // browser pane. Unset, nothing is forwarded; never used in production.
  async rewrites() {
    const target = process.env.NODE_ENV !== "production" ? process.env.CAMLEAP_DEV_API_PROXY : undefined;
    return target ? [{ source: "/api/:path*", destination: `${target.replace(/\/$/, "")}/api/:path*` }] : [];
  },
};

export default withNextIntl(nextConfig);
