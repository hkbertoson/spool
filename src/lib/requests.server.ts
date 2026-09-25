import type { HistorySearch, Material, NewRequest, Status } from "./workflow";

import {
  activeStatuses,
  archivedStatuses,
  declinableStatuses,
  nextStatus,
  statusLabels,
  withdrawableStatuses,
} from "./workflow";

type Statement = {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
};

// The subset of D1Database this store uses; tests put node:sqlite behind it.
export type Db = {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]>;
};

export type PrintRequest = {
  id: string;
  title: string;
  link: string | null;
  details: string;
  material: Material;
  color: string;
  quantity: number;
  status: Status;
  declineReason: string | null;
  requesterId: string;
  requesterName: string;
  createdAt: string;
  updatedAt: string;
};

export type RequestEvent = { status: Status; at: string; actorName: string };
export type Comment = { body: string; at: string; authorName: string; fromOwner: boolean };
export type Actor = { id: string; owner: boolean };

export class RequestError extends Error {}

const DAY = 24 * 60 * 60 * 1000;
const periodMs = { "7d": 7 * DAY, "30d": 30 * DAY, all: Infinity };

const SELECT_REQUEST = `select r.*, u.name as requesterName from print_request r join "user" u on u.id = r.requesterId`;
const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ");
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export function createRequestStore(db: Db) {
  const get = (id: string) =>
    db.prepare(`${SELECT_REQUEST} where r.id = ?`).bind(id).first<PrintRequest>();

  // Status changes are one conditional UPDATE plus an event row that is only
  // written if the UPDATE matched (changes() = 1), in a single D1 batch.
  // Returns false when the guard didn't match, so callers can say why.
  type Clause = { sql: string; values: unknown[] };
  const transition = async (
    id: string,
    to: Status,
    actorId: string,
    where: Clause,
    set: Clause = { sql: "", values: [] },
  ) => {
    const at = new Date().toISOString();
    const [update] = await db.batch([
      db
        .prepare(
          `update print_request set status = ?, updatedAt = ?${set.sql} where id = ? and ${where.sql}`,
        )
        .bind(to, at, ...set.values, id, ...where.values),
      db
        .prepare(
          "insert into request_event (requestId, status, actorId, at) select ?, ?, ?, ? where changes() = 1",
        )
        .bind(id, to, actorId, at),
    ]);
    return update!.meta.changes === 1;
  };

  const mustGet = async (id: string) => {
    const request = await get(id);
    if (!request) throw new RequestError("Request not found");
    return request;
  };

  return {
    get,

    events: async (id: string) =>
      (
        await db
          .prepare(
            'select e.status, e.at, u.name as actorName from request_event e join "user" u on u.id = e.actorId where e.requestId = ? order by e.id',
          )
          .bind(id)
          .all<RequestEvent>()
      ).results,

    // Oldest first within each column: that's the order they'll be printed.
    board: async () => {
      const { results } = await db
        .prepare(
          `${SELECT_REQUEST} where r.status in (${placeholders(activeStatuses)}) order by r.createdAt`,
        )
        .bind(...activeStatuses)
        .all<PrintRequest>();
      return activeStatuses.map((status) => ({
        status,
        requests: results.filter((r) => r.status === status),
      }));
    },

    history: async ({ status, material, q, period }: HistorySearch, now = Date.now()) => {
      const where = [`r.status in (${placeholders(archivedStatuses)})`];
      const values: unknown[] = [...archivedStatuses];
      if (status) {
        where.push("r.status = ?");
        values.push(status);
      }
      if (material) {
        where.push("r.material = ?");
        values.push(material);
      }
      if (q) {
        where.push(`(r.title like ? escape '\\' or u.name like ? escape '\\')`);
        values.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
      }
      if (period !== "all") {
        where.push("r.updatedAt >= ?");
        values.push(new Date(now - periodMs[period]).toISOString());
      }
      const { results } = await db
        .prepare(
          `${SELECT_REQUEST} where ${where.join(" and ")} order by r.updatedAt desc limit 200`,
        )
        .bind(...values)
        .all<PrintRequest>();
      return results;
    },

    create: async (input: NewRequest, requesterId: string) => {
      const id = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
      const at = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            "insert into print_request (id, title, link, details, material, color, quantity, status, requesterId, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            input.title,
            input.link,
            input.details,
            input.material,
            input.color,
            input.quantity,
            "requested",
            requesterId,
            at,
            at,
          ),
        db
          .prepare("insert into request_event (requestId, status, actorId, at) values (?, ?, ?, ?)")
          .bind(id, "requested", requesterId, at),
      ]);
      return id;
    },

    advance: async (id: string, from: Status, actor: Actor) => {
      const to = nextStatus(from);
      if (!to) throw new RequestError(`"${statusLabels[from]}" is the last step`);
      if (await transition(id, to, actor.id, { sql: "status = ?", values: [from] })) return;
      const request = await mustGet(id);
      throw new RequestError(`Already moved to "${statusLabels[request.status]}" — refresh`);
    },

    move: async (id: string, from: Status, to: Status, actor: Actor) => {
      if (await transition(id, to, actor.id, { sql: "status = ?", values: [from] })) return;
      const request = await mustGet(id);
      throw new RequestError(`Already moved to "${statusLabels[request.status]}" — refresh`);
    },

    decline: async (id: string, reason: string, actor: Actor) => {
      const where = {
        sql: `status in (${placeholders(declinableStatuses)})`,
        values: [...declinableStatuses],
      };
      if (
        await transition(id, "declined", actor.id, where, {
          sql: ", declineReason = ?",
          values: [reason],
        })
      )
        return;
      const request = await mustGet(id);
      throw new RequestError(
        `Can't decline a request that is ${statusLabels[request.status].toLowerCase()}`,
      );
    },

    // Ownership is part of the UPDATE's WHERE, so the check and the write can't race.
    withdraw: async (id: string, actor: Actor) => {
      const where = {
        sql: `status in (${placeholders(withdrawableStatuses)}) and (requesterId = ? or ?)`,
        values: [...withdrawableStatuses, actor.id, actor.owner ? 1 : 0],
      };
      if (await transition(id, "withdrawn", actor.id, where)) return;
      const request = await mustGet(id);
      if (!actor.owner && request.requesterId !== actor.id)
        throw new RequestError("Only the person who asked for it can withdraw it");
      throw new RequestError("Too late to withdraw — it is already on the printer");
    },

    comments: async (id: string) => {
      const { results } = await db
        .prepare(
          `select c.body, c.at, u.name as authorName, u.role = 'owner' as fromOwner from comment c join "user" u on u.id = c.authorId where c.requestId = ? order by c.id`,
        )
        .bind(id)
        .all<Omit<Comment, "fromOwner"> & { fromOwner: number }>();
      return results.map((c) => ({ ...c, fromOwner: c.fromOwner === 1 }));
    },

    addComment: async (id: string, authorId: string, body: string) => {
      const { meta } = await db
        .prepare(
          "insert into comment (requestId, authorId, body, at) select ?, ?, ?, ? where exists (select 1 from print_request where id = ?)",
        )
        .bind(id, authorId, body, new Date().toISOString(), id)
        .run();
      if (meta.changes !== 1) throw new RequestError("Request not found");
    },
  };
}
