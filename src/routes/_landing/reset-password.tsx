import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AuthForm, orThrow } from "../../components/AuthForm";
import { panel } from "../../components/ui";
import { authClient } from "../../lib/auth-client";
import { resetTokenSchema } from "../../lib/workflow";

export const Route = createFileRoute("/_landing/reset-password")({
  validateSearch: resetTokenSchema,
  head: () => ({ meta: [{ title: "Choose a password · Spool" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const [changed, setChanged] = useState(false);

  if (changed)
    return (
      <>
        <h2 className="mt-0">Password saved</h2>
        <p className={`${panel} max-w-96`}>
          <Link to="/login">Sign in</Link> with your new password. Any other devices were signed
          out.
        </p>
      </>
    );

  if (!token)
    return (
      <>
        <h2 className="mt-0">Link expired</h2>
        <p className={`${panel} max-w-96`}>
          That reset link has expired or was already used.{" "}
          <Link to="/forgot-password">Send a new one</Link>
        </p>
      </>
    );

  const reset = async (form: FormData) => {
    await orThrow(authClient.resetPassword({ newPassword: String(form.get("password")), token }));
    setChanged(true);
  };

  return (
    <>
      <h2 className="mt-0">Choose a password</h2>
      <AuthForm submitLabel="Save password" onSubmit={reset}>
        <label>
          Password (8+ characters)
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
          />
        </label>
      </AuthForm>
    </>
  );
}
