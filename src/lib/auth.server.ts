import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";

import { authOptions } from "./auth.config";

export const auth = betterAuth(authOptions(env));
