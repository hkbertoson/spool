import { env, waitUntil } from "cloudflare:workers";

export type Email = { to: string; subject: string; text: string };

// Either provider may be left out of a deployment, so neither is assumed to be in the generated Env.
const mailEnv: { EMAIL_FROM: string; EMAIL?: SendEmail; RESEND_API_KEY?: string } = env;

const senderName = "Spool";

const cloudflare = (binding: SendEmail) => async (email: Email) => {
  await binding.send({ ...email, from: { name: senderName, email: mailEnv.EMAIL_FROM } });
};

const resend = (apiKey: string) => async (email: Email) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...email, from: `${senderName} <${mailEnv.EMAIL_FROM}>` }),
  });

  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
};

const unconfigured = async () => {
  throw new Error("No email provider: set RESEND_API_KEY or add the send_email binding");
};

// Resend when its key is set, otherwise Cloudflare Email Sending. Another provider
// is one more function like these that sends an Email through its API.
const deliver = mailEnv.RESEND_API_KEY
  ? resend(mailEnv.RESEND_API_KEY)
  : mailEnv.EMAIL
    ? cloudflare(mailEnv.EMAIL)
    : unconfigured;

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
