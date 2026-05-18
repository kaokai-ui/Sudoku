import catalogData from '../data/puzzles.generated.json'
import { MODE_CONFIGS } from './constants'
import type { DifficultyKey, ModeKey, PuzzleRecord } from './types'

type Catalog = Record<ModeKey, Record<string, PuzzleRecord[]>>

const catalog = catalogData as Catalog
const puzzleMap = new Map<string, PuzzleRecord>()

for (const mode of Object.keys(catalog) as ModeKey[]) {
  for (const difficulty of Object.keys(catalog[mode]) as DifficultyKey[]) {
    for (const puzzle of catalog[mode][difficulty]) {
      puzzleMap.set(puzzle.id, puzzle)
    }
  }
}

export function getPuzzles(mode: ModeKey, difficulty: DifficultyKey): PuzzleRecord[] {
  return catalog[mode][getResolvedDifficulty(mode, difficulty)]
}

export function getPuzzleById(id: string): PuzzleRecord | undefined {
  return puzzleMap.get(id)
}

export function getPuzzleCount(mode: ModeKey, difficulty: DifficultyKey): number {
  return getPuzzles(mode, difficulty).length
}

export function getAvailableDifficulties(mode: ModeKey): DifficultyKey[] {
  return Object.keys(catalog[mode])
    .sort((left, right) => Number(left) - Number(right))
    .map((value) => value as DifficultyKey)
}

export function getResolvedDifficulty(mode: ModeKey, difficulty: string): DifficultyKey {
  const available = getAvailableDifficulties(mode)
  return (available.includes(difficulty as DifficultyKey) ? difficulty : available[0]) as DifficultyKey
}

export function pickRandomPuzzle(
  mode: ModeKey,
  difficulty: DifficultyKey,
  excludeId?: string,
): PuzzleRecord {
  const pool = getPuzzles(mode, difficulty)
  const available = excludeId ? pool.filter((puzzle) => puzzle.id !== excludeId) : pool
  const resolvedPool = available.length > 0 ? available : pool
  return resolvedPool[Math.floor(Math.random() * resolvedPool.length)]
}

export function getModeSize(mode: ModeKey): number {
  return MODE_CONFIGS[mode].size
}
