import { useEffect, useRef, useState } from 'react'

import {
  BUILD_VERSION,
  formatDifficultyLabel,
  MODE_CONFIGS,
  MODE_ORDER,
} from './lib/constants'
import {
  getAvailableDifficulties,
  getModeSize,
  getPuzzleById,
  getPuzzleCount,
  getPuzzles,
  getResolvedDifficulty,
} from './lib/puzzles'
import { getSlotKey, loadSavedGames, loadSettings, saveSettings } from './lib/storage'
import {
  boardToString,
  cloneBoard,
  findFirstEditableCell,
  isBoardComplete,
  isFixedCell,
  isRelatedCell,
  stringToBoard,
} from './lib/sudoku'
import type {
  CellPosition,
  DifficultyKey,
  HomeSettings,
  HydratedGame,
  ModeKey,
  PuzzleRecord,
  SavedGame,
} from './lib/types'
import { useBuildVersionGuard } from './lib/useBuildVersionGuard'

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function hydrateSavedGame(savedGame: SavedGame): HydratedGame | null {
  const puzzle = getPuzzleById(savedGame.puzzleId)
  if (!puzzle) {
    return null
  }

  const size = getModeSize(savedGame.mode)
  return {
    ...savedGame,
    puzzle,
    boardMatrix: stringToBoard(savedGame.board, size),
    initialBoard: stringToBoard(puzzle.puzzle, size),
    solutionMatrix: stringToBoard(puzzle.solution, size),
  }
}

function createGame(mode: ModeKey, difficulty: DifficultyKey, puzzle: PuzzleRecord): HydratedGame {
  const initialBoard = stringToBoard(puzzle.puzzle, MODE_CONFIGS[mode].size)
  const startedAt = new Date().toISOString()

  return {
    puzzleId: puzzle.id,
    mode,
    difficulty,
    board: puzzle.puzzle,
    selectedCell: findFirstEditableCell(initialBoard),
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    puzzle,
    boardMatrix: initialBoard,
    initialBoard,
    solutionMatrix: stringToBoard(puzzle.solution, MODE_CONFIGS[mode].size),
  }
}

function dehydrateGame(game: HydratedGame): SavedGame {
  return {
    puzzleId: game.puzzleId,
    mode: game.mode,
    difficulty: game.difficulty,
    board: boardToString(game.boardMatrix),
    selectedCell: game.selectedCell,
    startedAt: game.startedAt,
    updatedAt: game.updatedAt,
    completedAt: game.completedAt,
  }
}

