# Spool

[![Built with Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)

[![License: MIT](https://shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)

A request board for the home 3D printer. People share a link to a model (Printables, MakerWorld, Thingiverse…) or describe an idea, then follow it through **Requested → Accepted → Printing → Ready for pickup**. It runs on Cloudflare Workers with D1 and Better Auth.

## Local development

```sh
pnpm install
cp .dev.vars.example .dev.vars   # set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:migrate                  # apply migrations to the local D1
pnpm dev                         # http://localhost:3000, running in workerd
pnpm typecheck && pnpm test
```

`pnpm preview` serves the production build locally, also in workerd.

Emails aren't sent locally: the dev server prints each one, with the path of a file holding its text. That's where invite and password-reset links end up. With `RESEND_API_KEY` set in `.dev.vars`, they really go out through Resend.

## Deployment

`wrangler.jsonc` holds no account-specific values. If you have more than one Cloudflare account, put `CLOUDFLARE_ACCOUNT_ID=…` in a `.env` file (gitignored). The `EMAIL_RATE_LIMIT` binding (Workers Rate Limiting) needs no setup.

Email goes out through one of two providers, and `EMAIL_FROM` must be on a domain verified with it:

- **Cloudflare Email Sending** (default): the `EMAIL` binding. Check your domain with `npx wrangler email sending list`.
- **[Resend](https://resend.com)**: set a `RESEND_API_KEY` secret and it's used instead.

Another provider is one more function in `src/lib/mail.server.ts`.

First deploy:

```sh
npx wrangler secret put BETTER_AUTH_SECRET   # openssl rand -base64 32
npx wrangler secret put BETTER_AUTH_URL      # your Worker's URL, e.g. https://<name>.<subdomain>.workers.dev
npx wrangler secret put EMAIL_FROM           # e.g. spool@yourdomain.com
pnpm build && npx wrangler deploy            # creates the D1 database on first deploy
pnpm run deploy                              # applies the migrations to it
```

After that:

```sh
pnpm run deploy    # build → apply pending D1 migrations → deploy (plain `pnpm deploy` is a pnpm built-in)
```

Spool is invite only: owners invite people from the **Members** page. Make an existing member a printer owner:

```sh
npx wrangler d1 execute DB --remote \
  --command "UPDATE \"user\" SET role = 'owner' WHERE email = 'you@example.com'"
```

On a fresh database there's nobody to send the first invite, so add the first owner by hand, then use **Forgot your password?** on the sign-in page to set their password:

```sh
npx wrangler d1 execute DB --remote --command "INSERT INTO \"user\" (id, name, email, emailVerified, createdAt, updatedAt, role) VALUES (lower(hex(randomblob(16))), 'Your Name', 'you@example.com', 1, datetime('now'), datetime('now'), 'owner')"
```

Use `--local` instead of `--remote` for local dev. Role changes take effect on their next page load.

`.dev.vars` sets `BETTER_AUTH_URL=http://localhost:3000` so local sign-in passes Better Auth's origin check. To sign in on `pnpm preview` (another port), change it to match.

## How it works

- **Invite only.** Public sign-up is off (`disableSignUp`). Owners invite people by name and email from the Members page (Better Auth's admin plugin creates the account), and the emailed link lets them choose a password; it lasts 7 days, and after that "Forgot your password?" works too. **Remove** bans rather than deletes, so the person can't sign in but their requests and comments stay. The admin plugin's `owner` role can only create, list and ban users: no impersonation, hard deletes or role changes.
- **The printer owner** (`user.role = 'owner'`) accepts requests, moves them forward one step at a time from the request page (or to any active column by dragging a card on the board), or declines them with a reason. Owner is granted by hand in D1; nothing in the app can set `role`.
- **Requesters** can withdraw their own request until printing starts. Each request also has a comment thread and a progress timeline.
- **History** shows finished, declined and withdrawn requests, filterable by outcome, material, text and time range. The filters live in the URL.
- **Email**: owners hear about new requests; requesters hear when their print is accepted, printing, ready for pickup or declined; comments go to the requester and owners, minus the author. Nobody is emailed about their own action. Forgotten passwords are reset by an emailed link that lasts an hour, and using it signs out every other session. Emails are sent after the response (`waitUntil`), so a failed send never slows or undoes the action. Password-reset requests, which anyone can make, are capped at 2 a minute per address by `EMAIL_RATE_LIMIT`.

## Layout

| Path                                        | Role                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/workflow.ts`                       | Status rules + Zod schemas, shared by the UI, URL validation and server validation                                                        |
| `src/lib/requests.functions.ts`             | `createServerFn`s: the only way into data. Every one checks the session (`requireUser` / `requireOwner` middleware)                       |
| `src/lib/requests.server.ts`                | SQL over D1. Status changes are a single conditional `UPDATE` plus an event row in one batch, so double-clicks and races can't skip steps |
| `src/lib/notifications.server.ts`           | Who gets which email: one query per event, whose joins are the recipient rules                                                            |
| `src/lib/mail.server.ts`                    | Sends through Resend or the `EMAIL` binding after the response (`waitUntil`), logging failures                                            |
| `src/lib/auth.config.ts`                    | Better Auth options (invite only, admin plugin roles, reset email, rate limit hook), free of Worker imports                               |
| `src/lib/auth.server.ts`, `store.server.ts` | Bind those to the Worker's `env` (`cloudflare:workers`); `auth.server.ts` also sends invites                                              |
| `src/routes/_app.tsx`                       | Pathless layout that sends signed-out visitors to `/login`                                                                                |
| `src/routes/api/auth/$.ts`                  | Better Auth's HTTP endpoints                                                                                                              |
| `migrations/`                               | D1 schema. `node scripts/auth-schema.ts` prints the auth tables the options need                                                          |

Files ending in `.server.ts` are protected: the build fails if browser code imports them. Server functions are public HTTP endpoints, so the `_app` route guard is only for the UI; the security checks live in the middleware.

## SSR

Every page is server-rendered (`ssr: true`). On a request page the ticket renders immediately, and the comment thread streams into the same response when its D1 query resolves.
