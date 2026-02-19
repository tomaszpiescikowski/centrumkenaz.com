import { useCallback } from 'react'

function usePreserveScrollSearchSwitch(setSearchParams, key = 'view') {
  return useCallback((value) => {
    const appMain = document.querySelector('.app-main')
    const windowScrollY = window.scrollY
    const mainScrollY = appMain ? appMain.scrollTop : 0

    setSearchParams({ [key]: value })

    requestAnimationFrame(() => {
      window.scrollTo({ top: windowScrollY, behavior: 'auto' })
      if (appMain) {
        appMain.scrollTo({ top: mainScrollY, behavior: 'auto' })
      }
    })
  }, [setSearchParams, key])
}

export default usePreserveScrollSearchSwitch
