import type { DragEvent } from "react";

import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { startTransition, useOptimistic, useRef, useState } from "react";

import type { ActiveStatus } from "../../lib/workflow";

import { useAction, useViewer } from "../../components/hooks";
import { fieldError } from "../../components/ui";
import { formatTime, linkHost } from "../../lib/format";
import { fetchBoard, moveRequest } from "../../lib/requests.functions";
import { statusLabels } from "../../lib/workflow";

export const Route = createFileRoute("/_app/")({
  // Full SSR: the board is the page people glance at; it should be complete on first byte.
  ssr: true,
  loader: () => fetchBoard(),
  component: Board,
});

const cardAccent: Partial<Record<ActiveStatus, string>> = {
  printing: "border-l-3 border-l-accent",
  ready: "border-l-3 border-l-ok",
};

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
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(undefined);
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
      {error && <p className={fieldError}>{error}</p>}
      <div className="grid grid-cols-[repeat(4,minmax(220px,1fr))] gap-3.5 overflow-x-auto">
        {board.map(({ status, requests }) => (
          <section
            key={status}
            className={`flex min-h-50 flex-col gap-2.5 rounded-xl bg-sunken p-3 ${over === status ? "outline-2 -outline-offset-2 outline-accent outline-dashed" : ""}`}
            onDragOver={owner ? (event) => onDragOver(event, status) : undefined}
            onDragLeave={owner ? onDragLeave : undefined}
            onDrop={owner ? (event) => onDrop(event, status) : undefined}
          >
            <h2 className="mt-0 mb-1 flex justify-between text-[0.95rem]">
              {statusLabels[status]}{" "}
              <span className="font-normal text-muted">{requests.length}</span>
            </h2>
            {requests.length === 0 && <p className="m-0 text-[0.85rem] text-muted">Nothing here</p>}
            {requests.map((request) => (
              <Link
                key={request.id}
                to="/requests/$id"
                params={{ id: request.id }}
                className={`grid gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-[0.9rem] text-inherit no-underline hover:border-accent ${cardAccent[status] ?? ""} ${owner ? "cursor-grab" : ""}`}
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
                <strong>{request.title}</strong>
                <span>
                  {request.requesterName}
                  {request.quantity > 1 && ` · ×${request.quantity}`}
                </span>
                <span className="text-muted">
                  {request.material} · {request.color}
                </span>
                <span className="line-clamp-2 text-muted">
                  {request.link ? linkHost(request.link) : request.details}
                </span>
                <time className="text-[0.82rem] text-muted" dateTime={request.createdAt}>
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
