/**
 * Minimal, inline-styled transactional templates — template authorship is the
 * business module's responsibility (TAD-001 v1.2 Email Patch); EmailService
 * only owns delivery. Kept intentionally plain (no external assets/fonts) so
 * they render reliably across email clients without an image/CDN dependency.
 */

export function buildVerificationEmail(verificationLink: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "Verify your email address — WAPP",
    html: `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111827;">Verify your email address</h2>
        <p style="color: #374151;">Thanks for signing up for WAPP. Click the button below to verify your email and activate your account.</p>
        <p style="margin: 32px 0;">
          <a href="${verificationLink}" style="background:#111827;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 60 minutes. If you didn't create a WAPP account, you can safely ignore this email.</p>
      </div>
    `,
    text: `Verify your email address for WAPP: ${verificationLink} (expires in 60 minutes)`,
  };
}

export function buildPasswordResetEmail(resetLink: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "Reset your password — WAPP",
    html: `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111827;">Reset your password</h2>
        <p style="color: #374151;">We received a request to reset your WAPP account password. Click the button below to choose a new one.</p>
        <p style="margin: 32px 0;">
          <a href="${resetLink}" style="background:#111827;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
      </div>
    `,
    text: `Reset your WAPP password: ${resetLink} (expires in 30 minutes)`,
  };
}
