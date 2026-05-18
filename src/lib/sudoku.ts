import type { CellPosition, ModeConfig } from './types'

export function stringToBoard(source: string, size: number): number[][] {
  const board: number[][] = []

  for (let row = 0; row < size; row += 1) {
    board.push(
      source
        .slice(row * size, (row + 1) * size)
        .split('')
        .map((value) => Number(value)),
    )
  }

  return board
}

export function boardToString(board: number[][]): string {
  return board.flat().join('')
}

export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row])
}

export function isFixedCell(initialBoard: number[][], row: number, col: number): boolean {
  return initialBoard[row][col] !== 0
}

export function isBoardComplete(board: number[][], solution: number[][]): boolean {
  return board.every((row, rowIndex) =>
    row.every((value, colIndex) => value !== 0 && value === solution[rowIndex][colIndex]),
  )
}

export function getCompletion(board: number[][], solution: number[][]): number {
  const total = solution.length * solution.length
  let solved = 0

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] !== 0 && board[row][col] === solution[row][col]) {
        solved += 1
      }
    }
  }

  return Math.round((solved / total) * 100)
}

export function findFirstEditableCell(initialBoard: number[][]): CellPosition {
  for (let row = 0; row < initialBoard.length; row += 1) {
    for (let col = 0; col < initialBoard.length; col += 1) {
      if (initialBoard[row][col] === 0) {
        return { row, col }
      }
    }
  }

  return { row: 0, col: 0 }
}

export function isRelatedCell(
  selectedCell: CellPosition | null,
  cell: CellPosition,
  modeConfig: ModeConfig,
): boolean {
  if (!selectedCell) {
    return false
  }

  if (selectedCell.row === cell.row || selectedCell.col === cell.col) {
    return true
  }

  const sameBoxRow = Math.floor(selectedCell.row / modeConfig.boxRows) === Math.floor(cell.row / modeConfig.boxRows)
  const sameBoxCol = Math.floor(selectedCell.col / modeConfig.boxCols) === Math.floor(cell.col / modeConfig.boxCols)
  return sameBoxRow && sameBoxCol
}
