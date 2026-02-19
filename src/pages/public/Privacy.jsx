import { useLanguage } from '../../context/LanguageContext'
import LegalInfoPage from '../../components/common/LegalInfoPage'

function Privacy() {
  const { t } = useLanguage()

  return <LegalInfoPage title={t('privacy.title')} body={t('privacy.body')} />
}

export default Privacy
