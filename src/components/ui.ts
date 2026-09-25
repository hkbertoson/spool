const buttonBase =
  "inline-block cursor-pointer rounded-lg border px-3.5 py-1.5 no-underline disabled:cursor-progress disabled:opacity-60";

export const button = {
  primary: `${buttonBase} border-accent bg-accent text-accent-fg`,
  secondary: `${buttonBase} border-line text-fg`,
  danger: `${buttonBase} border-current text-danger`,
  link: "cursor-pointer text-accent underline disabled:cursor-progress disabled:opacity-60",
};

export const panel = "rounded-[10px] border border-line bg-surface px-5 py-4";
export const form = `${panel} grid gap-3.5 [&_button]:justify-self-start [&_label]:grid [&_label]:gap-1 [&_label]:text-[0.9rem] [&_label]:text-muted`;
export const fieldError = "m-0 whitespace-pre-wrap font-sans text-danger";
