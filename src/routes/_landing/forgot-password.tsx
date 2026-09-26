import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AuthForm, orThrow } from "../../components/AuthForm";
import { panel } from "../../components/ui";
import { authClient } from "../../lib/auth-client";

export const Route = createFileRoute("/_landing/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password · Spool" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string>();

  const requestReset = async (form: FormData) => {
    const email = String(form.get("email"));
    await orThrow(authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }));
    setSentTo(email);
  };

  return (
    <>
      <h2 className="mt-0">Reset your password</h2>
      {sentTo ? (
        // Same answer either way, so this page can't be used to check who has an account.
        <p className={`${panel} max-w-96`}>
          If <strong>{sentTo}</strong> has an account, a reset link is on its way. It works for an
          hour.
        </p>
      ) : (
        <AuthForm submitLabel="Email me a link" onSubmit={requestReset}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" autoFocus />
          </label>
        </AuthForm>
      )}
      <p className="text-muted">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
    </>
  );
}
