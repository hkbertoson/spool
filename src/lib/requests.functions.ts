import { notFound, redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth, invite } from "./auth.server";
import { sendLater } from "./mail.server";
import { notifier, requestStore } from "./store.server";
import {
  advanceSchema,
  commentSchema,
  declineSchema,
  historySearchSchema,
  inviteSchema,
  memberIdSchema,
  moveSchema,
  newRequestSchema,
  requestIdSchema,
} from "./workflow";

// Safe to import anywhere: the client build replaces each handler with an RPC
// stub, so the .server modules above never reach the browser bundle.

const withViewer = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequest().headers });

  return next({ context: { user: session?.user ?? null } });
});

// Server functions are public endpoints: every data function checks the
// session itself; the /_app route guard only decides what the UI shows.
const requireUser = createMiddleware({ type: "function" })
  .middleware([withViewer])
  .server(({ next, context: { user } }) => {
    if (!user) throw redirect({ to: "/login" });

    return next({
      context: { actor: { id: user.id, name: user.name, owner: user.role === "owner" } },
    });
  });

const requireOwner = createMiddleware({ type: "function" })
  .middleware([requireUser])
  .server(({ next, context: { actor } }) => {
    if (!actor.owner) throw new Error("Only the printer owner can do that");

    return next();
  });

export const fetchViewer = createServerFn({ method: "GET" })
  .middleware([withViewer])
  .handler(({ context: { user } }) => ({
    user: user && { id: user.id, name: user.name, email: user.email },
    owner: user?.role === "owner",
  }));

export const fetchBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(() => requestStore().board());

export const fetchHistory = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(historySearchSchema)
  .handler(({ data }) => requestStore().history(data));

export const fetchRequest = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(requestIdSchema)
  .handler(async ({ data }) => {
    const store = requestStore();
    const [request, events] = await Promise.all([store.get(data.id), store.events(data.id)]);

    if (!request) throw notFound();

    return { request, events };
  });

export const fetchComments = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(requestIdSchema)
  .handler(({ data }) => requestStore().comments(data.id));

export const submitRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator((form: FormData) => {
    const result = newRequestSchema.safeParse(Object.fromEntries(form));

    if (!result.success) throw new Error(z.prettifyError(result.error));

    return result.data;
  })
  .handler(async ({ data, context: { actor } }) => {
    const id = await requestStore().create(data, actor.id);
    sendLater(notifier().requested(id));
    throw redirect({ to: "/requests/$id", params: { id } });
  });

export const advanceRequest = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .validator(advanceSchema)
  .handler(async ({ data, context: { actor } }) => {
    await requestStore().advance(data.id, data.from, actor);
    sendLater(notifier().statusChanged(data.id, actor.id));
  });

export const moveRequest = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .validator(moveSchema)
  .handler(async ({ data, context: { actor } }) => {
    await requestStore().move(data.id, data.from, data.to, actor);
    sendLater(notifier().statusChanged(data.id, actor.id));
  });

export const declineRequest = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .validator(declineSchema)
  .handler(async ({ data, context: { actor } }) => {
    await requestStore().decline(data.id, data.reason, actor);
    sendLater(notifier().statusChanged(data.id, actor.id));
  });

export const withdrawRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(requestIdSchema)
  .handler(({ data, context: { actor } }) => requestStore().withdraw(data.id, actor));

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(commentSchema)
  .handler(async ({ data, context: { actor } }) => {
    await requestStore().addComment(data.id, actor.id, data.body);
    sendLater(notifier().commented(data.id, actor.id, data.body));
  });

export const fetchMembers = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(() => requestStore().members());

// The admin plugin re-checks the caller's role on both of these, from the session.
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .validator(inviteSchema)
  .handler(({ data, context: { actor } }) =>
    invite(data.name, data.email, actor.name, getRequest().headers),
  );

// A ban, not a delete: they can't sign in, but their requests and comments stay.
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .validator(memberIdSchema)
  .handler(async ({ data }) => {
    const member = (await requestStore().members()).find((m) => m.id === data.id);

    if (!member) throw new Error("No such member");

    if (member.owner) throw new Error("Printer owners can't be removed here");

    await auth.api.banUser({
      body: { userId: member.id, banReason: "Removed by the printer owner" },
      headers: getRequest().headers,
    });
  });
