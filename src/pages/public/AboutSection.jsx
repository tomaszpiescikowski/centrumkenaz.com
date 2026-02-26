import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

function AboutSection() {
  const { t } = useLanguage()
  const { login } = useAuth()
  const storyImages = [
    '/static/DSC03468-2.jpg',
    '/static/DSC03257-2.jpg',
    '/static/DSC03721-2.jpg',
    '/static/DSC03635-2.jpg',
    '/static/about1.jpg',
    '/static/about7.jpg',
  ]
  const storyImageAlts = [
    'Uczestnicy Kenaz podczas wspólnego wydarzenia na świeżym powietrzu',
    'Trening i ruch – aktywność fizyczna w Kenaz',
    'Społeczność Kenaz – ludzie i relacje',
    'Wspólna energia i motywacja w Kenaz',
    'Ekipa Kenaz podczas wspólnego wyjazdu – zdjęcie grupowe',
    'Duża grupa członków Kenaz w czarnych koszulkach',
  ]
  const storyImagePositions = [
    'object-[center_30%]',
    'object-center',
    'object-top',
    'object-center',
    'object-center',
    'object-center',
  ]
  const stories = Array.isArray(t('about.stories')) ? t('about.stories') : []
  const statsItems = Array.isArray(t('about.stats.items')) ? t('about.stats.items') : []

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-navy/40 dark:text-cream/40">
              {t('about.label')}
            </p>
            <h1 className="text-3xl md:text-5xl font-black text-navy dark:text-cream">
              {t('about.title')}
            </h1>
            <p className="mt-3 max-w-xl text-sm md:text-base text-navy/70 dark:text-cream/70">
              {t('about.subtitle')}
            </p>
          </div>
        </section>

        <div className="mb-12" />

        <div className="space-y-12">
          {stories.map((story, index) => {
            const isEven = index % 2 === 0
            const image = storyImages[index]
            const shouldReverse = index === 5 ? false : !isEven
            const blocks = []

            blocks.push(
              <WideStoryCard
                key={`story-${index}`}
                title={story.title}
                body={story.body}
                image={image}
                alt={storyImageAlts[index]}
                imagePosition={storyImagePositions[index]}
                reverse={shouldReverse}
              />
            )

            if (index === 0) {
              blocks.push(
                <WideCtaCard
                  key="cta-1"
                  message={t('about.ctaMessage')}
                  primaryLabel={t('about.joinNow')}
                  onPrimary={() => login({ returnTo: '/about' })}
                />
              )
            }

            if (index === 1) {
              blocks.push(
                <WideStatsCard key="stats-1" items={statsItems.slice(0, 2)} />
              )
            }

            if (index === 2) {
              blocks.push(
                <WideSocialCard
                  key="social"
                  title={t('about.socialTitle')}
                  subtitle={t('about.socialSubtitle')}
                  facebookLabel={t('about.social.facebook')}
                  instagramLabel={t('about.social.instagram')}
                />
              )
            }

            if (index === 3) {
              blocks.push(
                <WideStatsCard key="stats-2" items={statsItems.slice(2, 4)} />
              )
            }

            if (index === 5) {
              blocks.push(
                <WideMediaCard
                  key="media"
                  title={t('about.mediaTitle')}
                  body={t('about.mediaBody')}
                  articleLabel={t('about.mediaArticleLabel')}
                  articleHref="https://radioemaus.pl/aktualnosci/czym-moga-sie-zajac-mlodzi-ludzie-ktorzy-chca-od-zycia-czegos-wiecej-niz-domu-i-pracy-franciszek-awuku-i-sebastian-andrzejewski-zalozyciele-centrum-kenaz/"
                  videoTitle={t('about.mediaVideoTitle')}
                  videoHref="https://www.youtube.com/watch?v=egjMDE_7wDY"
                />
              )
              blocks.push(
                <WideSponsorsCard
                  key="sponsors"
                  title={t('about.sponsorsTitle')}
                  body={t('about.sponsorsBody')}
                  sponsorLabel={t('about.sponsorsPrimary')}
                  sponsorHref="https://go.decathlon.pl/profil/d2cbf959-efd9-4a9d-be09-664cbe53fa54"
                />
              )
              blocks.push(
                <WideSupportCard
                  key="support"
                  title={t('about.supportTitle')}
                  body={t('about.supportBody')}
                  buttonLabel={t('about.supportButton')}
                />
              )
            }

            return blocks
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true)
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const duration = 2200
    const start = performance.now()
    const step = (timestamp) => {
      const progress = Math.min((timestamp - start) / duration, 1)
      setDisplay(Math.floor(progress * value))
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  }, [started, value])

  return (
    <div
      ref={ref}
      className="p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent text-navy dark:text-cream"
    >
      <div className="text-3xl font-black">{display.toLocaleString('pl-PL')}</div>
      <div className="mt-2 text-sm text-navy/70 dark:text-cream/70">{label}</div>
    </div>
  )
}

function WideStoryCard({ title, body, image, alt, imagePosition, reverse }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent ${
      reverse ? 'md:[&>*:first-child]:order-2' : ''
    }`}>
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-navy dark:text-cream">
          {title}
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-navy/80 dark:text-cream/80 whitespace-pre-line">
          {body}
        </p>
      </div>
      <img
        src={image}
        alt={alt || ''}
        className={`w-full h-72 rounded-xl object-cover ${imagePosition || 'object-center'}`}
        loading="lazy"
      />
    </div>
  )
}

function WideCtaCard({ message, primaryLabel, onPrimary }) {
  return (
    <div className="p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="text-lg md:text-xl font-semibold text-navy dark:text-cream">
        {message}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onPrimary}
          className="px-6 h-12 inline-flex items-center rounded-full font-semibold text-base
            btn-primary"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}

function WideStatsCard({ items }) {
  return (
    <div className="grid grid-cols-2 gap-4 my-6">
      {items.map((item) => (
        <StatCard
          key={item.label}
          value={Number(String(item.value).replace(/[^\d]/g, ''))}
          label={item.label}
        />
      ))}
    </div>
  )
}

function WideSocialCard({ title, subtitle, facebookLabel, instagramLabel }) {
  return (
    <div className="p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div>
        <h2 className="text-xl font-bold text-navy dark:text-cream">{title}</h2>
        <p className="mt-1 text-sm text-navy/60 dark:text-cream/60">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <SocialLink
          href="https://www.facebook.com/profile.php?id=61558056234732"
          label={facebookLabel}
          icon="facebook"
        />
        <SocialLink
          href="https://www.instagram.com/centrum.kenaz/"
          label={instagramLabel}
          icon="instagram"
        />
      </div>
    </div>
  )
}

function WideMediaCard({ title, body, articleLabel, articleHref, videoTitle, videoHref }) {
  return (
    <div className="p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent">
      <h2 className="text-2xl font-bold text-navy dark:text-cream">{title}</h2>
      <p className="mt-3 text-base md:text-lg text-navy/70 dark:text-cream/70">
        {body}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={articleHref}
          target="_blank"
          rel="noreferrer"
          className="px-4 h-10 inline-flex items-center rounded-full font-semibold
            btn-primary"
        >
          {articleLabel}
        </a>
        <a
          href={videoHref}
          target="_blank"
          rel="noreferrer"
          className="px-4 h-10 inline-flex items-center rounded-full font-semibold
            btn-secondary"
        >
          {videoTitle}
        </a>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            title={videoTitle}
            src="https://www.youtube.com/embed/egjMDE_7wDY"
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

function WideSupportCard({ title, body, buttonLabel }) {
  return (
    <div className="p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
            <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-navy dark:text-cream">{title}</div>
        </div>
        <div className="text-base text-navy/70 dark:text-cream/70">{body}</div>
      </div>
      <a
        href="/support"
        className="shrink-0 px-5 h-11 inline-flex items-center rounded-full font-semibold btn-primary"
      >
        {buttonLabel}
      </a>
    </div>
  )
}

function WideSponsorsCard({ title, body, sponsorLabel, sponsorHref }) {
  return (
    <div className="p-6 rounded-2xl border border-navy/10 bg-transparent dark:border-cream/15 dark:bg-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div>
        <div className="text-2xl font-bold text-navy dark:text-cream">{title}</div>
        <div className="mt-2 text-base text-navy/70 dark:text-cream/70">{body}</div>
      </div>
      <a
        href={sponsorHref}
        target="_blank"
        rel="noreferrer"
        className="px-5 h-11 inline-flex items-center rounded-full font-semibold
          btn-primary"
      >
        {sponsorLabel}
      </a>
    </div>
  )
}

function SocialLink({ href, label, icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-3 h-9 rounded-full bg-navy/10 dark:bg-cream/10
        text-navy dark:text-cream font-semibold hover:bg-navy/20 dark:hover:bg-cream/20"
    >
      {icon === 'facebook' ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 12a10 10 0 10-11.5 9.95v-7.04H7.9V12h2.6V9.8c0-2.57 1.53-3.99 3.88-3.99 1.12 0 2.3.2 2.3.2v2.53h-1.3c-1.29 0-1.69.8-1.69 1.62V12h2.87l-.46 2.91h-2.41v7.04A10 10 0 0022 12z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )}
      <span>{label}</span>
    </a>
  )
}

export default AboutSection
