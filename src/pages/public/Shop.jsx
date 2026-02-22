import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { API_URL } from '../../api/config'

function Shop() {
  const { t } = useLanguage()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/products/`)
        if (!response.ok) throw new Error('Failed to load products')
        const data = await response.json()
        if (!cancelled) setProducts(data)
      } catch (_error) {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-shell flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0 sm:mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-navy/40 dark:text-cream/40">
          {t('shop.label')}
        </p>
        <h1 className="text-3xl font-black text-navy dark:text-cream md:text-5xl">
          {t('shop.title')}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-navy/70 dark:text-cream/70 md:text-base">
          {t('shop.subtitle')}
        </p>
      </div>

      {loading ? (
        <p className="text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-6 pb-2 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col rounded-2xl border border-navy/10 bg-[rgba(255,251,235,0.82)] p-4 text-navy dark:border-cream/15 dark:bg-[rgba(15,23,74,0.68)] dark:text-cream"
              >
                <div className="rounded-xl bg-cream/70 p-3 dark:bg-navy/50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-48 w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-48 rounded-lg bg-navy/10 dark:bg-cream/10" />
                  )}
                </div>
                <h3 className="mt-4 text-xl font-bold">{product.name}</h3>
                {product.description && (
                  <p className="mt-2 text-sm text-navy/70 dark:text-cream/70">
                    {product.description}
                  </p>
                )}
                <div className="mt-4 text-lg font-semibold">
                  {product.price} {t('common.currency')}
                </div>
                <button
                  type="button"
                  className="btn-primary mt-4 h-11 px-5 font-semibold"
                >
                  {t('shop.cta')}
                </button>
              </div>
            ))}

            {!products.length && (
              <div className="text-navy/60 dark:text-cream/60">
                {t('shop.empty')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Shop
