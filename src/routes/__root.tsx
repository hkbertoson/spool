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
import { button, tag } from "../components/ui";
import { authClient } from "../lib/auth-client";
import { fetchViewer } from "../lib/requests.functions";
import appCss from "../styles.css?url";

const cubePath = "M8 1 15 5v6l-7 4-7-4V5zM1 5l7 4 7-4M8 9v6";

const navTab =
  "rounded-md border-2 border-transparent px-2.5 py-1 font-bold text-fg no-underline hover:border-ink data-[status=active]:border-ink data-[status=active]:bg-fg data-[status=active]:text-bg";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Print Queue" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='${cubePath}' fill='%23ff7a2e' stroke='%23000' stroke-width='1.2' stroke-linejoin='round'/></svg>`,
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
      <header className="border-b-2 border-ink bg-surface">
        {/* Below lg the tabs and account drop to a second row so the logo and button share the first. */}
        <div className="mx-auto flex max-w-300 flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:gap-x-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-base font-black text-fg font-stretch-expanded no-underline sm:text-xl"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-6 fill-accent stroke-ink sm:size-7"
              strokeWidth={1.2}
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={cubePath} />
            </svg>
            Print Queue
          </Link>
          {user && (
            <>
              <nav className="flex gap-1 max-lg:order-last">
                <Link to="/" activeOptions={{ exact: true }} className={navTab}>
                  Board
                </Link>
                <Link to="/history" activeOptions={{ includeSearch: false }} className={navTab}>
                  History
                </Link>
              </nav>
              <Account />
              <Link to="/new" className={`${button.primary} max-lg:ml-auto`}>
                Request a print
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-300 px-4 pt-8 pb-16">
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
    <span className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm max-lg:order-last">
      <span className="font-bold max-sm:hidden">{user?.name}</span>
      {owner && <span className={tag.owner}>Printer owner</span>}
      <button type="button" className={button.link} disabled={pending} onClick={signOut}>
        Sign out
      </button>
    </span>
  );
}
