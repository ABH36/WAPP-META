export function buildInvitationEmail(
  workspaceName: string,
  inviteLink: string,
): { subject: string; html: string; text: string } {
  return {
    subject: `You've been invited to join ${workspaceName} on WAPP`,
    html: `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111827;">You've been invited to ${workspaceName}</h2>
        <p style="color: #374151;">Join your team's WAPP workspace to start collaborating on WhatsApp conversations, leads, and more.</p>
        <p style="margin: 32px 0;">
          <a href="${inviteLink}" style="background:#111827;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Accept Invitation</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">If you don't already have a WAPP account, you'll be asked to create one first with this same email address. This invitation expires in 7 days.</p>
      </div>
    `,
    text: `You've been invited to join ${workspaceName} on WAPP: ${inviteLink} (expires in 7 days)`,
  };
}
