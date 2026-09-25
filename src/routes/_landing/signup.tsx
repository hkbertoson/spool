import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { AuthForm, orThrow } from "../../components/AuthForm";
import { authClient } from "../../lib/auth-client";
import { redirectSchema } from "../../lib/workflow";

export const Route = createFileRoute("/_landing/signup")({
  validateSearch: redirectSchema,
  head: () => ({ meta: [{ title: "Create account · Print Queue" }] }),
  component: Signup,
});

function Signup() {
  const { redirect: next } = Route.useSearch();
  const navigate = useNavigate();

  const signUp = async (form: FormData) => {
    await orThrow(
      authClient.signUp.email(
        {
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
        },
        // Checked server-side by the sign-up hook in auth.config.ts.
        { headers: { "x-signup-code": String(form.get("code")) } },
      ),
    );
    await navigate({ href: next ?? "/" });
  };

  return (
    <>
      <h2 className="mt-0">Create an account</h2>
      <AuthForm submitLabel="Create account" onSubmit={signUp}>
        <label>
          Name
          <input name="name" required maxLength={40} autoComplete="name" autoFocus />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password (8+ characters)
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Office sign-up code
          <input name="code" required autoComplete="off" />
        </label>
      </AuthForm>
      <p className="text-muted">
        Already have an account?{" "}
        <Link to="/login" search={{ redirect: next }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
