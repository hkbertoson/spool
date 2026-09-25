import { createRouter } from "@tanstack/react-router";

import { ErrorView, NotFound } from "./components/Feedback";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: ErrorView,
    defaultNotFoundComponent: NotFound,
  });
}
