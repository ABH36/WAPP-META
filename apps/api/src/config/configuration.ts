/** Typed accessor over process.env, consumed via ConfigService — never read process.env directly elsewhere. */
export interface AppConfig {
  env: string;
  port: number;
  mongoUri: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  resend: {
    apiKey: string;
    fromAddress: string;
    fromName: string;
    // TAD-001 v1.2 Email Patch — dev/staging/prod behavior.
    testMode: boolean;
    testRecipientAllowlist: string[];
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  corsAllowedOrigins: string[];
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  mongoUri: process.env.MONGODB_URI ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    // Access tokens short-lived per TAD-001 AUTH-002; refresh tokens longer-lived per AUTH-003.
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromAddress: process.env.RESEND_FROM_ADDRESS ?? "",
    fromName: process.env.RESEND_FROM_NAME ?? "WAPP",
    testMode: process.env.EMAIL_TEST_MODE === "true",
    testRecipientAllowlist: (process.env.EMAIL_TEST_RECIPIENT_ALLOWLIST ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  // SEC-010 — explicit allow-list, never a wildcard in production.
  corsAllowedOrigins: [process.env.WEB_APP_URL, process.env.ADMIN_APP_URL].filter(
    (origin): origin is string => Boolean(origin),
  ),
});
