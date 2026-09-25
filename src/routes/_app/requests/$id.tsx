import type { FormEvent } from "react";

import { Await, Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import type { Status } from "../../../lib/workflow";

import { Pending } from "../../../components/Feedback";
import { useAction, useViewer } from "../../../components/hooks";
import { StatusBadge } from "../../../components/StatusBadge";
import { button, fieldError, form, panel, tag } from "../../../components/ui";
import { formatTime, linkHost } from "../../../lib/format";
import {
  addComment,
  advanceRequest,
  declineRequest,
  fetchComments,
  fetchRequest,
  withdrawRequest,
} from "../../../lib/requests.functions";
import { advanceLabels, canDecline, canWithdraw, requestIdSchema } from "../../../lib/workflow";

export const Route = createFileRoute("/_app/requests/$id")({
  // Full SSR + streaming: the ticket renders in the first flush; the comment
  // thread is a separate query whose promise streams into the same response.
  ssr: true,
  loader: async ({ params: { id } }) => {
    if (!requestIdSchema.safeParse({ id }).success) throw notFound();
    const comments = fetchComments({ data: { id } });
    const { request, events } = await fetchRequest({ data: { id } });
    return { request, events, comments };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.request.title} · Print Queue` : "Request · Print Queue" },
    ],
  }),
  component: RequestPage,
});

function RequestPage() {
  const { request, events, comments } = Route.useLoaderData();
  const { user } = useViewer();
  const mine = request.requesterId === user?.id;

  return (
    <>
      <p>
        <Link to="/">← Board</Link>
      </p>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="m-0">{request.title}</h1>
        <StatusBadge status={request.status} />
      </div>

      {request.status === "declined" && (
        <p className="rounded-lg border-2 border-ink bg-declined px-4 py-3 text-ink shadow-extrude-sm">
          <strong>Declined:</strong> {request.declineReason}
        </p>
      )}

      <div className="grid items-start gap-6 md:grid-cols-3">
        <section className={`${panel} md:col-span-2`}>
          <dl className="m-0 grid grid-cols-label gap-x-6 gap-y-2 [&_dd]:wrap-anywhere [&_dt]:font-bold [&_dt]:text-muted">
            <dt>For</dt>
            <dd>
              {request.requesterName}
              {mine && <span className="text-muted"> (you)</span>}
            </dd>
            <dt>Material</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <span className={tag.plain}>{request.material}</span>
              <span className={tag.plain}>{request.color}</span>
              <span className={tag.inverse}>×{request.quantity}</span>
            </dd>
            {request.link && (
              <>
                <dt>Model</dt>
                <dd>
                  <a href={request.link} target="_blank" rel="noopener noreferrer nofollow">
                    {linkHost(request.link)} ↗
                  </a>
                </dd>
              </>
            )}
            {request.details && (
              <>
                <dt>{request.link ? "Notes" : "Idea"}</dt>
                <dd className="whitespace-pre-wrap">{request.details}</dd>
              </>
            )}
          </dl>
          <Actions id={request.id} status={request.status} mine={mine} />
        </section>

        <section className={panel}>
          <h2 className="mt-0">Progress</h2>
          <ol className="m-0 grid list-decimal gap-3 pl-5 marker:font-bold">
            {events.map((event, i) => (
              <li key={i}>
                <StatusBadge status={event.status} />
                <span className="mt-1 block text-xs text-muted">
                  {event.actorName}, {formatTime(event.at)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <h2>Conversation</h2>
      <Await promise={comments} fallback={<Pending label="Loading comments" />}>
        {(thread) =>
          thread.length === 0 ? (
            <p className="text-muted">No comments yet.</p>
          ) : (
            <ol className="my-4 grid max-w-160 list-none gap-3 p-0">
              {thread.map((comment, i) => (
                <li
                  key={i}
                  className="rounded-lg border-2 border-ink bg-surface px-4 py-3 shadow-extrude-sm"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <strong>{comment.authorName}</strong>
                    {comment.fromOwner && <span className={tag.owner}>Printer owner</span>}
                    <span className="text-muted">{formatTime(comment.at)}</span>
                  </div>
                  <p className="mt-1.5 mb-0 whitespace-pre-wrap">{comment.body}</p>
                </li>
              ))}
            </ol>
          )
        }
      </Await>
      <CommentForm id={request.id} />
    </>
  );
}

function Actions({ id, status, mine }: { id: string; status: Status; mine: boolean }) {
  const { owner } = useViewer();
  const advance = useServerFn(advanceRequest);
  const decline = useServerFn(declineRequest);
  const withdraw = useServerFn(withdrawRequest);
  const { pending, error, run } = useAction();
  const [declining, setDeclining] = useState(false);
  const nextLabel = advanceLabels[status];

  const onDecline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    if (await run(() => decline({ data: { id, reason } }))) setDeclining(false);
  };

  const ownerActions = owner && (nextLabel || canDecline(status));
  const withdrawable = (mine || owner) && canWithdraw(status);
  if (!ownerActions && !withdrawable) return null;

  return (
    <div className="mt-5 grid gap-3 border-t-2 border-ink pt-5">
      <div className="flex flex-wrap items-center gap-3">
        {owner && nextLabel && (
          <button
            type="button"
            className={button.primary}
            disabled={pending}
            onClick={() => run(() => advance({ data: { id, from: status } }))}
          >
            {nextLabel}
          </button>
        )}
        {owner && canDecline(status) && !declining && (
          <button
            type="button"
            className={button.secondary}
            disabled={pending}
            onClick={() => setDeclining(true)}
          >
            Decline…
          </button>
        )}
        {withdrawable && (
          <button
            type="button"
            className={button.danger}
            disabled={pending}
            onClick={() => run(() => withdraw({ data: { id } }))}
          >
            Withdraw
          </button>
        )}
      </div>
      {declining && (
        <form className="flex flex-wrap items-center gap-3" onSubmit={onDecline}>
          <input
            className="grow basis-64"
            name="reason"
            required
            maxLength={500}
            placeholder="Why? e.g. too big for the bed (256 mm max)"
            autoFocus
          />
          <button type="submit" className={button.danger} disabled={pending}>
            Decline
          </button>
          <button type="button" className={button.link} onClick={() => setDeclining(false)}>
            Cancel
          </button>
        </form>
      )}
      {error && <p className={fieldError}>{error}</p>}
    </div>
  );
}

function CommentForm({ id }: { id: string }) {
  const { owner } = useViewer();
  const comment = useServerFn(addComment);
  const { pending, error, run } = useAction();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = String(new FormData(formElement).get("body") ?? "");
    if (await run(() => comment({ data: { id, body } }))) formElement.reset();
  };

  return (
    <form className={`${form} mt-3 max-w-160`} onSubmit={onSubmit}>
      <textarea
        name="body"
        rows={2}
        required
        maxLength={2000}
        placeholder={owner ? "Reply as printer owner…" : "Ask or add details…"}
      />
      {error && <p className={fieldError}>{error}</p>}
      <button type="submit" className={button.primary} disabled={pending}>
        Comment
      </button>
    </form>
  );
}
