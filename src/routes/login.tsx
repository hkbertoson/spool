import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { AuthForm, orThrow } from "../components/AuthForm";
import { authClient } from "../lib/auth-client";
import { redirectSchema } from "../lib/workflow";

export const Route = createFileRoute("/login")({
  validateSearch: redirectSchema,
  beforeLoad: ({ context: { viewer } }) => {
    if (viewer.user) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Sign in · Print Queue" }] }),
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
      <h1>Sign in</h1>
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
