import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP sem nonce (guia oficial do Next). Migrar para nonce está registrado como tech debt.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Headers do next.config sobrescrevem os do route handler: a CSP global não pode cair no download,
      // que precisa de "sandbox" (ADR-006). Por isso a rota de download fica fora dela e tem regra própria.
      {
        source: "/((?!api/leads/[^/]+/attachments/[^/]+$).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
      {
        source: "/api/leads/:leadId/attachments/:attachmentId",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }],
      },
    ];
  },
};

export default nextConfig;
