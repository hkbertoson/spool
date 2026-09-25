import { z } from "zod";

export const activeStatuses = ["requested", "accepted", "printing", "ready"] as const;
export const archivedStatuses = ["done", "declined", "withdrawn"] as const;
export const materials = ["Any", "PLA", "PETG", "TPU", "ABS", "ASA"] as const;
export const periods = ["7d", "30d", "all"] as const;

export const statuses = [...activeStatuses, ...archivedStatuses] as const;

export type Status = (typeof statuses)[number];
export type ActiveStatus = (typeof activeStatuses)[number];
export type Material = (typeof materials)[number];

export const statusLabels: Record<Status, string> = {
  requested: "Requested",
  accepted: "Accepted",
  printing: "Printing",
  ready: "Ready for pickup",
  done: "Picked up",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

// Forward only, one step at a time.
const nextStatuses: Partial<Record<Status, Status>> = {
  requested: "accepted",
  accepted: "printing",
  printing: "ready",
  ready: "done",
};

export const advanceLabels: Partial<Record<Status, string>> = {
  requested: "Accept",
  accepted: "Start printing",
  printing: "Mark ready for pickup",
  ready: "Mark picked up",
};

export const nextStatus = (status: Status) => nextStatuses[status];
export const declinableStatuses = ["requested", "accepted"] as const;
// Once it's on the bed it's too late to withdraw.
export const withdrawableStatuses = ["requested", "accepted", "declined"] as const;

export const canDecline = (status: Status) =>
  (declinableStatuses as readonly Status[]).includes(status);
export const canWithdraw = (status: Status) =>
  (withdrawableStatuses as readonly Status[]).includes(status);

export const newRequestSchema = z
  .object({
    title: z.string().trim().min(1, "Give the print a name").max(80),
    // Only http(s): the link is rendered as an <a href>, so javascript: URLs must never get in.
    link: z
      .union([
        z.literal(""),
        z.url({ protocol: /^https?$/, error: "Link must start with http:// or https://" }).max(500),
      ])
      .transform((value) => value || null),
    details: z.string().trim().max(2000).default(""),
    material: z.enum(materials),
    color: z
      .string()
      .trim()
      .max(30)
      .transform((value) => value || "Any"),
    quantity: z.coerce.number().int().min(1).max(20),
  })
  .refine((request) => request.link || request.details, {
    message: "Add a link to the model or describe your idea",
    path: ["details"],
  });

export type NewRequest = z.infer<typeof newRequestSchema>;

export const requestIdSchema = z.object({ id: z.string().regex(/^[a-z0-9]{8}$/) });

export const advanceSchema = requestIdSchema.extend({
  // The status the owner saw; guards against double-clicks skipping a step.
  from: z.enum(statuses),
});

// Board drag-and-drop: any active column to any other, guarded by the status the owner saw.
export const moveSchema = requestIdSchema
  .extend({ from: z.enum(activeStatuses), to: z.enum(activeStatuses) })
  .refine(({ from, to }) => from !== to, { message: "Already in that column", path: ["to"] });

export const declineSchema = requestIdSchema.extend({
  reason: z.string().trim().min(1, "Say why so they can fix it").max(500),
});

export const commentSchema = requestIdSchema.extend({
  body: z.string().trim().min(1).max(2000),
});

// Only same-site paths, so /login?redirect=//evil.example (or /\evil.example, which
// browsers treat the same) can't bounce users off-site.
export const redirectSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/(?![/\\])/)
    .optional()
    .catch(undefined),
});

// URL input is untrusted: bad values fall back instead of throwing.
export const historySearchSchema = z.object({
  status: z.enum(archivedStatuses).optional().catch(undefined),
  material: z.enum(materials).optional().catch(undefined),
  // coerce: the router's JSON-first parser turns `?q=123` into a number
  q: z.coerce.string().trim().min(1).max(80).optional().catch(undefined),
  period: z.enum(periods).default("all").catch("all"),
});

export type HistorySearch = z.infer<typeof historySearchSchema>;
