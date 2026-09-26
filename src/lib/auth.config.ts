import type { BetterAuthOptions } from "better-auth";

import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, haveIBeenPwned } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import type { Email } from "./mail.server";

type AuthEnv = {
  DB: BetterAuthOptions["database"];
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET: string;
  EMAIL_RATE_LIMIT: RateLimit;
};

// Kept free of Worker-only imports (hence sendEmail is passed in) so
// scripts/auth-schema.ts can reuse it.
export const authOptions = (env: AuthEnv, sendEmail: (email: Email) => void) =>
  ({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Invite only: owners create accounts from the Members page.
      disableSignUp: true,
      // sendEmail doesn't wait for delivery, so this replies just as fast whether
      // or not the address has an account.
      sendResetPassword: async ({ user, url }) =>
        sendEmail({
          to: user.email,
          subject: "Reset your Spool password",
          text: `Someone asked to reset the password for your Spool account. Choose a new one within the hour:\n\n${url}\n\nIf that wasn't you, ignore this email and your password stays the same.`,
        }),
      revokeSessionsOnPasswordReset: true,
    },
    // The schema is owned by migrations/ (generated from these options), and the
    // startup check would run at Worker module load, where D1 I/O isn't allowed.
    advanced: { database: { validateSchema: false } },
    hooks: {
      // The one endpoint anyone can call to make Spool email an address. Keyed by
      // the address, so spreading requests across IPs doesn't flood one inbox.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/request-password-reset") return;
        const key = String(ctx.body?.email).toLowerCase();

        if (!(await env.EMAIL_RATE_LIMIT.limit({ key })).success) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many emails to that address — try again in a minute",
          });
        }
      }),
    },
    plugins: [
      tanstackStartCookies(),
      haveIBeenPwned(),
      // "owner" is granted by hand in D1. Owners can invite, list and remove (ban)
      // members, nothing more: no impersonating, hard deletes or role changes.
      admin({
        roles: {
          owner: defaultAc.newRole({ user: ["create", "list", "get", "ban"], session: [] }),
          member: userAc,
        },
        adminRoles: ["owner"],
        defaultRole: "member",
        bannedUserMessage: "Your access to Spool was removed — ask the printer owner",
      }),
    ],
  }) satisfies BetterAuthOptions;
