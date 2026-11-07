import type { EmailJobData, EmailTemplate, Locale } from '@fandom/shared';

interface Copy {
  subject: string;
  heading: string;
  body: string | ((d: NonNullable<EmailJobData['details']>) => string);
  cta: string;
  expiry: (minutes: number) => string;
  ignore: string;
}

const none = () => '';

const COPY: Record<EmailTemplate, Record<Locale, Copy>> = {
  event_reminder: {
    'pt-BR': {
      subject: 'Seu evento está chegando — Fandom Universe',
      heading: 'Está quase na hora!',
      body: (d) => `${d.title} começa ${d.startsIn === '1h' ? 'em 1 hora' : 'amanhã'} (${d.when}). A sala abre 30 minutos antes para os inscritos.`,
      cta: 'Abrir a sala do evento',
      expiry: none,
      ignore: 'Você recebeu este aviso porque se inscreveu no evento. Cancele a inscrição na página do universo se não puder participar.',
    },
    en: {
      subject: 'Your event is coming up — Fandom Universe',
      heading: "It's almost time!",
      body: (d) => `${d.title} starts ${d.startsIn === '1h' ? 'in 1 hour' : 'tomorrow'} (${d.when}). The room opens 30 minutes earlier for registered fans.`,
      cta: 'Open the event room',
      expiry: none,
      ignore: "You received this because you signed up for the event. Cancel your registration on the universe page if you can't make it.",
    },
  },
  event_cancelled: {
    'pt-BR': {
      subject: 'Evento cancelado — Fandom Universe',
      heading: 'Evento cancelado',
      body: (d) => `Infelizmente o evento ${d.title} (${d.when}) foi cancelado. Confira outros eventos no universo.`,
      cta: 'Ver outros eventos',
      expiry: none,
      ignore: 'Você recebeu este aviso porque estava inscrito no evento.',
    },
    en: {
      subject: 'Event cancelled — Fandom Universe',
      heading: 'Event cancelled',
      body: (d) => `Unfortunately ${d.title} (${d.when}) was cancelled. Check out other events in the universe.`,
      cta: 'See other events',
      expiry: none,
      ignore: 'You received this because you were registered for the event.',
    },
  },
  subscription_activated: {
    'pt-BR': {
      subject: 'Pagamento confirmado — Fandom Universe',
      heading: 'Sua assinatura está ativa!',
      body: (d) => `Recebemos seu pagamento${d.amount ? ` de ${d.amount}` : ''}. O plano ${d.plan} está liberado até ${d.until}. Aproveite seus benefícios exclusivos!`,
      cta: 'Ver minha assinatura',
      expiry: none,
      ignore: 'Não há renovação automática: avisaremos antes do vencimento.',
    },
    en: {
      subject: 'Payment confirmed — Fandom Universe',
      heading: 'Your subscription is active!',
      body: (d) => `We received your payment${d.amount ? ` of ${d.amount}` : ''}. ${d.plan} is unlocked until ${d.until}. Enjoy your exclusive benefits!`,
      cta: 'View my subscription',
      expiry: none,
      ignore: "There is no automatic renewal: we'll remind you before it ends.",
    },
  },
  subscription_renewal_reminder: {
    'pt-BR': {
      subject: 'Sua assinatura vence em breve — Fandom Universe',
      heading: 'Hora de renovar',
      body: (d) => `Seu plano ${d.plan} vence em ${d.until}. Renove agora para não perder emblemas, molduras e acesso às áreas exclusivas.`,
      cta: 'Renovar assinatura',
      expiry: none,
      ignore: 'Se não quiser renovar, não precisa fazer nada: sua conta volta ao plano Free ao fim do período.',
    },
    en: {
      subject: 'Your subscription ends soon — Fandom Universe',
      heading: 'Time to renew',
      body: (d) => `Your ${d.plan} plan ends on ${d.until}. Renew now to keep your badges, frames and access to exclusive areas.`,
      cta: 'Renew subscription',
      expiry: none,
      ignore: "If you don't want to renew, do nothing: your account returns to Free when the period ends.",
    },
  },
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
  const body = typeof c.body === 'function' ? c.body(job.details ?? {}) : c.body;
  const expiry = job.expiresInMinutes ? c.expiry(job.expiresInMinutes) : '';
  const text = `${c.heading}\n\n${body}\n\n${job.link}\n\n${expiry ? `${expiry}\n` : ''}${c.ignore}\n\n— Fandom Universe · Forge Studios`;
  const html = `<!doctype html><html lang="${job.locale}"><body style="margin:0;background:#05040a;font-family:Arial,Helvetica,sans-serif;color:#ece9f6">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c0a18;border:1px solid #2a2342;border-radius:16px;padding:36px">
<tr><td style="font-size:13px;letter-spacing:4px;color:#f2cb6b;font-weight:bold">FANDOM UNIVERSE</td></tr>
<tr><td style="padding-top:20px;font-size:24px;font-weight:bold">${escape(c.heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:22px;color:#c9c4de">${escape(body)}</td></tr>
<tr><td style="padding-top:28px"><a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:12px">${escape(c.cta)}</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;line-height:18px;color:#8f89a8">${expiry ? `${escape(expiry)}<br>` : ''}${escape(c.ignore)}</td></tr>
<tr><td style="padding-top:24px;font-size:11px;color:#6b6585;word-break:break-all">${link}</td></tr>
</table><p style="font-size:11px;color:#6b6585">ONE PLATFORM. INFINITE UNIVERSES. · Forge Studios Tecnologias em Softwares LTDA.</p>
</td></tr></table></body></html>`;
  return { subject: c.subject, text, html };
}
