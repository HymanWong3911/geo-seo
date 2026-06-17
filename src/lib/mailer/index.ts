// 邮件发送。
// 详细说明见 dev doc v1.2 26.7 节。
// 开发环境用 mailhog（docker-compose 已配），生产用 SMTP。

import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.ALERT_SMTP_HOST;
  const port = parseInt(process.env.ALERT_SMTP_PORT ?? "1025");
  const user = process.env.ALERT_SMTP_USER;
  const pass = process.env.ALERT_SMTP_PASS;

  if (!host) {
    // 开发环境无 SMTP：返回 null，调用方需用 console.log 兜底
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

export interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(input: MailInput): Promise<boolean> {
  const t = getTransporter();
  const from = process.env.ALERT_SMTP_FROM ?? "noreply@example.com";

  if (!t) {
    // eslint-disable-next-line no-console
    console.log("[mailer:dev]", { from, ...input });
    return true;
  }

  await t.sendMail({
    from,
    to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return true;
}
