import type { FormEvent } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { useAction } from "../../components/hooks";
import { button, fieldError, form } from "../../components/ui";
import { submitRequest } from "../../lib/requests.functions";
import { materials } from "../../lib/workflow";

export const Route = createFileRoute("/_app/new")({
  // Full SSR: a static form; the requester comes from the session.
  ssr: true,
  head: () => ({ meta: [{ title: "Request a print · Print Queue" }] }),
  component: NewRequest,
});

function NewRequest() {
  // useServerFn routes the redirect thrown by submitRequest through the router.
  const submit = useServerFn(submitRequest);
  const { pending, error, run } = useAction();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(() => submit({ data: form }));
  };

  return (
    <>
      <h1>Request a print</h1>
      <form className={`${form} max-w-160`} onSubmit={onSubmit}>
        <label>
          What is it?
          <input
            name="title"
            required
            maxLength={80}
            placeholder="Cable clips for the meeting room"
          />
        </label>
        <label>
          Link to the model{" "}
          <span className="font-normal text-muted">(Printables, MakerWorld, Thingiverse…)</span>
          <input
            name="link"
            type="url"
            maxLength={500}
            placeholder="https://www.printables.com/model/…"
          />
        </label>
        <label>
          Or describe your idea{" "}
          <span className="font-normal text-muted">(and any notes for the printer)</span>
          <textarea
            name="details"
            rows={4}
            maxLength={2000}
            placeholder="A little stand that holds my phone upright next to the monitor…"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            Material
            <select name="material" defaultValue="Any">
              {materials.map((m) => (
                <option key={m} value={m}>
                  {m === "Any" ? "No preference" : m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Color
            <input name="color" maxLength={30} placeholder="Any" />
          </label>
          <label>
            Quantity
            <input name="quantity" type="number" min={1} max={20} defaultValue={1} required />
          </label>
        </div>
        {error && <pre className={fieldError}>{error}</pre>}
        <button type="submit" className={button.primary} disabled={pending}>
          {pending ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </>
  );
}
