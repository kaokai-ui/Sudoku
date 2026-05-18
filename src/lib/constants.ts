import type { DifficultyKey, ModeConfig, ModeKey } from './types'

export const BUILD_VERSION = __BUILD_VERSION__

export const MODE_ORDER: ModeKey[] = ['4x4', '6x6', '9x9']

export const MODE_CONFIGS: Record<ModeKey, ModeConfig> = {
  '4x4': {
    mode: '4x4',
    size: 4,
    boxRows: 2,
    boxCols: 2,
    label: '4 x 4',
    subtitle: '快速暖身，適合新手與長輩',
  },
  '6x6': {
    mode: '6x6',
    size: 6,
    boxRows: 2,
    boxCols: 3,
    label: '6 x 6',
    subtitle: '節奏剛好，平板與 TV 很順手',
  },
  '9x9': {
    mode: '9x9',
    size: 9,
    boxRows: 3,
    boxCols: 3,
    label: '9 x 9',
    subtitle: '完整經典題型，題庫最多',
  },
}

export function formatDifficultyLabel(difficulty: DifficultyKey): string {
  return `難度 ${difficulty}`
}

export const STORAGE_KEYS = {
  settings: 'sudoku-home-settings',
  saves: 'sudoku-saves',
  version: 'sudoku-build-version',
}
