import type Mail from "nodemailer/lib/mailer";

export function getMailConfig() {
  return {
    host: process.env.MAIL_HOST || "mail.niatechlimited.com",
    port: Number(process.env.MAIL_PORT || 587),
    secure: false, // port 587 STARTTLS
    user: process.env.MAIL_USERNAME || "projects@niatechlimited.com",
    pass: process.env.MAIL_PASSWORD || "",
    fromAddress: process.env.MAIL_FROM_ADDRESS || "projects@niatechlimited.com",
    fromName: process.env.MAIL_FROM_NAME || "Odds Analyer",
    timeout: Number(process.env.MAIL_TIMEOUT || 15) * 1000,
    defaultTo: process.env.ALERT_EMAIL || "nathanielmwaipopo@gmail.com",
  };
}

function loadNodemailer() {
  // CJS require keeps nodemailer out of the client/webpack ESM graph
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("nodemailer") as typeof import("nodemailer");
}

export function createTransport(): Mail {
  const cfg = getMailConfig();
  const nodemailer = loadNodemailer();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    connectionTimeout: cfg.timeout,
    greetingTimeout: cfg.timeout,
    socketTimeout: cfg.timeout,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const cfg = getMailConfig();
  if (!cfg.pass) {
    throw new Error("MAIL_PASSWORD is not configured");
  }
  const transport = createTransport();
  const info = await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromAddress}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return info;
}
