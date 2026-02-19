import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-navy/10 bg-navy/5 dark:border-cream/10 dark:bg-cream/10">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3">
              <div
                role="img"
                aria-label="Kenaz"
                className="w-10 h-10 bg-navy dark:bg-cream rounded-full transition-colors duration-300
                  [mask-image:url('/static/render.png')] [mask-repeat:no-repeat]
                  [mask-position:center] [mask-size:cover]
                  [-webkit-mask-image:url('/static/render.png')] [-webkit-mask-repeat:no-repeat]
                  [-webkit-mask-position:center] [-webkit-mask-size:cover]"
              />
              <span className="font-black text-lg text-navy dark:text-cream">{t('common.appName')}</span>
            </div>
            <p className="mt-3 text-sm text-navy/70 dark:text-cream/70">
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-navy/50 dark:text-cream/50">
              {t('footer.contactTitle')}
            </h3>
            <p className="mt-3 text-sm text-navy dark:text-cream">
              {t('footer.address')}
            </p>
            <p className="mt-2 text-sm text-navy dark:text-cream">
              {t('footer.email')}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-navy/50 dark:text-cream/50">
              {t('footer.orgTitle')}
            </h3>
            <p className="mt-3 text-sm text-navy dark:text-cream">{t('footer.legalName')}</p>
            <p className="mt-2 text-sm text-navy/70 dark:text-cream/70">{t('footer.krs')}</p>
            <p className="mt-2 text-sm text-navy/70 dark:text-cream/70">{t('footer.nip')}</p>
            <p className="mt-2 text-sm text-navy/70 dark:text-cream/70">{t('footer.regon')}</p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-navy/50 dark:text-cream/50">
              {t('footer.linksTitle')}
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="text-navy dark:text-cream hover:underline" to="/">{t('footer.links.home')}</Link>
              <Link className="text-navy dark:text-cream hover:underline" to="/calendar">{t('footer.links.calendar')}</Link>
              <Link className="text-navy dark:text-cream hover:underline" to="/about">{t('footer.links.about')}</Link>
              <Link className="text-navy dark:text-cream hover:underline" to="/shop">{t('footer.links.shop')}</Link>
              <Link className="text-navy dark:text-cream hover:underline" to="/privacy">{t('footer.links.privacy')}</Link>
              <Link className="text-navy dark:text-cream hover:underline" to="/terms">{t('footer.links.terms')}</Link>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <FooterSocialLink href="https://www.facebook.com/profile.php?id=61558056234732" label={t('about.social.facebook')} icon="facebook" />
              <FooterSocialLink href="https://www.instagram.com/centrum.kenaz/" label={t('about.social.instagram')} icon="instagram" />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-navy/10 dark:border-cream/10 text-xs text-navy/50 dark:text-cream/50">
          {t('footer.copyright').replace('{year}', String(year))}
        </div>
      </div>
    </footer>
  )
}

function FooterSocialLink({ href, label, icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-navy/10 dark:bg-cream/10
        text-navy dark:text-cream hover:bg-navy/20 dark:hover:bg-cream/20"
    >
      {icon === 'facebook' ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 12a10 10 0 10-11.5 9.95v-7.04H7.9V12h2.6V9.8c0-2.57 1.53-3.99 3.88-3.99 1.12 0 2.3.2 2.3.2v2.53h-1.3c-1.29 0-1.69.8-1.69 1.62V12h2.87l-.46 2.91h-2.41v7.04A10 10 0 0022 12z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm10 2H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2zm-5 3.5A4.5 4.5 0 1112 17a4.5 4.5 0 010-9zm0 2A2.5 2.5 0 1014.5 13 2.5 2.5 0 0012 10.5zM17.75 7.5a1 1 0 11-1-1 1 1 0 011 1z" />
        </svg>
      )}
    </a>
  )
}

export default Footer
