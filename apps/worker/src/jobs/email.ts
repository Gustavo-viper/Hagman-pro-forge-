import type { EmailJobData, EmailTemplate, Locale } from '@fandom/shared';

interface Copy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  expiry: (minutes: number) => string;
  ignore: string;
}

const COPY: Record<EmailTemplate, Record<Locale, Copy>> = {
  email_verification: {
    'pt-BR': {
      subject: 'Confirme seu e-mail — Fandom Universe',
      heading: 'Confirme seu e-mail',
      body: 'Falta pouco! Confirme seu endereço de e-mail para proteger sua conta no Fandom Universe.',
      cta: 'Confirmar e-mail',
      expiry: (m) => `Este link expira em ${Math.round(m / 60)} horas e só pode ser usado uma vez.`,
      ignore: 'Se você não criou uma conta, ignore esta mensagem.',
    },
    en: {
      subject: 'Confirm your email — Fandom Universe',
      heading: 'Confirm your email',
      body: 'Almost there! Confirm your email address to secure your Fandom Universe account.',
      cta: 'Confirm email',
      expiry: (m) => `This link expires in ${Math.round(m / 60)} hours and can be used only once.`,
      ignore: "If you didn't create an account, you can ignore this message.",
    },
  },
  password_reset: {
    'pt-BR': {
      subject: 'Redefinição de senha — Fandom Universe',
      heading: 'Redefinir sua senha',
      body: 'Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.',
      cta: 'Redefinir senha',
      expiry: (m) => `Este link expira em ${m} minutos e só pode ser usado uma vez. Todas as sessões abertas serão encerradas.`,
      ignore: 'Se você não pediu a redefinição, ignore esta mensagem — sua senha continua a mesma.',
    },
    en: {
      subject: 'Password reset — Fandom Universe',
      heading: 'Reset your password',
      body: 'We received a request to reset your account password. Click the button below to choose a new one.',
      cta: 'Reset password',
      expiry: (m) => `This link expires in ${m} minutes and can be used only once. All open sessions will be signed out.`,
      ignore: "If you didn't request this, ignore this message — your password stays the same.",
    },
  },
};

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderEmail(job: EmailJobData): { subject: string; text: string; html: string } {
  const c = COPY[job.template][job.locale] ?? COPY[job.template]['pt-BR'];
  const link = escape(job.link);
  const text = `${c.heading}\n\n${c.body}\n\n${job.link}\n\n${c.expiry(job.expiresInMinutes)}\n${c.ignore}\n\n— Fandom Universe · Forge Studios`;
  const html = `<!doctype html><html lang="${job.locale}"><body style="margin:0;background:#05040a;font-family:Arial,Helvetica,sans-serif;color:#ece9f6">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c0a18;border:1px solid #2a2342;border-radius:16px;padding:36px">
<tr><td style="font-size:13px;letter-spacing:4px;color:#f2cb6b;font-weight:bold">FANDOM UNIVERSE</td></tr>
<tr><td style="padding-top:20px;font-size:24px;font-weight:bold">${escape(c.heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:22px;color:#c9c4de">${escape(c.body)}</td></tr>
<tr><td style="padding-top:28px"><a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:12px">${escape(c.cta)}</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;line-height:18px;color:#8f89a8">${escape(c.expiry(job.expiresInMinutes))}<br>${escape(c.ignore)}</td></tr>
<tr><td style="padding-top:24px;font-size:11px;color:#6b6585;word-break:break-all">${link}</td></tr>
</table><p style="font-size:11px;color:#6b6585">ONE PLATFORM. INFINITE UNIVERSES. · Forge Studios Tecnologias em Softwares LTDA.</p>
</td></tr></table></body></html>`;
  return { subject: c.subject, text, html };
}
