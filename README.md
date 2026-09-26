# Spool

[![Built with Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)

[![CI](https://github.com/hkbertoson/spool/actions/workflows/ci.yml/badge.svg)](https://github.com/hkbertoson/spool/actions/workflows/ci.yml)

[![License: MIT](https://shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)

A request board for the home 3D printer. People share a link to a model (Printables, MakerWorld, Thingiverse…) or describe an idea, then follow it through **Requested → Accepted → Printing → Ready for pickup**.

Built with [TanStack Start](https://tanstack.com/start) (React 19, SSR), [Better Auth](https://better-auth.com), Tailwind CSS 4 and Zod, running on Cloudflare Workers with D1. Email goes through Cloudflare Email Sending or [Resend](https://resend.com).

## Features

- **Invite only.** Public sign-up is off (`disableSignUp`). Owners invite people by name and email from the Members page (Better Auth's admin plugin creates the account), and the emailed link lets them choose a password; it lasts 7 days, and after that "Forgot your password?" works too. **Remove** bans rather than deletes, so the person can't sign in but their requests and comments stay. The admin plugin's `owner` role can only create, list and ban users: no impersonation, hard deletes or role changes.
- **The printer owner** (`user.role = 'owner'`) accepts requests, moves them forward one step at a time from the request page (or to any active column by dragging a card on the board), or declines them with a reason. Owner is granted by hand in D1; nothing in the app can set `role`.
- **Requesters** can withdraw their own request until printing starts. Each request also has a comment thread and a progress timeline.
- **History** shows finished, declined and withdrawn requests, filterable by outcome, material, text and time range. The filters live in the URL.
- **Email**: owners hear about new requests; requesters hear when their print is accepted, printing, ready for pickup or declined; comments go to the requester and owners, minus the author. Nobody is emailed about their own action. Forgotten passwords are reset by an emailed link that lasts an hour, and using it signs out every other session. Emails are sent after the response (`waitUntil`), so a failed send never slows or undoes the action. Password-reset requests, which anyone can make, are capped at 2 a minute per address by `EMAIL_RATE_LIMIT`.

## Requirements

- Node 26 (pinned in `.node-version`)
- pnpm 12 (pinned in `package.json` as `packageManager`; any pnpm switches to that version itself)
- A Cloudflare account, for deploying. Local development needs none.

## Local development

```sh
pnpm install
cp .dev.vars.example .dev.vars   # set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:migrate                  # apply migrations to the local D1
pnpm dev                         # http://localhost:3000, running in workerd
```

`pnpm preview` serves the production build locally, also in workerd.

Emails aren't sent locally: the dev server prints each one, with the path of a file holding its text. That's where invite and password-reset links end up. With `RESEND_API_KEY` set in `.dev.vars`, they really go out through Resend.

`.dev.vars` sets `BETTER_AUTH_URL=http://localhost:3000` so local sign-in passes Better Auth's origin check. To sign in on `pnpm preview` (another port), change it to match.

To sign in locally, create the first owner as described under [First owner](#first-owner), with `--local` instead of `--remote`.

## Deployment

`wrangler.jsonc` holds no account-specific values. If you have more than one Cloudflare account, put `CLOUDFLARE_ACCOUNT_ID=…` in a `.env` file (gitignored). The `EMAIL_RATE_LIMIT` binding (Workers Rate Limiting) needs no setup, and the D1 database is created on the first deploy.

### Configuration

| Name                 | Required        | What it is                                                             |
| -------------------- | --------------- | ---------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | yes             | Signs sessions. `openssl rand -base64 32`                              |
| `BETTER_AUTH_URL`    | yes             | The Worker's public URL, e.g. `https://<name>.<subdomain>.workers.dev` |
| `EMAIL_FROM`         | yes             | Sender address, on a domain verified with your email provider          |
| `RESEND_API_KEY`     | for Resend only | Sends through Resend instead of Cloudflare Email Sending               |

Set each with `npx wrangler secret put <NAME>`. `wrangler.jsonc` sets `keep_vars`, so values added in the dashboard also survive deploys.

### Email

Email goes out through one of two providers, and `EMAIL_FROM` must be on a domain verified with it:

- **Cloudflare Email Sending** (default): the `EMAIL` binding. Check your domain with `npx wrangler email sending list`.
- **[Resend](https://resend.com)**: set a `RESEND_API_KEY` secret and it's used instead. Without Cloudflare Email Service you can then delete the `send_email` block from `wrangler.jsonc`.

Another provider is one more function in `src/lib/mail.server.ts`. With neither configured, the app still works and each send logs an error.

### Deploying

First deploy:

```sh
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put EMAIL_FROM
pnpm build && npx wrangler deploy   # creates the D1 database
pnpm run deploy                     # applies the migrations to it
```

After that:

```sh
pnpm run deploy    # build → apply pending D1 migrations → deploy (plain `pnpm deploy` is a pnpm built-in)
```

### First owner

Spool is invite only: owners invite people from the **Members** page. On a fresh database there's nobody to send the first invite, so add the first owner by hand, then use **Forgot your password?** on the sign-in page to set their password:

```sh
npx wrangler d1 execute DB --remote --command "INSERT INTO \"user\" (id, name, email, emailVerified, createdAt, updatedAt, role) VALUES (lower(hex(randomblob(16))), 'Your Name', 'you@example.com', 1, datetime('now'), datetime('now'), 'owner')"
```

Make an existing member a printer owner:

```sh
npx wrangler d1 execute DB --remote \
  --command "UPDATE \"user\" SET role = 'owner' WHERE email = 'you@example.com'"
```

Use `--local` instead of `--remote` for local dev. Role changes take effect on their next page load.

## Development

| Command                       | What it does                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm test`                   | Vitest against in-memory SQLite (`node:sqlite`) with the real D1 migrations applied |
| `pnpm typecheck`              | `tsc --noEmit`                                                                      |
| `pnpm lint` / `pnpm lint:fix` | Oxlint, including the vendored anti-slop rules in `tools/oxlint/anti-slop`          |
| `pnpm fmt` / `pnpm fmt:check` | Oxfmt: formatting, import order and Tailwind class order                            |
| `pnpm cf-typegen`             | Regenerates `worker-configuration.d.ts` from `wrangler.jsonc` and `.dev.vars`       |

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests and build on every pull request and push to `main`.

Conventions the lint rules enforce:

- Type assertions (`as`) need a `// SAFETY:` comment saying why they hold. Prefer a runtime check (`instanceof`, a Zod parse) where one exists.
- No `unknown` in return types or dictionary values: parse at the boundary and pass named types on.
- Blank lines between declarations and logical groups of statements. `pnpm lint:fix` adds them.

Generated files, not edited by hand: `src/routeTree.gen.ts` (TanStack Router, rewritten on every build and dev run) and `worker-configuration.d.ts` (`pnpm cf-typegen`, rerun after changing bindings or `.dev.vars` keys).

## Layout

| Path                                        | Role                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/workflow.ts`                       | Status rules + Zod schemas, shared by the UI, URL validation and server validation                                                        |
| `src/lib/requests.functions.ts`             | `createServerFn`s: the only way into data. Every one checks the session (`requireUser` / `requireOwner` middleware)                       |
| `src/lib/requests.server.ts`                | SQL over D1. Status changes are a single conditional `UPDATE` plus an event row in one batch, so double-clicks and races can't skip steps |
| `src/lib/notifications.server.ts`           | Who gets which email: one query per event, whose joins are the recipient rules                                                            |
| `src/lib/mail.server.ts`                    | Picks the email provider and sends after the response (`waitUntil`), logging failures                                                     |
| `src/lib/auth.config.ts`                    | Better Auth options (invite only, admin plugin roles, reset email, rate limit hook), free of Worker imports                               |
| `src/lib/auth.server.ts`, `store.server.ts` | Bind those to the Worker's `env` (`cloudflare:workers`); `auth.server.ts` also sends invites                                              |
| `src/lib/test-db.ts`                        | The in-memory SQLite stand-in for D1 used by the tests                                                                                    |
| `src/routes/_app.tsx`, `_app/`              | Signed-in pages: board, new request, request detail, history, members. The layout sends signed-out visitors to `/login`                   |
| `src/routes/_landing.tsx`, `_landing/`      | Signed-out pages: landing, sign in, forgot and reset password                                                                             |
| `src/routes/api/auth/$.ts`                  | Better Auth's HTTP endpoints                                                                                                              |
| `migrations/`                               | D1 schema. `node scripts/auth-schema.ts` prints the auth tables the options need                                                          |
| `tools/oxlint/anti-slop/`                   | Vendored Oxlint plugin behind the conventions above                                                                                       |

Files ending in `.server.ts` are protected: the build fails if browser code imports them. Server functions are public HTTP endpoints, so the `_app` route guard is only for the UI; the security checks live in the middleware.

## SSR

Every page is server-rendered (`ssr: true`). On a request page the ticket renders immediately, and the comment thread streams into the same response when its D1 query resolves.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm test`; CI runs the same checks. Schema changes go in a new numbered file in `migrations/`, never in an existing one. For a change people will notice, add a changeset with `pnpm changeset`: pick the bump (patch, minor or major) and describe it for users.

## Releases

Changes are recorded in [CHANGELOG.md](CHANGELOG.md) with [Changesets](https://github.com/changesets/changesets). To cut a release, run `pnpm changeset version` on `main`: it bumps `package.json`, rolls the pending `.changeset/*.md` files into the changelog and deletes them. Commit the result, then deploy.

## License

[MIT](LICENSE)
