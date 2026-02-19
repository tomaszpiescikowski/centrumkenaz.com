import { useLanguage } from '../../context/LanguageContext'
import LegalInfoPage from '../../components/common/LegalInfoPage'

function Terms() {
  const { t } = useLanguage()

  return <LegalInfoPage title={t('terms.title')} body={t('terms.body')} />
}

export default Terms
