import { beforeEach, describe, expect, it } from "vitest";

import type { NewRequest } from "./workflow";

import { createNotifier } from "./notifications.server";
import { RequestError, createRequestStore } from "./requests.server";
import { createTestDb } from "./test-db";
import { historySearchSchema, moveSchema, newRequestSchema, redirectSchema } from "./workflow";

let store: ReturnType<typeof createRequestStore>;

let notifier: ReturnType<typeof createNotifier>;

const sam = { id: "u-sam", owner: false };

const riley = { id: "u-riley", owner: false };

const owner = { id: "u-owner", owner: true };

beforeEach(() => {
  const { db, addUser } = createTestDb();
  addUser(sam.id, "Sam");
  addUser(riley.id, "Riley");
  addUser(owner.id, "Pat", "owner");
  store = createRequestStore(db);
  notifier = createNotifier(db, "https://spool.test");
});

const input: NewRequest = {
  title: "Cable clip",
  link: "https://www.printables.com/model/12345-cable-clip",
  details: "",
  material: "PETG",
  color: "black",
  quantity: 4,
};

const statusOf = async (id: string) => (await store.get(id))?.status;

describe("create", () => {
  it("stores the request with the requester name and a first event", async () => {
    const id = await store.create(input, sam.id);
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(await store.get(id)).toMatchObject({
      ...input,
      status: "requested",
      requesterId: sam.id,
      requesterName: "Sam",
      declineReason: null,
    });
    expect(await store.events(id)).toEqual([
      expect.objectContaining({ status: "requested", actorName: "Sam" }),
    ]);
  });

  it("rejects requests from unknown users (foreign key)", async () => {
    await expect(store.create(input, "u-ghost")).rejects.toThrow();
  });
});

describe("workflow", () => {
  it("moves forward one step at a time and records who did it", async () => {
    const id = await store.create(input, sam.id);

    for (const from of ["requested", "accepted", "printing", "ready"] as const)
      await store.advance(id, from, owner);
    expect(await statusOf(id)).toBe("done");
    expect((await store.events(id)).map((e) => `${e.status}:${e.actorName}`)).toEqual([
      "requested:Sam",
      "accepted:Pat",
      "printing:Pat",
      "ready:Pat",
      "done:Pat",
    ]);
    await expect(store.advance(id, "done", owner)).rejects.toThrow("last step");
  });

  it("rejects a stale advance (double click) without writing an event", async () => {
    const id = await store.create(input, sam.id);
    await store.advance(id, "requested", owner);
    await expect(store.advance(id, "requested", owner)).rejects.toThrow(
      'Already moved to "Accepted"',
    );
    expect(await statusOf(id)).toBe("accepted");
    expect(await store.events(id)).toHaveLength(2);
  });

  it("moves between any active columns from the board, backwards or skipping steps", async () => {
    const id = await store.create(input, sam.id);
    await store.move(id, "requested", "printing", owner);
    await store.move(id, "printing", "accepted", owner);
    expect(await statusOf(id)).toBe("accepted");
    expect((await store.events(id)).map((e) => e.status)).toEqual([
      "requested",
      "printing",
      "accepted",
    ]);
  });

  it("rejects a move from a stale board without writing an event", async () => {
    const id = await store.create(input, sam.id);
    await store.advance(id, "requested", owner);
    await expect(store.move(id, "requested", "ready", owner)).rejects.toThrow(
      'Already moved to "Accepted"',
    );
    expect(await statusOf(id)).toBe("accepted");
    expect(await store.events(id)).toHaveLength(2);
  });

  it("reports unknown ids as not found", async () => {
    await expect(store.advance("zzzzzzzz", "requested", owner)).rejects.toThrow(
      "Request not found",
    );
  });

  it("declines with a reason only before printing", async () => {
    const a = await store.create(input, sam.id);
    await store.decline(a, "Too big for the bed", owner);
    expect(await store.get(a)).toMatchObject({
      status: "declined",
      declineReason: "Too big for the bed",
    });

    const b = await store.create(input, sam.id);
    await store.advance(b, "requested", owner);
    await store.advance(b, "accepted", owner);
    await expect(store.decline(b, "nah", owner)).rejects.toThrow(
      "Can't decline a request that is printing",
    );
  });

  it("lets only the requester (or owner) withdraw, and only before printing", async () => {
    const id = await store.create(input, sam.id);
    await expect(store.withdraw(id, riley)).rejects.toThrow("Only the person who asked");
    expect(await statusOf(id)).toBe("requested");
    await store.withdraw(id, sam);
    expect(await statusOf(id)).toBe("withdrawn");

    const declined = await store.create(input, sam.id);
    await store.decline(declined, "Out of PETG", owner);
    await store.withdraw(declined, owner);
    expect(await statusOf(declined)).toBe("withdrawn");

    const printing = await store.create(input, sam.id);
    await store.advance(printing, "requested", owner);
    await store.advance(printing, "accepted", owner);
    await expect(store.withdraw(printing, sam)).rejects.toThrow(RequestError);
    expect(await statusOf(printing)).toBe("printing");
  });
});

