import { STORAGE_KEYS } from './constants'
import type { HomeSettings, ModeKey, SavedGame } from './types'

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getSlotKey(mode: ModeKey, difficulty: HomeSettings['difficulty']): string {
  return `${mode}:${difficulty}`
}

export function loadSettings(): HomeSettings {
  return readJson<HomeSettings>(STORAGE_KEYS.settings, {
    mode: '9x9',
    difficulty: '1',
  })
}

export function saveSettings(settings: HomeSettings): void {
  writeJson(STORAGE_KEYS.settings, settings)
}

export function loadSavedGames(): Record<string, SavedGame> {
  return readJson<Record<string, SavedGame>>(STORAGE_KEYS.saves, {})
}

export function saveSavedGames(saves: Record<string, SavedGame>): void {
  writeJson(STORAGE_KEYS.saves, saves)
}
