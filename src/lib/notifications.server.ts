import type { Db, PrintRequest } from "./requests.server";
import type { Status } from "./workflow";

import { statusLabels } from "./workflow";

// What the requester hears when their print moves along. Other changes (back to
// requested, picked up, withdrawn) aren't news to them.
const statusNews: Partial<Record<Status, string>> = {
  accepted: "was accepted and is in the queue",
  printing: "is on the printer",
  ready: "is ready for pickup",
  declined: "was declined",
};

type Recipient = { email: string };

// Who hears about what. Each query's joins are its recipient rules, and one row
// comes back per recipient. Returns the emails instead of sending them, so the
// caller picks when (mail.server.ts: after the response) and tests can read them.
export function createNotifier(db: Db, appUrl: string) {
  const openInSpool = (id: string) => `Open in Spool: ${appUrl}/requests/${id}`;

  return {
    // To the printer owners, unless they asked for it themselves.
    requested: async (id: string) => {
      const { results } = await db
        .prepare(
          `select r.*, u.name as requesterName, o.email from print_request r join "user" u on u.id = r.requesterId join "user" o on o.role = 'owner' and o.id != r.requesterId where r.id = ?`,
        )
        .bind(id)
        .all<PrintRequest & Recipient>();

      return results.map((request) => ({
        to: request.email,
        subject: `New request: ${request.title}`,
        text: [
          `${request.requesterName} requested "${request.title}" (${request.material}, ${request.color}, ×${request.quantity}).`,
          request.link,
          request.details,
          openInSpool(id),
        ]
          .filter(Boolean)
          .join("\n\n"),
      }));
    },

    // To the requester, unless they made the change themselves.
    statusChanged: async (id: string, actorId: string) => {
      const request = await db
        .prepare(
          `select r.*, u.name as requesterName, u.email from print_request r join "user" u on u.id = r.requesterId where r.id = ? and r.requesterId != ?`,
        )
        .bind(id, actorId)
        .first<PrintRequest & Recipient>();

      const news = request && statusNews[request.status];

      if (!request || !news) return [];

      return [
        {
          to: request.email,
          subject: `${statusLabels[request.status]}: ${request.title}`,
          text: [
            `Your request "${request.title}" ${news}.`,
            request.declineReason && `Reason: ${request.declineReason}`,
            openInSpool(id),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
    },

    // To the requester and the printer owners, minus whoever wrote it.
    commented: async (id: string, authorId: string, body: string) => {
      const { results } = await db
        .prepare(
          `select r.title, a.name as authorName, u.email from print_request r join "user" a on a.id = ? join "user" u on (u.role = 'owner' or u.id = r.requesterId) and u.id != a.id where r.id = ?`,
        )
        .bind(authorId, id)
        .all<Pick<PrintRequest, "title"> & { authorName: string } & Recipient>();

      return results.map((row) => ({
        to: row.email,
        subject: `${row.authorName} commented on ${row.title}`,
        text: [`${row.authorName} wrote:`, body, openInSpool(id)].join("\n\n"),
      }));
    },
  };
}
