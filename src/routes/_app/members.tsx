import type { FormEvent } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { useAction, useViewer } from "../../components/hooks";
import { button, fieldError, form, panel, tag } from "../../components/ui";
import { fetchMembers, inviteMember, removeMember } from "../../lib/requests.functions";

export const Route = createFileRoute("/_app/members")({
  // UX only; fetchMembers and the actions check the owner role on the server.
  beforeLoad: ({ context: { viewer } }) => {
    if (!viewer.owner) throw redirect({ to: "/" });
  },
  loader: () => fetchMembers(),
  head: () => ({ meta: [{ title: "Members · Spool" }] }),
  component: Members,
});

function Members() {
  const members = Route.useLoaderData();
  const { user } = useViewer();
  const invite = useServerFn(inviteMember);
  const remove = useServerFn(removeMember);
  const { pending, error, run } = useAction();
  // Removing takes a second tap: easy to mis-tap a row on a phone.
  const [confirming, setConfirming] = useState<string>();

  const onInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    const data = new FormData(target);

    const sent = await run(() =>
      invite({ data: { name: String(data.get("name")), email: String(data.get("email")) } }),
    );

    if (sent) target.reset();
  };

  return (
    <>
      <h1>Members</h1>
      <form className={`${form} max-w-160`} onSubmit={onInvite}>
        <h2 className="m-0">Invite someone</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Name
            <input name="name" required maxLength={40} autoComplete="off" />
          </label>
          <label>
            Email
            <input name="email" type="email" required autoComplete="off" />
          </label>
        </div>
        <p className="m-0 text-sm text-muted">
          They'll get an email with a link to choose a password. It works for 7 days.
        </p>
        {error && <p className={fieldError}>{error}</p>}
        <button type="submit" className={button.primary} disabled={pending}>
          Send invite
        </button>
      </form>

      <ul className={`${panel} mt-6 grid max-w-160 list-none gap-5`}>
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 grow basis-48">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{member.name}</strong>
                {member.owner && <span className={tag.owner}>Printer owner</span>}
                {!member.joined && <span className={tag.plain}>Invited</span>}
              </div>
              <div className="text-sm wrap-anywhere text-muted">{member.email}</div>
            </div>
            {!member.owner &&
              member.id !== user?.id &&
              (confirming === member.id ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={button.danger}
                    disabled={pending}
                    onClick={() => run(() => remove({ data: { id: member.id } }))}
                  >
                    Remove {member.name.split(" ")[0]}
                  </button>
                  <button
                    type="button"
                    className={button.link}
                    disabled={pending}
                    onClick={() => setConfirming(undefined)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={button.secondary}
                  disabled={pending}
                  onClick={() => setConfirming(member.id)}
                >
                  Remove
                </button>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
