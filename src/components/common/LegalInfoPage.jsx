import styles from '../../styles/modules/pages/LegalPage.module.css'

function LegalInfoPage({ title, body }) {
  return (
    <div className="page-shell">
      <div className="page-card">
        <h1 className={styles.sectionTitle}>{title}</h1>
        <p className={styles.sectionBody}>{body}</p>
      </div>
    </div>
  )
}

export default LegalInfoPage
