import type { Locale } from '@fandom/shared';

export interface LegalDoc {
  title: string;
  sections: { heading: string; body: string[] }[];
}

/**
 * Initial legal texts. They describe how the platform actually processes data today and
 * must be reviewed by legal counsel before the public launch (see docs/PENDING.md).
 */
export const TERMS: Record<Locale, LegalDoc> = {
  'pt-BR': {
    title: 'Termos de Uso',
    sections: [
      { heading: '1. Quem somos', body: ['O Fandom Universe é uma plataforma de comunidades de fãs desenvolvida e operada pela Forge Studios Tecnologias em Softwares LTDA. É uma comunidade independente e não oficial, sem afiliação com os detentores dos direitos das obras citadas.'] },
      { heading: '2. Conta', body: ['Para criar uma conta é necessário ter pelo menos 13 anos. Usuários entre 13 e 17 anos devem utilizar a plataforma com conhecimento de seus responsáveis e recebem configurações de privacidade reforçadas.', 'Você é responsável por manter sua senha em sigilo e pelas atividades realizadas com sua conta.'] },
      { heading: '3. Conduta', body: ['É proibido publicar conteúdo ilegal, discriminatório, de assédio, violento, sexual envolvendo menores, spam ou que viole direitos de terceiros, incluindo direitos autorais e marcas.', 'Conteúdos e contas que violem estes termos podem ser removidos ou suspensos pela moderação.'] },
      { heading: '4. Conteúdo e propriedade intelectual', body: ['Você mantém os direitos sobre o conteúdo que publica e concede à Forge Studios uma licença não exclusiva para exibi-lo na plataforma. Não publique materiais protegidos de terceiros sem autorização.'] },
      { heading: '5. Gamificação e itens virtuais', body: ['XP, níveis, conquistas e Fandom Coins não possuem valor monetário, não são reembolsáveis em dinheiro e não podem ser transferidos fora da plataforma. Tentativas de manipulação resultam em remoção dos ganhos e possível suspensão.'] },
      { heading: '6. Assinaturas', body: ['Os planos Fandom Plus e Fandom Ultra são opcionais e oferecem benefícios de personalização e acesso a espaços exclusivos, sem vantagens em rankings. Condições de cobrança, renovação, cancelamento e reembolso serão apresentadas antes da contratação, respeitando o Código de Defesa do Consumidor.'] },
      { heading: '7. Encerramento', body: ['Você pode solicitar a exclusão da sua conta a qualquer momento. A Forge Studios pode encerrar contas que violem estes termos.'] },
      { heading: '8. Contato', body: ['Dúvidas sobre estes termos: forgestudios.contato@gmail.com.'] },
    ],
  },
  en: {
    title: 'Terms of Use',
    sections: [
      { heading: '1. Who we are', body: ['Fandom Universe is a fan community platform developed and operated by Forge Studios Tecnologias em Softwares LTDA. It is an independent, unofficial community with no affiliation with the rights holders of the works mentioned.'] },
      { heading: '2. Account', body: ['You must be at least 13 years old to create an account. Users aged 13 to 17 must use the platform with the knowledge of their parents or guardians and receive stronger privacy settings.', 'You are responsible for keeping your password secret and for the activity on your account.'] },
      { heading: '3. Conduct', body: ['Posting illegal, discriminatory, harassing, violent content, sexual content involving minors, spam or content that infringes third-party rights, including copyrights and trademarks, is forbidden.', 'Content and accounts that violate these terms may be removed or suspended by moderation.'] },
      { heading: '4. Content and intellectual property', body: ['You keep the rights to the content you post and grant Forge Studios a non-exclusive license to display it on the platform. Do not post third-party protected material without permission.'] },
      { heading: '5. Gamification and virtual items', body: ['XP, levels, achievements and Fandom Coins have no monetary value, are not refundable in cash and cannot be transferred outside the platform. Manipulation attempts result in removal of the gains and possible suspension.'] },
      { heading: '6. Subscriptions', body: ['Fandom Plus and Fandom Ultra plans are optional and offer customization and access to exclusive spaces, without ranking advantages. Billing, renewal, cancellation and refund conditions will be shown before purchase, in accordance with consumer protection law.'] },
      { heading: '7. Termination', body: ['You can request the deletion of your account at any time. Forge Studios may terminate accounts that violate these terms.'] },
      { heading: '8. Contact', body: ['Questions about these terms: forgestudios.contato@gmail.com.'] },
    ],
  },
};

