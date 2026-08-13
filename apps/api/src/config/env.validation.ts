import { plainToInstance, Type } from "class-transformer";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  validateSync,
} from "class-validator";

enum Environment {
  Development = "development",
  Staging = "staging",
  Production = "production",
  Test = "test",
}

/**
 * Fails application bootstrap immediately if a required environment variable is
 * missing — per TAD-001 SEC-007/DEP-005 (secrets only via env vars) and the
 * general "fail fast, don't silently run misconfigured" engineering principle.
 */
class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  // enableImplicitConversion alone does not reliably coerce string env vars to
  // numbers before validateSync runs — an explicit @Type() decorator is the
  // correct, documented class-transformer pattern (caught by actually booting
  // the app, not by typecheck/lint).
  @Type(() => Number)
  @IsNumber()
  PORT = 4000;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  // PRD-007 Volume-1 — required and distinct from JWT_ACCESS_SECRET/
  // JWT_REFRESH_SECRET; must never be equal to either at deploy time (not
  // enforced here structurally, but documented as a hard operational rule).
  @IsString()
  @IsNotEmpty()
  PLATFORM_JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  PLATFORM_JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  RESEND_FROM_ADDRESS!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_SECRET!: string;

  @IsUrl({ require_tld: false })
  WEB_APP_URL!: string;

  @IsUrl({ require_tld: false })
  ADMIN_APP_URL!: string;

  // PRD-003 Part 1 — WAPP's own Tech Provider app (D004); customers connect
  // their own WABA through it via Embedded Signup.
  @IsString()
  @IsNotEmpty()
  META_APP_ID!: string;

  @IsString()
  @IsNotEmpty()
  META_APP_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  META_WEBHOOK_VERIFY_TOKEN!: string;

  @IsString()
  @Matches(/^[0-9a-f]{64}$/i, {
    message: "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
  })
  TOKEN_ENCRYPTION_KEY!: string;

  // PHD-001 Volume-1 — optional `Domain` attribute for the httpOnly refresh-token
  // cookie. Only required in production for apps/admin's separate subdomain; see
  // the `cookieDomain` doc comment in configuration.ts for the full rationale.
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Environment configuration is invalid:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("\n")}`,
    );
  }

  // PRD-007 Volume-1 / PHD-001 Volume-1 — a leaked tenant secret must never be
  // usable to forge a Platform Administration session, and vice versa. This was
  // previously only a code comment; enforce it structurally so a misconfigured
  // deploy fails fast instead of silently sharing a signing key across the two
  // trust boundaries.
  const secretPairs: Array<[string, string]> = [
    ["JWT_ACCESS_SECRET", "PLATFORM_JWT_ACCESS_SECRET"],
    ["JWT_ACCESS_SECRET", "PLATFORM_JWT_REFRESH_SECRET"],
    ["JWT_REFRESH_SECRET", "PLATFORM_JWT_ACCESS_SECRET"],
    ["JWT_REFRESH_SECRET", "PLATFORM_JWT_REFRESH_SECRET"],
    ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"],
    ["PLATFORM_JWT_ACCESS_SECRET", "PLATFORM_JWT_REFRESH_SECRET"],
  ];
  for (const [a, b] of secretPairs) {
    if (validated[a as keyof EnvironmentVariables] === validated[b as keyof EnvironmentVariables]) {
      throw new Error(`Environment configuration is invalid: ${a} and ${b} must not be equal.`);
    }
  }

  return validated;
}
