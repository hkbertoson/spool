import type { ErrorComponentProps } from "@tanstack/react-router";

import { ErrorComponent, Link, useRouter } from "@tanstack/react-router";

import { button, panel } from "./ui";

export function ErrorView({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className={panel}>
      <ErrorComponent error={error} />
      <button type="button" className={button.primary} onClick={() => router.invalidate()}>
        Retry
      </button>
    </div>
  );
}

export function NotFound() {
  return (
    <div className={panel}>
      <h2 className="mt-0">Not found</h2>
      <p>That page or record doesn't exist.</p>
      <Link to="/">Back to dashboard</Link>
    </div>
  );
}

export function Pending({ label }: { label: string }) {
  return <p className="py-3 text-muted">{label}…</p>;
}