export const PRIVACY: Record<Locale, LegalDoc> = {
  'pt-BR': {
    title: 'Política de Privacidade',
    sections: [
      { heading: '1. Controlador', body: ['Forge Studios Tecnologias em Softwares LTDA. é a controladora dos dados pessoais tratados no Fandom Universe, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).'] },
      { heading: '2. Dados que coletamos', body: ['Dados de conta: e-mail e senha (armazenada de forma criptografada pelo provedor de autenticação).', 'Dados de perfil: nome de usuário, nome de exibição, país, idioma, fuso horário e data de nascimento (não exibida publicamente).', 'Registros de consentimento: tipo, versão do documento, data, endereço IP e navegador no momento do aceite.', 'Dados de uso: participação em universos, XP e atividades na plataforma.'] },
      { heading: '3. Finalidades e bases legais', body: ['Execução do contrato (art. 7º, V): criar e manter sua conta e oferecer as funcionalidades.', 'Cumprimento de obrigação legal e proteção de menores (art. 14): usar a data de nascimento para aplicar restrições adequadas à idade.', 'Consentimento (art. 7º, I): envio de comunicações de marketing, revogável a qualquer momento. Menores de 18 anos não recebem marketing.', 'Legítimo interesse (art. 7º, IX): segurança, prevenção a fraudes e registros de auditoria.'] },
      { heading: '4. Compartilhamento', body: ['Utilizamos operadores para hospedagem (Railway), banco de dados e autenticação (Supabase) e, quando houver assinaturas, processamento de pagamentos. Não vendemos dados pessoais. Dados completos de cartão nunca são armazenados pela Forge Studios.'] },
      { heading: '5. Seus direitos', body: ['Você pode solicitar confirmação, acesso, correção, portabilidade, anonimização ou exclusão dos seus dados e revogar consentimentos, pelo e-mail forgestudios.contato@gmail.com.'] },
      { heading: '6. Segurança e retenção', body: ['Aplicamos criptografia em trânsito, controle de acesso por funções, políticas de segurança no banco de dados e registros de auditoria. Os dados são mantidos enquanto a conta estiver ativa e pelo prazo exigido em lei.'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      { heading: '1. Controller', body: ['Forge Studios Tecnologias em Softwares LTDA. is the controller of the personal data processed on Fandom Universe, under Brazil\'s General Data Protection Law (LGPD, Law 13,709/2018).'] },
      { heading: '2. Data we collect', body: ['Account data: email and password (stored encrypted by the authentication provider).', 'Profile data: username, display name, country, language, time zone and date of birth (never shown publicly).', 'Consent records: type, document version, date, IP address and browser at the time of acceptance.', 'Usage data: universe memberships, XP and platform activity.'] },
      { heading: '3. Purposes and legal bases', body: ['Performance of contract: creating and maintaining your account and providing features.', 'Legal obligation and protection of minors: using the date of birth to apply age-appropriate restrictions.', 'Consent: sending marketing communications, revocable at any time. Users under 18 never receive marketing.', 'Legitimate interest: security, fraud prevention and audit logs.'] },
      { heading: '4. Sharing', body: ['We use processors for hosting (Railway), database and authentication (Supabase) and, once subscriptions exist, payment processing. We do not sell personal data. Full card data is never stored by Forge Studios.'] },
      { heading: '5. Your rights', body: ['You may request confirmation, access, correction, portability, anonymization or deletion of your data and revoke consents by emailing forgestudios.contato@gmail.com.'] },
      { heading: '6. Security and retention', body: ['We apply encryption in transit, role-based access control, database security policies and audit logs. Data is kept while the account is active and for the period required by law.'] },
    ],
  },
};
