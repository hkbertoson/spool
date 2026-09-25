import type { Status } from "../lib/workflow";

// Pressing sinks the block into its own extrusion; the far edge stays put.
const pressable =
  "inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-ink px-4 py-2 font-bold no-underline shadow-extrude transition duration-100 not-disabled:hover:translate-0.5 not-disabled:hover:shadow-extrude-sm not-disabled:active:translate-1 not-disabled:active:shadow-none disabled:cursor-progress disabled:opacity-60 motion-reduce:transition-none";

export const button = {
  primary: `${pressable} bg-accent text-ink`,
  secondary: `${pressable} bg-surface text-fg`,
  danger: `${pressable} bg-declined text-ink`,
  link: "cursor-pointer font-bold underline decoration-accent decoration-2 underline-offset-3 hover:decoration-4 disabled:cursor-progress disabled:opacity-60",
};

export const statusFill: Record<Status, string> = {
  requested: "bg-requested",
  accepted: "bg-accepted",
  printing: "bg-printing",
  ready: "bg-ready",
  done: "bg-done",
  declined: "bg-declined",
  withdrawn: "bg-withdrawn",
};

const tagBase = "inline-block rounded-sm px-1.5 py-0.5 text-xs font-bold whitespace-nowrap";

export const tag = {
  plain: `${tagBase} bg-bg text-fg`,
  inverse: `${tagBase} bg-fg text-bg`,
  owner: `${tagBase} bg-accent text-ink`,
};

export const panel = "rounded-lg border-2 border-ink bg-surface p-5 shadow-extrude";

export const form = `${panel} grid gap-4 [&_button]:justify-self-start [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-bold`;

export const fieldError =
  "m-0 rounded-md border-2 border-ink bg-declined px-3 py-2 font-sans text-sm font-semibold whitespace-pre-wrap text-ink";
