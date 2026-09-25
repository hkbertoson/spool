import type { Status } from "../lib/workflow";

import { statusLabels } from "../lib/workflow";

const colors: Record<Status, string> = {
  requested: "bg-[#f3a71233] text-[#a86f00]",
  accepted: "bg-[#669bbc33] text-[#2a6f97]",
  printing: "bg-[#f28c2833] text-[#c25e00]",
  ready: "bg-ok/20 text-ok",
  done: "bg-ok/20 text-ok",
  declined: "bg-[#b3261e22] text-danger",
  withdrawn: "bg-[#8883] text-muted",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-px text-[0.78rem] font-medium whitespace-nowrap ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
