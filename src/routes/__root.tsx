import type { ReactNode } from "react";

import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useNavigate,
} from "@tanstack/react-router";

import { useAction, useViewer } from "../components/hooks";
import { button } from "../components/ui";
import { authClient } from "../lib/auth-client";
import { fetchViewer } from "../lib/requests.functions";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Print Queue" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1 15 5v6l-7 4-7-4V5z' fill='%23f28c28'/></svg>",
      },
    ],
  }),
  // Resolved from the session cookie on the server; every route sees context.viewer.
  beforeLoad: async () => ({ viewer: await fetchViewer() }),
  shellComponent: RootDocument,
  component: Layout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Layout() {
  const { user } = useViewer();
  return (
    <>
      <header className="flex flex-wrap items-center gap-5 border-b border-line bg-surface px-4 py-2.5">
        <Link to="/" className="font-semibold text-fg no-underline">
          Print Queue
        </Link>
        {user && (
          <>
            <nav className="flex gap-4">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                className="text-muted no-underline data-[status=active]:font-semibold data-[status=active]:text-fg"
              >
                Board
              </Link>
              <Link
                to="/history"
                activeOptions={{ includeSearch: false }}
                className="text-muted no-underline data-[status=active]:font-semibold data-[status=active]:text-fg"
              >
                History
              </Link>
            </nav>
            <Account />
            <Link to="/new" className={button.primary}>
              Request a print
            </Link>
          </>
        )}
      </header>
      <main className="mx-auto max-w-300 px-4 pt-6 pb-16">
        <Outlet />
      </main>
    </>
  );
}

function Account() {
  const { user, owner } = useViewer();
  const navigate = useNavigate();
  const { pending, run } = useAction();

  const signOut = async () => {
    if (await run(() => authClient.signOut())) navigate({ to: "/login" });
  };

  return (
    <span className="ml-auto text-[0.9rem]">
      {user?.name}
      {owner && <span className="text-muted"> · printer owner</span>} ·{" "}
      <button type="button" className={button.link} disabled={pending} onClick={signOut}>
        Sign out
      </button>
    </span>
  );
}
