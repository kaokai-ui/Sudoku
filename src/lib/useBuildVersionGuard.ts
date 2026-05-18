import { useEffect } from 'react'

import { BUILD_VERSION, STORAGE_KEYS } from './constants'

export function useBuildVersionGuard(): void {
  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    const loadedVersion = currentUrl.searchParams.get('v')
    const storedVersion = window.localStorage.getItem(STORAGE_KEYS.version)

    if (storedVersion !== BUILD_VERSION && loadedVersion !== BUILD_VERSION) {
      currentUrl.searchParams.set('v', BUILD_VERSION)
      window.localStorage.setItem(STORAGE_KEYS.version, BUILD_VERSION)
      window.location.replace(currentUrl.toString())
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.version, BUILD_VERSION)
  }, [])
}
