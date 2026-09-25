import { createAuthClient } from "better-auth/react";

// Browser-side calls to /api/auth; used from event handlers only.
export const authClient = createAuthClient();
