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
  auth: {
    bcryptSaltRounds: number;
    // Minutes — TAD-001 §11 AUTH-004 (email verification), AUTH-005 (password reset).
    emailVerificationTokenTtlMinutes: number;
    passwordResetTokenTtlMinutes: number;
    // Brute-force protection (Engineering Standards §Security baseline), not yet
    // pinned by a specific TAD-001 clause — a defensible default, documented as
    // such in the Phase-2 completion report.
    maxFailedLoginAttempts: number;
    accountLockoutMinutes: number;
  };
  workspace: {
    trialDurationDays: number;
    // Team invitation link expiry — not pinned by any approved ADR; a
    // defensible default (typical B2B SaaS invite lifetime), documented in
    // the Phase-3 completion report.
    invitationTokenTtlDays: number;
  };
  urls: {
    web: string;
    admin: string;
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
  meta: {
    appId: string;
    appSecret: string;
    webhookVerifyToken: string;
    graphApiVersion: string;
  };
  tokenEncryptionKey: string;
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
  auth: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12", 10),
    emailVerificationTokenTtlMinutes: parseInt(
      process.env.EMAIL_VERIFICATION_TOKEN_TTL ?? "60",
      10,
    ),
    passwordResetTokenTtlMinutes: parseInt(process.env.PASSWORD_RESET_TOKEN_TTL ?? "30", 10),
    maxFailedLoginAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS ?? "5", 10),
    accountLockoutMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES ?? "15", 10),
  },
  workspace: {
    trialDurationDays: parseInt(process.env.TRIAL_DURATION_DAYS ?? "14", 10),
    invitationTokenTtlDays: parseInt(process.env.TEAM_INVITATION_TOKEN_TTL_DAYS ?? "7", 10),
  },
  urls: {
    web: process.env.WEB_APP_URL ?? "",
    admin: process.env.ADMIN_APP_URL ?? "",
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
  meta: {
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
    graphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v26.0",
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
  // SEC-010 — explicit allow-list, never a wildcard in production.
  corsAllowedOrigins: [process.env.WEB_APP_URL, process.env.ADMIN_APP_URL].filter(
    (origin): origin is string => Boolean(origin),
  ),
});
