#!/usr/bin/env node
/**
 * Email Send Skill — Send emails via SMTP/SES.
 * 
 * Required env vars (injected by skill_loader.py from SSM):
 *   SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM
 * 
 * Usage by agent:
 *   email-send --to "user@example.com" --subject "Meeting Notes" --body "..."
 *   email-send --to "team@acme.com" --cc "boss@acme.com" --subject "Q2 Report" --html "<h1>..."
 */

const nodemailer = require('nodemailer') || (() => {
  // Fallback: use raw SMTP if nodemailer not available
  console.error('nodemailer not installed — using mock mode');
  return null;
})();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'agent@acme.com';

if (!SMTP_HOST) {
  console.error('Error: SMTP_HOST environment variable required.');
  console.error('Ask your IT admin to configure email credentials in the Skill Platform.');
  process.exit(1);
}

async function sendEmail({ to, cc, bcc, subject, body, html }) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const result = await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    text: body,
    html: html || undefined,
  });

  return {
    success: true,
    messageId: result.messageId,
    to,
    subject,
    note: 'Email sent successfully via enterprise SMTP',
  };
}

async function main() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    params[args[i].replace('--', '')] = args[i + 1];
  }

  if (!params.to || !params.subject) {
    console.log(JSON.stringify({ error: 'Required: --to and --subject' }));
    process.exit(1);
  }

  const result = await sendEmail(params);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
