// Fixed UTC formatting keeps server-rendered and hydrated text identical.
export const formatTime = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

export const linkHost = (link: string) => new URL(link).hostname.replace(/^www\./, "");

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
