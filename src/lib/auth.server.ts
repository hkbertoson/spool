import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";

import { authOptions } from "./auth.config";
import { sendLater } from "./mail.server";

export const auth = betterAuth(authOptions(env, (email) => sendLater([email])));

const inviteDays = 7;

// Creates the account (the admin plugin checks the caller may) and emails a
// set-your-password link. The link is a password-reset token written directly,
// because Better Auth's own reset tokens expire after an hour; its reset
// endpoints look tokens up by this "reset-password:" identifier.
export async function invite(name: string, email: string, inviterName: string, headers: Headers) {
  const { user } = await auth.api.createUser({ body: { name, email }, headers });
  const { internalAdapter } = await auth.$context;
  const token = crypto.randomUUID().replaceAll("-", "");
  await internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: user.id,
    expiresAt: new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000),
  });
  const url = `${env.BETTER_AUTH_URL}/api/auth/reset-password/${token}?callbackURL=%2Freset-password`;
  sendLater([
    {
      to: user.email,
      subject: `${inviterName} invited you to Spool`,
      text: `${inviterName} invited you to Spool, the request board for the 3D printer. Choose a password to get started — the link works for ${inviteDays} days:\n\n${url}\n\nIt expired? Use "Forgot your password?" on the sign-in page.`,
    },
  ]);
}
