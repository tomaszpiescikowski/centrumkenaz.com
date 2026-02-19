import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchCities } from '../api/cities'

const CityContext = createContext()
const CITY_STORAGE_KEY = 'kenaz.city'
const DEFAULT_CITY = { name: 'Poznań', slug: 'poznan' }
const FALLBACK_CITIES = [
  DEFAULT_CITY,
  { name: 'Warszawa', slug: 'warszawa' },
]

export function CityProvider({ children }) {
  const [cities, setCities] = useState(FALLBACK_CITIES)
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchCities()
        if (cancelled) return
        const normalized = Array.isArray(data) && data.length ? data : FALLBACK_CITIES
        setCities(normalized)

        const storedSlug = localStorage.getItem(CITY_STORAGE_KEY) || DEFAULT_CITY.slug
        const storedCity = normalized.find((city) => city.slug === storedSlug) || normalized[0] || DEFAULT_CITY
        setSelectedCity(storedCity)
      } catch (error) {
        if (!cancelled) {
          setCities(FALLBACK_CITIES)
          const storedSlug = localStorage.getItem(CITY_STORAGE_KEY) || DEFAULT_CITY.slug
          const storedCity = FALLBACK_CITIES.find((city) => city.slug === storedSlug) || DEFAULT_CITY
          setSelectedCity(storedCity)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectCity = (slug) => {
    const next = cities.find((city) => city.slug === slug) || DEFAULT_CITY
    setSelectedCity(next)
    localStorage.setItem(CITY_STORAGE_KEY, next.slug)
  }

  const value = useMemo(() => ({
    cities,
    selectedCity,
    selectCity,
    loading,
  }), [cities, selectedCity, loading])

  return (
    <CityContext.Provider value={value}>
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  const context = useContext(CityContext)
  if (!context) {
    throw new Error('useCity must be used within a CityProvider')
  }
  return context
}
