import type { FormEvent, ReactNode } from "react";

import { useAction } from "./hooks";
import { button, fieldError, form } from "./ui";

// Better Auth's client resolves errors instead of throwing; surface them.
export const orThrow = async <T,>(call: Promise<{ error: { message?: string } | null } & T>) => {
  const result = await call;
  if (result.error) throw new Error(result.error.message ?? "Something went wrong");
  return result;
};

export function AuthForm({
  submitLabel,
  onSubmit,
  children,
}: {
  submitLabel: string;
  onSubmit: (form: FormData) => Promise<unknown>;
  children: ReactNode;
}) {
  const { pending, error, run } = useAction();
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(() => onSubmit(new FormData(event.currentTarget)));
  };
  return (
    <form className={`${form} max-w-85`} onSubmit={handle}>
      {children}
      {error && <p className={fieldError}>{error}</p>}
      <button type="submit" className={button.primary} disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
