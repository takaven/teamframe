import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https://*.supabase.co https://*.sentry.io",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

/**
 * Sentry build-time wrapper (Wave 4).
 *
 * Source-map upload is gated on SENTRY_AUTH_TOKEN: local and CI builds without
 * the token must stay green and must not attempt any network call to Sentry.
 * Runtime error capture is independently gated on SENTRY_DSN /
 * NEXT_PUBLIC_SENTRY_DSN in the three sentry.*.config.ts files.
 */
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  // Org/project are only needed when uploading source maps.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Hard gate: no token → no source-map upload, no upload warnings treated as
  // anything other than informational. Build output stays identical to an
  // unwrapped build apart from Sentry's webpack instrumentation.
  sourcemaps: {
    disable: !hasSentryAuthToken,
  },

  // Keep credential-less builds quiet; surface upload logs only when a token
  // is present (i.e. a release build that actually uploads).
  silent: !hasSentryAuthToken,

  // No telemetry to Sentry from the build toolchain.
  telemetry: false,

  // Strip Sentry debug logger statements from production bundles.
  disableLogger: true,
});
