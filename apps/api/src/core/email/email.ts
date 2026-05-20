import { config } from '../config.js';

/**
 * Tiny email provider abstraction. In prod we POST to Resend's REST API
 * directly so we don't add an SDK dependency. In dev (no RESEND_API_KEY)
 * the email is logged to stdout — useful for verifying flow without
 * burning real sends.
 */
export interface OutboundEmail {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class ConsoleEmailDriver {
  async send(email: OutboundEmail): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `\n[email:dev] to=${Array.isArray(email.to) ? email.to.join(',') : email.to}\n  subject: ${email.subject}\n  text: ${email.text ?? email.html.replace(/<[^>]+>/g, '').slice(0, 200)}\n`,
    );
  }
}

class ResendDriver {
  constructor(private readonly apiKey: string) {}

  async send(email: OutboundEmail): Promise<void> {
    const body: Record<string, unknown> = {
      from: config.EMAIL_FROM,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
    };
    if (email.text) body.text = email.text;
    if (config.EMAIL_REPLY_TO) body.reply_to = config.EMAIL_REPLY_TO;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend send failed (${res.status}): ${text}`);
    }
  }
}

export const emailDriver = config.RESEND_API_KEY
  ? new ResendDriver(config.RESEND_API_KEY)
  : new ConsoleEmailDriver();

/* --------------------------- templates --------------------------- */

export function verificationEmail(args: { fullName: string; verifyUrl: string }): OutboundEmail {
  const firstName = args.fullName.split(' ')[0] ?? 'there';
  const subject = 'Verify your Braventex student email';
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Hey ${escape(firstName)} 👋</h2>
      <p>Welcome to <strong>Braventex</strong> — a campus, not a feed.</p>
      <p>Tap the button below to verify your college email. It's how we keep this place students-only.</p>
      <p style="margin:24px 0">
        <a href="${args.verifyUrl}"
           style="background:#6366f1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
          Verify my email
        </a>
      </p>
      <p style="color:#666;font-size:13px">Or paste this into your browser:<br>${escape(args.verifyUrl)}</p>
      <p style="color:#888;font-size:12px;margin-top:32px">If you didn't sign up for Braventex, ignore this email.</p>
    </div>
  `;
  const text = `Hey ${firstName}, welcome to Braventex.\nVerify your email: ${args.verifyUrl}\nIf you didn't sign up, ignore this email.`;
  return { to: '', subject, html, text };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
