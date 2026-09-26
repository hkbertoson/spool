import { env, waitUntil } from "cloudflare:workers";

export type Email = { to: string; subject: string; text: string };

const send = async (email: Email) => {
  try {
    await env.EMAIL.send({ ...email, from: { name: "Spool", email: env.EMAIL_FROM } });
  } catch (error) {
    console.error(`Email to ${email.to} failed:`, error);
  }
};

// Runs after the response: whatever the email is about has already been saved,
// so a slow or failed send must neither delay the reply nor turn it into an error.
export const sendLater = (emails: Email[] | Promise<Email[]>) =>
  waitUntil(Promise.resolve(emails).then((list) => Promise.all(list.map(send))));
