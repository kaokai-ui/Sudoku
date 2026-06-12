export type ModeKey = '4x4' | '6x6' | '9x9'
export type DifficultyKey = `${number}`

export interface CellPosition {
  row: number
  col: number
}

export interface PuzzleRecord {
  id: string
  level: number
  sourceIndex: number
  title: string
  technique: string
  sourceFile: string
  order: number
  puzzle: string
  solution: string
}

export interface ModeConfig {
  mode: ModeKey
  size: number
  boxRows: number
  boxCols: number
  label: string
  subtitle: string
}

export interface HomeSettings {
  mode: ModeKey
  difficulty: DifficultyKey
}

export interface SavedGame {
  puzzleId: string
  mode: ModeKey
  difficulty: DifficultyKey
  board: string
  errorCount: number
  selectedCell: CellPosition | null
  startedAt: string
  updatedAt: string
  completedAt: string | null
}

export interface HydratedGame extends SavedGame {
  puzzle: PuzzleRecord
  boardMatrix: number[][]
  initialBoard: number[][]
  solutionMatrix: number[][]
}
