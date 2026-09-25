import type { FormEvent } from "react";

import { Link, createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";

import { StatusBadge } from "../../components/StatusBadge";
import { button, panel, tag } from "../../components/ui";
import { formatTime, linkHost, plural } from "../../lib/format";
import { fetchHistory } from "../../lib/requests.functions";
import { archivedStatuses, historySearchSchema, materials, statusLabels } from "../../lib/workflow";

const periodLabels = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

export const Route = createFileRoute("/_app/history")({
  // Full SSR: filtered views are shareable URLs that should render complete.
  ssr: true,
  validateSearch: historySearchSchema,
  search: { middlewares: [stripSearchParams({ period: "all" })] },
  loaderDeps: ({ search: { status, material, q, period } }) => ({ status, material, q, period }),
  loader: ({ deps }) => fetchHistory({ data: deps }),
  head: () => ({ meta: [{ title: "History · Print Queue" }] }),
  component: History,
});

function History() {
  const requests = Route.useLoaderData();

  return (
    <>
      <h1>History</h1>
      <Filters />
      <p className="text-sm font-semibold text-muted">{plural(requests.length, "request")}</p>
      {requests.length === 0 ? (
        <p className={panel}>Nothing matches these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border-2 border-ink bg-surface shadow-extrude">
          <table className="w-full text-sm [&_:is(th,td)]:px-4 [&_:is(th,td)]:py-3 [&_:is(th,td)]:text-left">
            <thead className="bg-fg text-bg">
              <tr>
                <th>Print</th>
                <th>For</th>
                <th>Material</th>
                <th>Source</th>
                <th>Outcome</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-ink">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link to="/requests/$id" params={{ id: request.id }}>
                      {request.title}
                    </Link>
                  </td>
                  <td>{request.requesterName}</td>
                  <td>
                    <span className="flex gap-1.5">
                      <span className={tag.plain}>{request.material}</span>
                      <span className={tag.plain}>{request.color}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {request.link ? linkHost(request.link) : "Idea"}
                  </td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap">{formatTime(request.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Filters() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // The route schema normalizes blanks ("any") the same way the URL and server do.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate({
      search: historySearchSchema.parse(Object.fromEntries(new FormData(event.currentTarget))),
    });
  };
  const submitOnChange = (event: FormEvent<HTMLSelectElement>) =>
    event.currentTarget.form?.requestSubmit();

  // method="get" keeps filtering functional before hydration.
  return (
    <form
      className="my-4 flex flex-wrap gap-2"
      method="get"
      onSubmit={onSubmit}
      key={JSON.stringify(search)}
    >
      <select
        name="status"
        defaultValue={search.status ?? ""}
        onChange={submitOnChange}
        aria-label="Outcome"
      >
        <option value="">Any outcome</option>
        {archivedStatuses.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </select>
      <select
        name="material"
        defaultValue={search.material ?? ""}
        onChange={submitOnChange}
        aria-label="Material"
      >
        <option value="">Any material</option>
        {materials.map((m) => (
          <option key={m} value={m}>
            {m === "Any" ? "No preference" : m}
          </option>
        ))}
      </select>
      <select
        name="period"
        defaultValue={search.period}
        onChange={submitOnChange}
        aria-label="When"
      >
        {Object.entries(periodLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="q"
        type="search"
        className="grow basis-44"
        placeholder="Search print or person"
        defaultValue={search.q}
      />
      <button type="submit" className={button.primary}>
        Filter
      </button>
    </form>
  );
}