function App() {
  useBuildVersionGuard()

  const [settings, setSettings] = useState<HomeSettings>(() => {
    const loaded = loadSettings()
    return {
      ...loaded,
      difficulty: getResolvedDifficulty(loaded.mode, loaded.difficulty),
    }
  })
  const [savedGames, setSavedGames] = useState<Record<string, SavedGame>>(() => loadSavedGames())
  const [screen, setScreen] = useState<'home' | 'game'>('home')
  const [game, setGame] = useState<HydratedGame | null>(null)
  const [statusMessage, setStatusMessage] = useState('題庫已載入，選好模式就可以開始。')
  const boardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const panelRefs = useRef<Record<string, HTMLElement | null>>({})
  const pendingFocusRef = useRef<CellPosition | null>(null)

  const modeConfig = MODE_CONFIGS[settings.mode]
  const selectedDifficulty = getResolvedDifficulty(settings.mode, settings.difficulty)
  const availableDifficulties = getAvailableDifficulties(settings.mode)
  const selectedSlotKey = getSlotKey(settings.mode, selectedDifficulty)
  const savedForSelection = savedGames[selectedSlotKey] ?? null
  const puzzlesForSelection = getPuzzles(settings.mode, selectedDifficulty)
  const keypadColumns = modeConfig.size === 4 ? 2 : 3

  function persistSettings(nextSettings: HomeSettings): void {
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  function persistSavedGame(slotKey: string, nextSave: SavedGame | null): void {
    setSavedGames((current) => {
      const next = { ...current }
      if (nextSave) {
        next[slotKey] = nextSave
      } else {
        delete next[slotKey]
      }
      window.localStorage.setItem('sudoku-saves', JSON.stringify(next))
      return next
    })
  }

  function focusBoardCell(row: number, col: number): void {
    requestAnimationFrame(() => {
      boardRefs.current[`cell-${row}-${col}`]?.focus()
    })
  }

  function focusPanelControl(id: string): void {
    requestAnimationFrame(() => {
      panelRefs.current[id]?.focus()
    })
  }

  function openGame(nextGame: HydratedGame): void {
    pendingFocusRef.current = nextGame.selectedCell
    setGame(nextGame)
    setScreen('game')
  }

  function goHome(message = '已回到主畫面。'): void {
    setScreen('home')
    setStatusMessage(message)
  }

  function openPuzzle(
    mode: ModeKey,
    difficulty: DifficultyKey,
    puzzle: PuzzleRecord,
    message: string,
  ): void {
    const nextGame = createGame(mode, difficulty, puzzle)
    const slotKey = getSlotKey(mode, difficulty)

    persistSettings({ mode, difficulty })
    persistSavedGame(slotKey, dehydrateGame(nextGame))
    setStatusMessage(message)
    openGame(nextGame)
  }

  function startNewGame(mode = settings.mode, difficulty = selectedDifficulty, excludeId?: string): void {
    const resolvedDifficulty = getResolvedDifficulty(mode, difficulty)
    const puzzles = getPuzzles(mode, resolvedDifficulty)
    const puzzle = excludeId
      ? puzzles.find((entry) => entry.id !== excludeId) ?? puzzles[0]
      : puzzles[0]

    openPuzzle(
      mode,
      resolvedDifficulty,
      puzzle,
      `${MODE_CONFIGS[mode].label} ${formatDifficultyLabel(resolvedDifficulty)} 已開局。`,
    )
  }

  function restartCurrentGame(): void {
    if (!game) {
      return
    }

    openPuzzle(
      game.mode,
      game.difficulty,
      game.puzzle,
      `${MODE_CONFIGS[game.mode].label} ${formatDifficultyLabel(game.difficulty)} 已重新開始。`,
    )
  }

  function continueToNextGame(): void {
    if (!game) {
      return
    }

    const puzzles = getPuzzles(game.mode, game.difficulty)
    const currentIndex = puzzles.findIndex((puzzle) => puzzle.id === game.puzzleId)
    const nextPuzzle = currentIndex >= 0 ? puzzles[(currentIndex + 1) % puzzles.length] : puzzles[0]

    openPuzzle(
      game.mode,
      game.difficulty,
      nextPuzzle,
      `${MODE_CONFIGS[game.mode].label} ${formatDifficultyLabel(game.difficulty)} 已進入下一題。`,
    )
  }

  function continueSavedGame(mode = settings.mode, difficulty = selectedDifficulty): void {
    const resolvedDifficulty = getResolvedDifficulty(mode, difficulty)
    const slotKey = getSlotKey(mode, resolvedDifficulty)
    const savedGame = savedGames[slotKey]
    if (!savedGame) {
      setStatusMessage('這個難度目前沒有可續玩的進度。')
      return
    }

    const hydratedGame = hydrateSavedGame(savedGame)
    if (!hydratedGame) {
      persistSavedGame(slotKey, null)
      setStatusMessage('原本的進度已失效，已幫你清掉，重新開一局就好。')
      return
    }

    persistSettings({ mode, difficulty: resolvedDifficulty })
    setStatusMessage('已接續上次進度。')
    openGame(hydratedGame)
  }

  function updateSelectedCell(nextCell: CellPosition): void {
    if (!game) {
      return
    }

    setGame({
      ...game,
      selectedCell: nextCell,
    })
  }

  function commitGame(nextGame: HydratedGame, message?: string): void {
    setGame(nextGame)
    persistSavedGame(getSlotKey(nextGame.mode, nextGame.difficulty), dehydrateGame(nextGame))
    if (message) {
      setStatusMessage(message)
    }
  }

  function writeValue(value: number): void {
    if (!game || !game.selectedCell) {
      setStatusMessage('先選一個空格，再填入數字。')
      return
    }

    const { row, col } = game.selectedCell
    if (isFixedCell(game.initialBoard, row, col)) {
      setStatusMessage('這個數字是題目給定的，不能修改。')
      return
    }

    const nextBoard = cloneBoard(game.boardMatrix)
    nextBoard[row][col] = value
    const completedAt = isBoardComplete(nextBoard, game.solutionMatrix) ? new Date().toISOString() : null

    commitGame(
      {
        ...game,
        boardMatrix: nextBoard,
        board: boardToString(nextBoard),
        updatedAt: new Date().toISOString(),
        completedAt,
      },
      completedAt ? '太棒了，這一局已經完成。' : `已填入 ${value}。`,
    )
  }

  function eraseValue(): void {
    if (!game || !game.selectedCell) {
      setStatusMessage('先選一個可編輯的格子。')
      return
    }

    const { row, col } = game.selectedCell
    if (isFixedCell(game.initialBoard, row, col)) {
      setStatusMessage('題目給定的數字不能擦除。')
      return
    }

    const nextBoard = cloneBoard(game.boardMatrix)
    nextBoard[row][col] = 0
    commitGame(
      {
        ...game,
        boardMatrix: nextBoard,
        board: boardToString(nextBoard),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      },
      '已清除這一格。',
    )
  }

  function useHint(): void {
    if (!game) {
      return
    }

    let target = game.selectedCell

    if (
      !target ||
      isFixedCell(game.initialBoard, target.row, target.col) ||
      game.boardMatrix[target.row][target.col] === game.solutionMatrix[target.row][target.col]
    ) {
      outer: for (let row = 0; row < modeConfig.size; row += 1) {
        for (let col = 0; col < modeConfig.size; col += 1) {
          if (
            !isFixedCell(game.initialBoard, row, col) &&
            game.boardMatrix[row][col] !== game.solutionMatrix[row][col]
          ) {
            target = { row, col }
            break outer
          }
        }
      }
    }

    if (!target) {
      setStatusMessage('這一局看起來已經沒有需要提示的地方。')
      return
    }

    const nextBoard = cloneBoard(game.boardMatrix)
    nextBoard[target.row][target.col] = game.solutionMatrix[target.row][target.col]
    const completedAt = isBoardComplete(nextBoard, game.solutionMatrix) ? new Date().toISOString() : null

    commitGame(
      {
        ...game,
        boardMatrix: nextBoard,
        board: boardToString(nextBoard),
        selectedCell: target,
        updatedAt: new Date().toISOString(),
        completedAt,
      },
      completedAt ? '提示已補上，這一局也同步完成了。' : '已替你補上一個正確答案。',
    )
    focusBoardCell(target.row, target.col)
  }

  function handleBoardArrow(row: number, col: number, direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!game) {
      return
    }

    if (direction === 'right' && col === modeConfig.size - 1) {
      focusPanelControl('digit-1')
      return
    }

    if (direction === 'down' && row === modeConfig.size - 1) {
      focusPanelControl('digit-1')
      return
    }

    const nextRow =
      direction === 'up'
        ? Math.max(row - 1, 0)
        : direction === 'down'
          ? Math.min(row + 1, modeConfig.size - 1)
          : row

    const nextCol =
      direction === 'left'
        ? Math.max(col - 1, 0)
        : direction === 'right'
          ? Math.min(col + 1, modeConfig.size - 1)
          : col

    updateSelectedCell({ row: nextRow, col: nextCol })
    focusBoardCell(nextRow, nextCol)
  }

  function focusBottomKeypadDigit(column: number): void {
    const baseIndex = Math.max(modeConfig.size - keypadColumns, 0)
    const targetIndex = Math.min(baseIndex + column, modeConfig.size - 1)
    focusPanelControl(`digit-${targetIndex + 1}`)
  }

  function moveKeypadFocus(currentIndex: number, direction: 'up' | 'down' | 'left' | 'right'): void {
    const row = Math.floor(currentIndex / keypadColumns)
    const col = currentIndex % keypadColumns
    const lastIndex = modeConfig.size - 1

    if (direction === 'left' && col === 0) {
      if (game?.selectedCell) {
        focusBoardCell(game.selectedCell.row, game.selectedCell.col)
      }
      return
    }

    if (direction === 'up' && row === 0) {
      if (game?.selectedCell) {
        focusBoardCell(game.selectedCell.row, game.selectedCell.col)
      }
      return
    }

    if (direction === 'down' && currentIndex + keypadColumns > lastIndex) {
      focusPanelControl(col === 0 ? 'tool-home' : col === 1 ? 'tool-erase' : 'tool-hint')
      return
    }

    const nextIndex =
      direction === 'left'
        ? currentIndex - 1
        : direction === 'right'
          ? currentIndex + 1
          : direction === 'up'
            ? currentIndex - keypadColumns
            : currentIndex + keypadColumns

    if (nextIndex >= 0 && nextIndex <= lastIndex) {
      focusPanelControl(`digit-${nextIndex + 1}`)
    }
  }

  const currentValue =
    game?.selectedCell ? game.boardMatrix[game.selectedCell.row][game.selectedCell.col] : 0
  const canErase =
    !!game?.selectedCell && !isFixedCell(game.initialBoard, game.selectedCell.row, game.selectedCell.col)
  const isCompleted = Boolean(game?.completedAt)
  const gamePuzzles = game ? getPuzzles(game.mode, game.difficulty) : []
  const currentPuzzleIndex = gamePuzzles.findIndex((puzzle) => puzzle.id === game?.puzzleId)
  const currentPuzzleNumber = currentPuzzleIndex >= 0 ? currentPuzzleIndex + 1 : 1
  const currentPuzzleTotal = gamePuzzles.length

  useEffect(() => {
    if (screen !== 'game' || !pendingFocusRef.current) {
      return
    }

    const target = pendingFocusRef.current
    pendingFocusRef.current = null
    focusBoardCell(target.row, target.col)
  }, [game?.puzzleId, game?.startedAt, screen])

  useEffect(() => {
    window.scrollTo(0, 0)

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [screen])

  return (
    <main className="app-shell">
      {screen === 'home' || !game ? (
        <section className="home-shell">
          <header className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">Sudoku for Every Screen</span>
              <h1>數獨遊戲</h1>
              <p>
                題庫來自 sudoku.org.tw 的 4x4、6x6、9x9 教材，支援電腦、平板、Android TV，
                而且每一步都會自動續存。
              </p>
            </div>
            <div className="version-card">
              <div>
                <strong>Build</strong>
                <span>{BUILD_VERSION}</span>
              </div>
              <div>
                <strong>儲存</strong>
                <span>localStorage</span>
              </div>
            </div>
          </header>

          <section className="selection-section">
            <div className="section-head section-head--inline">
              <h2>選擇模式</h2>
              <p>先挑盤面尺寸，再決定難度。</p>
            </div>
            <div className="mode-grid">
              {MODE_ORDER.map((mode) => {
                const config = MODE_CONFIGS[mode]
                const isActive = settings.mode === mode

                return (
                  <button
                    key={mode}
                    type="button"
                    className={`mode-card ${isActive ? 'is-active' : ''}`}
                    onClick={() =>
                      persistSettings({
                        mode,
                        difficulty: getResolvedDifficulty(mode, selectedDifficulty),
                      })
                    }
                  >
                    <span className="mode-card__title">{config.label}</span>
                    <span className="mode-card__text">{config.subtitle}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="selection-section">
            <div className="section-head section-head--inline">
              <h2>選擇難度</h2>
            </div>
            <div className="difficulty-row">
              {availableDifficulties.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  className={`difficulty-chip ${selectedDifficulty === difficulty ? 'is-active' : ''}`}
                  onClick={() => persistSettings({ ...settings, difficulty })}
                >
                  <span>{formatDifficultyLabel(difficulty)}</span>
                  <small>{getPuzzleCount(settings.mode, difficulty)} 題</small>
                </button>
              ))}
            </div>
          </section>

          <section className="action-panel">
            <div className="action-panel__summary">
              <div className="section-head section-head--inline action-panel__headline">
                <h2>
                  {MODE_CONFIGS[settings.mode].label} / {formatDifficultyLabel(selectedDifficulty)}
                </h2>
                <p>{puzzlesForSelection.length} 道題目可選。</p>
              </div>
              {savedForSelection ? (
                <div className="save-card">
                  <strong>{savedForSelection.completedAt ? '已保存的完成局' : '可接續的進度'}</strong>
                  <span>
                    {getPuzzleById(savedForSelection.puzzleId)?.title ?? savedForSelection.puzzleId}
                  </span>
                  <span>最後更新 {formatTimestamp(savedForSelection.updatedAt)}</span>
                </div>
              ) : (
                <div className="save-card is-empty">
                  <strong>目前沒有續玩進度</strong>
                  <span>按「開始新局」就會自動建立新的存檔。</span>
                </div>
              )}
            </div>

            <div className="action-panel__buttons">
              <button type="button" className="primary-action" onClick={() => startNewGame()}>
                開始新局
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => continueSavedGame()}
                disabled={!savedForSelection}
              >
                繼續遊戲
              </button>
            </div>
          </section>

          <footer className="status-strip">
            <span>{statusMessage}</span>
            <span>支援加入主畫面捷徑與版本自動刷新</span>
          </footer>
        </section>
      ) : (
        <section className="game-shell">
          <header className="game-header">
            <div className="game-title-row">
              <span className="eyebrow">Now Playing</span>
              <h2>
                {MODE_CONFIGS[game.mode].label.replace(/\s+/g, '')} ({currentPuzzleNumber}/
                {currentPuzzleTotal}) {formatDifficultyLabel(game.difficulty).replace(/\s+/g, '')}
              </h2>
            </div>
          </header>

          <div className="game-layout">
            <section className={`board-card board-${game.mode}`}>
              <div
                className="sudoku-board"
                style={{ gridTemplateColumns: `repeat(${modeConfig.size}, 1fr)` }}
              >
                {game.boardMatrix.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const fixed = isFixedCell(game.initialBoard, rowIndex, colIndex)
                    const selected =
                      game.selectedCell?.row === rowIndex && game.selectedCell?.col === colIndex
                    const related = isRelatedCell(game.selectedCell, { row: rowIndex, col: colIndex }, modeConfig)
                    const sameValue = !!currentValue && currentValue === value && !selected
                    const correct = value !== 0 && value === game.solutionMatrix[rowIndex][colIndex]
                    const wrong = value !== 0 && value !== game.solutionMatrix[rowIndex][colIndex]

                    const classes = [
                      'sudoku-cell',
                      fixed ? 'is-fixed' : 'is-editable',
                      selected ? 'is-selected' : '',
                      related ? 'is-related' : '',
                      sameValue ? 'is-matching' : '',
                      !fixed && correct ? 'is-correct' : '',
                      !fixed && wrong ? 'is-wrong' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        ref={(node) => {
                          boardRefs.current[`cell-${rowIndex}-${colIndex}`] = node
                        }}
                        type="button"
                        className={classes}
                        style={{
                          borderTopWidth: rowIndex % modeConfig.boxRows === 0 ? 3 : 1,
                          borderLeftWidth: colIndex % modeConfig.boxCols === 0 ? 3 : 1,
                          borderRightWidth:
                            colIndex === modeConfig.size - 1 ||
                            (colIndex + 1) % modeConfig.boxCols === 0
                              ? 3
                              : 1,
                          borderBottomWidth:
                            rowIndex === modeConfig.size - 1 ||
                            (rowIndex + 1) % modeConfig.boxRows === 0
                              ? 3
                              : 1,
                        }}
                        onClick={() => updateSelectedCell({ row: rowIndex, col: colIndex })}
                        onFocus={() => updateSelectedCell({ row: rowIndex, col: colIndex })}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            handleBoardArrow(rowIndex, colIndex, 'up')
                          } else if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            handleBoardArrow(rowIndex, colIndex, 'down')
                          } else if (event.key === 'ArrowLeft') {
                            event.preventDefault()
                            handleBoardArrow(rowIndex, colIndex, 'left')
                          } else if (event.key === 'ArrowRight') {
                            event.preventDefault()
                            handleBoardArrow(rowIndex, colIndex, 'right')
                          } else if (/^[1-9]$/.test(event.key)) {
                            const digit = Number(event.key)
                            if (digit <= modeConfig.size) {
                              event.preventDefault()
                              writeValue(digit)
                            }
                          } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
                            event.preventDefault()
                            eraseValue()
                          }
                        }}
                        aria-label={`第 ${rowIndex + 1} 列，第 ${colIndex + 1} 欄`}
                      >
                        {value || ''}
                      </button>
                    )
                  }),
                )}
              </div>
            </section>

            <aside className="side-panel">
              <div
                className="keypad"
                style={{ gridTemplateColumns: `repeat(${keypadColumns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: modeConfig.size }, (_, index) => index + 1).map((digit, index) => (
                  <button
                    key={digit}
                    ref={(node) => {
                      panelRefs.current[`digit-${digit}`] = node
                    }}
                    type="button"
                    className={`digit-button ${currentValue === digit ? 'is-active' : ''}`}
                    onClick={() => writeValue(digit)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft') {
                        event.preventDefault()
                        moveKeypadFocus(index, 'left')
                      } else if (event.key === 'ArrowRight') {
                        event.preventDefault()
                        moveKeypadFocus(index, 'right')
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        moveKeypadFocus(index, 'up')
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        moveKeypadFocus(index, 'down')
                      }
                    }}
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="tool-row">
                <button
                  ref={(node) => {
                    panelRefs.current['tool-home'] = node
                  }}
                  type="button"
                  className="tool-button"
                  onClick={restartCurrentGame}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      focusPanelControl('tool-erase')
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      focusBottomKeypadDigit(0)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      focusPanelControl(isCompleted ? 'action-next' : 'action-home')
                    } else if (event.key === 'ArrowLeft' && game.selectedCell) {
                      event.preventDefault()
                      focusBoardCell(game.selectedCell.row, game.selectedCell.col)
                    }
                  }}
                >
                  重新遊戲
                </button>
                <button
                  ref={(node) => {
                    panelRefs.current['tool-erase'] = node
                  }}
                  type="button"
                  className="tool-button"
                  onClick={eraseValue}
                  disabled={!canErase}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      focusPanelControl('tool-home')
                    } else if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      focusPanelControl('tool-hint')
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      focusBottomKeypadDigit(1)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      focusPanelControl('action-home')
                    }
                  }}
                >
                  橡皮擦
                </button>
                <button
                  ref={(node) => {
                    panelRefs.current['tool-hint'] = node
                  }}
                  type="button"
                  className="tool-button"
                  onClick={useHint}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      focusPanelControl('tool-erase')
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      focusBottomKeypadDigit(2)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      focusPanelControl('action-home')
                    }
                  }}
                >
                  提示
                </button>
              </div>

              <div className="panel-actions">
                {isCompleted ? (
                  <button
                    ref={(node) => {
                      panelRefs.current['action-next'] = node
                    }}
                    type="button"
                    className="primary-action"
                    onClick={continueToNextGame}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        focusPanelControl('tool-home')
                      } else if (event.key === 'ArrowRight') {
                        event.preventDefault()
                        focusPanelControl('action-home')
                      }
                    }}
                  >
                    繼續遊戲
                  </button>
                ) : null}

                <button
                  ref={(node) => {
                    panelRefs.current['action-home'] = node
                  }}
                  type="button"
                  className="secondary-action"
                  onClick={() => goHome()}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      focusPanelControl(isCompleted ? 'action-next' : 'tool-home')
                    } else if (event.key === 'ArrowLeft' && isCompleted) {
                      event.preventDefault()
                      focusPanelControl('action-next')
                    }
                  }}
                >
                  回主畫面
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
