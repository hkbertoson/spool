import { env } from "cloudflare:workers";

import { createNotifier } from "./notifications.server";
import { createRequestStore } from "./requests.server";

export const requestStore = () => createRequestStore(env.DB);

export const notifier = () => createNotifier(env.DB, env.BETTER_AUTH_URL);