describe("board and history", () => {
  it("groups active requests into columns in submission order", async () => {
    const first = await store.create({ ...input, title: "first" }, sam.id);
    const second = await store.create({ ...input, title: "second" }, riley.id);
    const printing = await store.create({ ...input, title: "printing" }, sam.id);
    await store.advance(printing, "requested", owner);
    await store.advance(printing, "accepted", owner);

    const board = await store.board();
    expect(board.map((c) => c.status)).toEqual(["requested", "accepted", "printing", "ready"]);
    expect(board[0]!.requests.map((r) => r.id)).toEqual([first, second]);
    expect(board[2]!.requests.map((r) => r.id)).toEqual([printing]);
  });

  it("filters closed requests by outcome, material, text, and period", async () => {
    const pla = await store.create({ ...input, material: "PLA", title: "Phone stand" }, sam.id);
    await store.withdraw(pla, sam);
    const petg = await store.create(input, riley.id);
    await store.decline(petg, "Out of PETG", owner);
    await store.create(input, sam.id); // still active: never in history

    const search = (raw = {}) => store.history(historySearchSchema.parse(raw));
    expect(await search()).toHaveLength(2);
    expect((await search({ status: "declined" })).map((r) => r.id)).toEqual([petg]);
    expect((await search({ material: "PLA" })).map((r) => r.id)).toEqual([pla]);
    expect((await search({ q: "riley" })).map((r) => r.id)).toEqual([petg]);
    expect((await search({ q: "STAND" })).map((r) => r.id)).toEqual([pla]);
    const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(
      await store.history(historySearchSchema.parse({ period: "7d" }), eightDaysLater),
    ).toHaveLength(0);
  });

  it("treats LIKE wildcards in the search box as plain text", async () => {
    const id = await store.create({ ...input, title: "100% infill test" }, sam.id);
    await store.withdraw(id, sam);
    const other = await store.create({ ...input, title: "100 clips" }, sam.id);
    await store.withdraw(other, sam);
    expect(
      (await store.history(historySearchSchema.parse({ q: "100%" }))).map((r) => r.id),
    ).toEqual([id]);
  });
});

describe("members", () => {
  it("flags owners, marks invites pending until a password is set, and hides removed members", async () => {
    const { db, addUser } = createTestDb();
    addUser("u-pat", "Pat", "owner");
    addUser("u-sam", "Sam");
    addUser("u-nia", "Nia");
    addUser("u-gus", "Gus");

    for (const userId of ["u-pat", "u-sam"])
      await db
        .prepare(
          "insert into account (id, accountId, providerId, userId, password, createdAt, updatedAt) values (?, ?, 'credential', ?, 'hash', '', '')",
        )
        .bind(`a-${userId}`, userId, userId)
        .run();
    await db.prepare('update "user" set banned = 1 where id = ?').bind("u-gus").run();

    const member = (id: string, name: string, owner: boolean, joined: boolean) => ({
      id,
      name,
      email: `${id}@example.test`,
      owner,
      joined,
    });

    expect(await createRequestStore(db).members()).toEqual([
      member("u-nia", "Nia", false, false),
      member("u-pat", "Pat", true, true),
      member("u-sam", "Sam", false, true),
    ]);
  });
});

describe("comments", () => {
  it("appends to the thread, flags the owner, and rejects unknown requests", async () => {
    const id = await store.create(input, sam.id);
    await store.addComment(id, sam.id, "Any chance by Friday?");
    await store.addComment(id, owner.id, "Yes");
    expect(await store.comments(id)).toEqual([
      expect.objectContaining({
        authorName: "Sam",
        fromOwner: false,
        body: "Any chance by Friday?",
      }),
      expect.objectContaining({ authorName: "Pat", fromOwner: true, body: "Yes" }),
    ]);
    await expect(store.addComment("zzzzzzzz", sam.id, "hi")).rejects.toThrow("not found");
  });
});

