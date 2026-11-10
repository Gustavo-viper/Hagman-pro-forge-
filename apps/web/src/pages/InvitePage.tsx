import { Button } from '@fandom/ui';
import { motion } from 'framer-motion';
import { Gift, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { saveReferralCode } from '@/lib/referral';

/** Landing of a friend's invite link: remembers the code and leads to sign-up. */
export default function InvitePage() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const { session } = useAuth();
  const [valid] = useState(() => /^[A-Z0-9]{6,12}$/i.test(code));
  useEffect(() => {
    if (valid && !session) saveReferralCode(code);
  }, [code, valid, session]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass glass-sheen rounded-3xl p-8 text-center sm:p-10">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-gold-400/20 text-gold-200 ring-1 ring-gold-300/30">
          <Gift className="size-8" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-wide">{t('referrals.invite.title')}</h1>
        <p className="mt-3 text-mist/70">{session ? t('referrals.invite.signedIn') : t('referrals.invite.body')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {session ? (
            <Button asChild><Link to="/universes"><Sparkles /> {t('nav.universes')}</Link></Button>
          ) : (
            <>
              <Button asChild size="lg" variant="gold"><Link to="/register">{t('referrals.invite.cta')}</Link></Button>
              <Button asChild variant="glass"><Link to="/login">{t('nav.signIn')}</Link></Button>
            </>
          )}
        </div>
        <p className="mt-6 text-xs text-mist/50">{t('referrals.invite.note')}</p>
      </motion.div>
    </div>
  );
}
