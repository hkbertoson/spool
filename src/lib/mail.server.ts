import { env, waitUntil } from "cloudflare:workers";

export type Email = { to: string; subject: string; text: string };

const senderName = "Spool";

const cloudflare = async (email: Email) => {
  await env.EMAIL.send({ ...email, from: { name: senderName, email: env.EMAIL_FROM } });
};

const resend = async (email: Email) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...email, from: `${senderName} <${env.EMAIL_FROM}>` }),
  });

  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
};

// Resend when its key is set, otherwise Cloudflare Email Sending. Another provider
// is one more function like these that sends an Email through its API.
const deliver = env.RESEND_API_KEY ? resend : cloudflare;

const send = async (email: Email) => {
  try {
    await deliver(email);
  } catch (error) {
    console.error(`Email to ${email.to} failed:`, error);
  }
};

// Runs after the response: whatever the email is about has already been saved,
// so a slow or failed send must neither delay the reply nor turn it into an error.
export const sendLater = (emails: Email[] | Promise<Email[]>) =>
  waitUntil(Promise.resolve(emails).then((list) => Promise.all(list.map(send))));
