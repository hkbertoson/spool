import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { AuthForm, orThrow } from "../../components/AuthForm";
import { authClient } from "../../lib/auth-client";
import { redirectSchema } from "../../lib/workflow";

export const Route = createFileRoute("/_landing/login")({
  validateSearch: redirectSchema,
  head: () => ({ meta: [{ title: "Sign in · Spool" }] }),
  component: Login,
});

function Login() {
  const { redirect: next } = Route.useSearch();
  const navigate = useNavigate();

  const signIn = async (form: FormData) => {
    await orThrow(
      authClient.signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
      }),
    );
    await navigate({ href: next ?? "/" });
  };

  return (
    <>
      <h2 className="mt-0">Sign in</h2>
      <AuthForm submitLabel="Sign in" onSubmit={signIn}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" autoFocus />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
      </AuthForm>
      <p className="text-muted">
        New here?{" "}
        <Link to="/signup" search={{ redirect: next }}>
          Create an account
        </Link>
      </p>
    </>
  );
}
