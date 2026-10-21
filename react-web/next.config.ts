import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev only: lets a second browser session sign in on 127.0.0.1:3000 with
  // its own storage while another uses localhost:3000 (two E2E runs at
  // once). No effect on `next build` or production.
  allowedDevOrigins: ["127.0.0.1"],
};

export default withNextIntl(nextConfig);
