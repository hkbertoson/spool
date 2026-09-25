import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

// Pathless layout: everything inside needs a signed-in user. This is the UX
// half; the server functions enforce the same rule on every call.
export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context: { viewer }, location }) => {
    if (!viewer.user) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { user: viewer.user };
  },
  component: Outlet,
});
