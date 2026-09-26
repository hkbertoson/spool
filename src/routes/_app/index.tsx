import type { DragEvent } from "react";

import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { startTransition, useOptimistic, useRef, useState } from "react";

import type { ActiveStatus } from "../../lib/workflow";

import { useAction, useViewer } from "../../components/hooks";
import { fieldError, statusFill, tag } from "../../components/ui";
import { formatTime, linkHost } from "../../lib/format";
import { fetchBoard, moveRequest } from "../../lib/requests.functions";
import { statusLabels } from "../../lib/workflow";

export const Route = createFileRoute("/_app/")({
  // Full SSR: the board is the page people glance at; it should be complete on first byte.
  ssr: true,
  loader: () => fetchBoard(),
  component: Board,
});

type Move = { id: string; from: ActiveStatus; to: ActiveStatus };

function Board() {
  const columns = Route.useLoaderData();
  const { owner } = useViewer();
  const move = useServerFn(moveRequest);
  const { error, run } = useAction();
  const dragging = useRef<{ id: string; from: ActiveStatus }>(null);
  const [over, setOver] = useState<ActiveStatus>();

  // The card lands in its new column right away; if the server refuses, it snaps back when the transition ends.
  const [board, applyMove] = useOptimistic(columns, (current, { id, from, to }: Move) => {
    const card = current.find((c) => c.status === from)?.requests.find((r) => r.id === id);

    if (!card) return current;

    return current.map((column) => {
      if (column.status === from)
        return { ...column, requests: column.requests.filter((r) => r.id !== id) };

      if (column.status === to) {
        const requests = [...column.requests, { ...card, status: to }].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        );

        return { ...column, requests };
      }

      return column;
    });
  });

  const onDragOver = (event: DragEvent, status: ActiveStatus) => {
    if (!dragging.current || dragging.current.from === status) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(status);
  };

  const onDragLeave = (event: DragEvent) => {
    const leftTo = event.relatedTarget;

    if (!(leftTo instanceof Node && event.currentTarget.contains(leftTo))) setOver(undefined);
  };

  const onDrop = (event: DragEvent, to: ActiveStatus) => {
    event.preventDefault();
    setOver(undefined);
    const card = dragging.current;

    if (!card || card.from === to) return;
    startTransition(async () => {
      applyMove({ ...card, to });
      await run(() => move({ data: { ...card, to } }));
    });
  };

  return (
    <>
      {error && <p className={`${fieldError} mb-6`}>{error}</p>}
      {/* The padding leaves room for extrusions and the drop outline inside the scroll box. */}
      <div className="-m-3 grid grid-cols-board gap-4 overflow-x-auto p-3">
        {board.map(({ status, requests }) => (
          <section
            key={status}
            className={`flex min-h-50 flex-col gap-3 rounded-lg border-2 border-ink p-3 text-ink shadow-extrude ${statusFill[status]} ${over === status ? "outline-3 outline-offset-4 outline-fg outline-dashed" : ""}`}
            onDragOver={owner ? (event) => onDragOver(event, status) : undefined}
            onDragLeave={owner ? onDragLeave : undefined}
            onDrop={owner ? (event) => onDrop(event, status) : undefined}
          >
            <h2 className="m-0 flex items-center justify-between gap-2 text-lg">
              {statusLabels[status]}{" "}
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-surface text-sm text-fg">
                {requests.length}
              </span>
            </h2>
            {requests.length === 0 && (
              <p className="m-0 rounded-md border-2 border-dashed border-ink/40 p-3 text-center text-sm font-semibold text-ink/70">
                Nothing here
              </p>
            )}
            {requests.map((request) => (
              <Link
                key={request.id}
                to="/requests/$id"
                params={{ id: request.id }}
                className={`grid gap-1.5 rounded-md border-2 border-ink bg-surface p-3 text-sm font-normal text-fg no-underline shadow-extrude-sm transition duration-100 hover:-translate-0.5 hover:shadow-extrude motion-reduce:transition-none ${owner ? "cursor-grab" : ""}`}
                draggable={owner}
                onDragStart={(event) => {
                  dragging.current = { id: request.id, from: status };
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragging.current = null;
                  setOver(undefined);
                }}
              >
                <strong className="text-base leading-snug">{request.title}</strong>
                <span className="flex flex-wrap items-center gap-1.5">
                  {request.requesterName}
                  {request.quantity > 1 && <span className={tag.inverse}>×{request.quantity}</span>}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <span className={tag.plain}>{request.material}</span>
                  <span className={tag.plain}>{request.color}</span>
                </span>
                <span className="line-clamp-2 text-muted">
                  {request.link ? linkHost(request.link) : request.details}
                </span>
                <time className="text-xs text-muted" dateTime={request.createdAt}>
                  {formatTime(request.createdAt)}
                </time>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