describe("notifications", () => {
  const recipients = (emails: { to: string }[]) => emails.map((email) => email.to).sort();

  it("tells the owners about new requests, except their own", async () => {
    const id = await store.create(input, sam.id);
    expect(await notifier.requested(id)).toEqual([
      {
        to: "u-owner@example.test",
        subject: "New request: Cable clip",
        text: `Sam requested "Cable clip" (PETG, black, ×4).\n\nhttps://www.printables.com/model/12345-cable-clip\n\nOpen in Spool: https://spool.test/requests/${id}`,
      },
    ]);
    expect(await notifier.requested(await store.create(input, owner.id))).toEqual([]);
  });

  it("tells the requester when someone else moves their print along", async () => {
    const id = await store.create(input, sam.id);
    const sent = [];

    for (const from of ["requested", "accepted", "printing", "ready"] as const) {
      await store.advance(id, from, owner);
      sent.push(...(await notifier.statusChanged(id, owner.id)));
    }

    // Being picked up isn't news to the person who picked it up.
    expect(sent.map((email) => `${email.to} ${email.subject}`)).toEqual([
      "u-sam@example.test Accepted: Cable clip",
      "u-sam@example.test Printing: Cable clip",
      "u-sam@example.test Ready for pickup: Cable clip",
    ]);

    const declined = await store.create(input, sam.id);
    await store.decline(declined, "Out of PETG", owner);
    expect((await notifier.statusChanged(declined, owner.id))[0]?.text).toContain(
      "Reason: Out of PETG",
    );

    const own = await store.create(input, owner.id);
    await store.advance(own, "requested", owner);
    expect(await notifier.statusChanged(own, owner.id)).toEqual([]);
  });

  it("sends comments to the requester and owners, except the author", async () => {
    const id = await store.create(input, sam.id);
    expect(recipients(await notifier.commented(id, sam.id, "By Friday?"))).toEqual([
      "u-owner@example.test",
    ]);
    expect(recipients(await notifier.commented(id, owner.id, "Yes"))).toEqual([
      "u-sam@example.test",
    ]);
    expect(recipients(await notifier.commented(id, riley.id, "Me too"))).toEqual([
      "u-owner@example.test",
      "u-sam@example.test",
    ]);
  });
});

describe("schemas", () => {
  const form = {
    title: " Clip ",
    link: "",
    details: "",
    material: "PLA",
    color: "",
    quantity: "3",
  };

  it("needs a link or an idea", () => {
    expect(newRequestSchema.safeParse(form).error?.issues[0]?.message).toBe(
      "Add a link to the model or describe your idea",
    );
    expect(newRequestSchema.parse({ ...form, details: "A hook for my headphones" })).toMatchObject({
      title: "Clip",
      link: null,
      color: "Any",
      quantity: 3,
    });
    expect(
      newRequestSchema.parse({ ...form, link: "https://makerworld.com/en/models/1" }).link,
    ).toBe("https://makerworld.com/en/models/1");
  });

  it("only accepts http(s) links", () => {
    for (const link of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://x.test/model.stl",
      "not a url",
    ]) {
      expect(newRequestSchema.safeParse({ ...form, link }).success, link).toBe(false);
    }
  });

  it("normalizes hand-edited history URLs instead of throwing", () => {
    expect(
      historySearchSchema.parse({
        status: "exploded",
        material: "wood",
        period: "forever",
        q: "  ",
      }),
    ).toEqual({
      status: undefined,
      material: undefined,
      q: undefined,
      period: "all",
    });
    expect(historySearchSchema.parse({ q: 42 }).q).toBe("42");
  });

  it("only moves between different active columns", () => {
    const id = "abcd1234";
    expect(moveSchema.safeParse({ id, from: "ready", to: "requested" }).success).toBe(true);
    expect(moveSchema.safeParse({ id, from: "ready", to: "ready" }).success).toBe(false);
    expect(moveSchema.safeParse({ id, from: "ready", to: "done" }).success).toBe(false);
  });

  it("only allows same-site login redirects", () => {
    expect(redirectSchema.parse({ redirect: "/history?q=clip" }).redirect).toBe("/history?q=clip");

    for (const redirect of ["//evil.example", "/\\evil.example", "https://evil.example", "evil"]) {
      expect(redirectSchema.parse({ redirect }).redirect, redirect).toBeUndefined();
    }
  });
});
