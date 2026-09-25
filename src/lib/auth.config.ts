import type { BetterAuthOptions } from "better-auth";

import { APIError, createAuthMiddleware } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";

type AuthEnv = {
  DB: BetterAuthOptions["database"];
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET: string;
  SIGNUP_CODE: string;
};

const sha256 = async (text: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

// Constant-time so response timing doesn't reveal how much of the code matched.
async function sameSecret(a: string, b: string) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  return x.reduce((diff, byte, i) => diff | (byte ^ y[i]!), 0) === 0;
}

// Kept free of Worker-only imports so scripts/auth-schema.ts can reuse it.
export const authOptions = (env: AuthEnv) =>
  ({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: {
      additionalFields: {
        // "owner" is granted by hand in D1; input: false means sign-up can't set it.
        role: { type: "string", required: false, defaultValue: "member", input: false },
      },
    },
    // The schema is owned by migrations/ (generated from these options), and the
    // startup check would run at Worker module load, where D1 I/O isn't allowed.
    advanced: { database: { validateSchema: false } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const code = ctx.headers?.get("x-signup-code") ?? "";
        if (!env.SIGNUP_CODE || !(await sameSecret(code, env.SIGNUP_CODE))) {
          throw new APIError("FORBIDDEN", {
            message: "That sign-up code is not right — ask the printer owner",
          });
        }
      }),
    },
    plugins: [tanstackStartCookies()],
  }) satisfies BetterAuthOptions;
