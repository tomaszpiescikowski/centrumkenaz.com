import POLISH from './POLISH.json'
import ENGLISH from './ENGLISH.json'
import CHINESE from './CHINESE.json'
import SILESIAN from './SILESIAN.json'
import DUTCH from './DUTCH.json'
import ITALIAN from './ITALIAN.json'

export const languages = {
  pl: {
    code: 'pl',
    name: 'Polski',
    flag: '🇵🇱',
    translations: POLISH
  },
  en: {
    code: 'en',
    name: 'English',
    flag: '🇬🇧',
    translations: ENGLISH
  },
  zh: {
    code: 'zh',
    name: '中文',
    flag: '🇨🇳',
    translations: CHINESE
  },
  nl: {
    code: 'nl',
    name: 'Nederlands',
    flag: '🇳🇱',
    translations: DUTCH
  },
  it: {
    code: 'it',
    name: 'Italiano',
    flag: '🇮🇹',
    translations: ITALIAN
  },
  szl: {
    code: 'szl',
    name: 'Ślōnskŏ gŏdka',
    flag: '🪨',
    translations: SILESIAN
  }
}

export const defaultLanguage = 'pl'

export function getTranslation(translations, path) {
  const keys = path.split('.')
  let result = translations
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      return path
    }
  }
  return result
}
