import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { statusFill } from "../components/ui";
import { activeStatuses, statusLabels } from "../lib/workflow";

// Pathless layout for signed-out pages. The hero stays mounted between sign-in and
// sign-up, so its print animation plays once per visit rather than once per page.
export const Route = createFileRoute("/_landing")({
  beforeLoad: ({ context: { viewer } }) => {
    if (viewer.user) throw redirect({ to: "/" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="grid items-center gap-x-16 gap-y-12 lg:min-h-landing lg:grid-cols-5 lg:content-center">
      <section className="lg:col-span-3">
        <div className="relative">
          <h1 className="relative m-0 animate-print-in pb-3 text-6xl leading-none font-black text-accent text-outline text-shadow-extrude-sm after:pointer-events-none after:absolute after:inset-0 after:layer-lines motion-reduce:animate-none sm:text-8xl sm:text-shadow-extrude xl:text-9xl">
            Get it
            <br />
            printed.
          </h1>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 bottom-0 h-3 animate-print-head rounded-full border-2 border-ink bg-accent motion-reduce:hidden"
          />
        </div>
        <p className="mt-6 mb-0 max-w-xl text-lg sm:text-xl">
          Request prints from the 3D printer. Share a model link or describe an idea, then follow it
          all the way to pickup.
        </p>
        <ol className="mt-8 flex max-w-xl divide-x-2 divide-ink overflow-hidden rounded-lg border-2 border-ink shadow-extrude">
          {activeStatuses.map((status) => (
            <li
              key={status}
              className={`flex-1 px-2 py-2 text-center text-xs font-bold text-ink sm:text-sm ${statusFill[status]}`}
            >
              {statusLabels[status]}
            </li>
          ))}
        </ol>
      </section>
      <div className="lg:col-span-2">
        <Outlet />
      </div>
    </div>
  );
}
