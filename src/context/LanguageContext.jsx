import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { languages, defaultLanguage, getTranslation } from '../languages'

const LanguageContext = createContext()
const LANGUAGE_STORAGE_KEY = 'kenaz.language'

/**
 * Maps app language codes to BCP47 locale tags that use 24-hour clock format.
 * This is critical for <input type="datetime-local"> — browsers use the <html lang>
 * attribute to decide whether to render a 12h (AM/PM) or 24h time picker.
 * Notably, "en" alone may be interpreted as en-US (12h) by some browsers,
 * so we explicitly map it to "en-GB" (24h).
 */
const LANG_TO_HTML_LOCALE = {
  pl: 'pl-PL',
  en: 'en-GB',
  zh: 'zh-CN',
  nl: 'nl-NL',
  it: 'it-IT',
  szl: 'pl-PL', // Silesian — no standard BCP47 region; fall back to Polish locale
}

function applyHtmlLang(langCode) {
  const htmlLocale = LANG_TO_HTML_LOCALE[langCode] || 'pl-PL'
  document.documentElement.lang = htmlLocale
}

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    const resolved = stored && languages[stored] ? stored : defaultLanguage
    applyHtmlLang(resolved)
    return resolved
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
      applyHtmlLang(langCode)
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
