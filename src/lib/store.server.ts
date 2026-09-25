import { env } from "cloudflare:workers";

import { createRequestStore } from "./requests.server";

export const requestStore = () => createRequestStore(env.DB);
