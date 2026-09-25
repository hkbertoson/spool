import type { Status } from "../lib/workflow";

import { statusLabels } from "../lib/workflow";
import { statusFill } from "./ui";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-ink ${statusFill[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
