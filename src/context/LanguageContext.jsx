import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { languages, defaultLanguage, getTranslation } from '../languages'

const LanguageContext = createContext()
const LANGUAGE_STORAGE_KEY = 'kenaz.language'

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return stored && languages[stored] ? stored : defaultLanguage
  })

  const t = useCallback((path, params = null) => {
    const translations = languages[currentLanguage].translations
    const value = getTranslation(translations, path)
    if (!params || typeof value !== 'string') return value
    return Object.entries(params).reduce((acc, [key, replacement]) => (
      acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(replacement))
    ), value)
  }, [currentLanguage])

  const changeLanguage = useCallback((langCode) => {
    if (languages[langCode]) {
      setCurrentLanguage(langCode)
      localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode)
    }
  }, [])

  const currentLanguageData = languages[currentLanguage]

  const value = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    t,
    languages,
    currentLanguageData,
  }), [currentLanguage, changeLanguage, t, currentLanguageData])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
