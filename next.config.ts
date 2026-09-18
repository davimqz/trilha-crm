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
      // Headers do next.config sobrescrevem os do route handler. As rotas de anexo ficam fora da CSP global:
      // o download tem regra própria abaixo (sandbox) e a pré-visualização define CSP/X-Frame-Options no handler
      // (variam por tipo de arquivo e a pré-visualização precisa poder ser exibida dentro do próprio CRM).
      {
        source: "/((?!api/leads/[^/]+/attachments/[^/]+$)(?!api/leads/[^/]+/attachments/[^/]+/preview$).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
      {
        source: "/((?!api/leads/[^/]+/attachments/[^/]+/preview$).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/api/leads/:leadId/attachments/:attachmentId",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }],
      },
    ];
  },
};

export default nextConfig;
