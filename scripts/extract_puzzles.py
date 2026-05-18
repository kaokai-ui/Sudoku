from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_DIR = ROOT / "Reference"
OUTPUT_PATH = ROOT / "src" / "data" / "puzzles.generated.json"

MODE_CONFIG = {
    "4x4": {"size": 4, "box_rows": 2, "box_cols": 2},
    "6x6": {"size": 6, "box_rows": 2, "box_cols": 3},
    "9x9": {"size": 9, "box_rows": 3, "box_cols": 3},
}

TITLE_PATTERN = re.compile(r"教材第\s*([^級]+)\s*級---(\dx\d)\s*(.+?)\s*1$")
FILE_PATTERN = re.compile(r"sudo(\d)_(\d+)\.pdf$")
CHINESE_NUMERAL_MAP = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}


@dataclass(frozen=True)
class SourcePdf:
    path: Path
    mode: str
    size: int
    file_index: int
    level: int
    technique: str
    title: str
    difficulty: str


def unique_positions(values: list[float], tolerance: float = 1.0) -> list[float]:
    values = sorted(values)
    grouped: list[list[float]] = []

    for value in values:
        if not grouped or abs(value - grouped[-1][-1]) > tolerance:
            grouped.append([value])
        else:
            grouped[-1].append(value)

    return [sum(group) / len(group) for group in grouped]


def split_by_largest_gaps(values: list[float], groups_needed: int) -> list[float]:
    if groups_needed == 1:
        return [-math.inf, math.inf]

    gaps = [values[index + 1] - values[index] for index in range(len(values) - 1)]
    split_indices = sorted(
        sorted(range(len(gaps)), key=lambda index: gaps[index], reverse=True)[: groups_needed - 1]
    )

    boundaries = [-math.inf]
    for index in split_indices:
        boundaries.append((values[index] + values[index + 1]) / 2)
    boundaries.append(math.inf)
    return boundaries


def parse_level_token(token: str) -> int:
    token = token.strip()
    if token.isdigit():
        return int(token)
    if token == "十":
        return 10
    if token.startswith("十"):
        return 10 + CHINESE_NUMERAL_MAP[token[1:]]
    if token.endswith("十"):
        return CHINESE_NUMERAL_MAP[token[0]] * 10
    if "十" in token:
        tens, ones = token.split("十", maxsplit=1)
        return CHINESE_NUMERAL_MAP[tens] * 10 + CHINESE_NUMERAL_MAP[ones]
    return CHINESE_NUMERAL_MAP[token]


def parse_title(path: Path) -> tuple[int, str]:
    with pdfplumber.open(str(path)) as pdf:
        last_line = (pdf.pages[0].extract_text() or "").splitlines()[-1]

    matched = TITLE_PATTERN.search(last_line)
    if not matched:
        raise ValueError(f"Unable to parse title from {path}")

    level = parse_level_token(matched.group(1))
    technique = matched.group(3).strip()
    return level, technique


def parse_source_pdfs() -> list[SourcePdf]:
    discovered: list[SourcePdf] = []

    for path in sorted(REFERENCE_DIR.rglob("*.pdf")):
        matched = FILE_PATTERN.search(path.name)
        if not matched:
            continue

        size = int(matched.group(1))
        file_index = int(matched.group(2))
        mode = f"{size}x{size}"
        level, technique = parse_title(path)
        discovered.append(
            SourcePdf(
                path=path,
                mode=mode,
                size=size,
                file_index=file_index,
                level=level,
                technique=technique,
                title=f"第 {level} 級 {technique}",
                difficulty=str(file_index),
            )
        )

    return sorted(discovered, key=lambda item: (item.mode, item.file_index, item.path.name))


def parse_board_page(page: Any, size: int) -> list[list[list[int]]]:
    rects = [rect for rect in page.rects if 10 < rect["width"] < 100 and 10 < rect["height"] < 100]
    board_count = len(rects) // (size * size)

    x_values = unique_positions([rect["x0"] for rect in rects])
    board_columns = len(x_values) // size
    board_rows = board_count // board_columns
    x_bounds = split_by_largest_gaps(x_values, board_columns)

    digit_chars = [char for char in page.chars if char["text"].isdigit()]
    boards: dict[tuple[int, int], list[list[int]]] = {}

    for column_index in range(board_columns):
        column_rects = [
            rect for rect in rects if x_bounds[column_index] < rect["x0"] <= x_bounds[column_index + 1]
        ]
        x_positions = unique_positions([rect["x0"] for rect in column_rects])
        y_values = unique_positions([rect["top"] for rect in column_rects])
        y_bounds = split_by_largest_gaps(y_values, board_rows)

        for row_index in range(board_rows):
            board_rects = [
                rect
                for rect in column_rects
                if y_bounds[row_index] < rect["top"] <= y_bounds[row_index + 1]
            ]
            y_positions = unique_positions([rect["top"] for rect in board_rects])
            if len(board_rects) != size * size:
                raise ValueError(
                    f"Expected {size * size} rects in {row_index=}, {column_index=} but got {len(board_rects)}"
                )

            board = [[0 for _ in range(size)] for _ in range(size)]
            left = min(rect["x0"] for rect in board_rects)
            right = max(rect["x1"] for rect in board_rects)
            top = min(rect["top"] for rect in board_rects)
            bottom = max(rect["bottom"] for rect in board_rects)

            cell_height = sum(rect["height"] for rect in board_rects) / len(board_rects)
            cell_width = sum(rect["width"] for rect in board_rects) / len(board_rects)
            row_centers = [position + cell_height / 2 for position in y_positions]
            col_centers = [position + cell_width / 2 for position in x_positions]

            for char in digit_chars:
                center_x = (char["x0"] + char["x1"]) / 2
                center_y = (char["top"] + char["bottom"]) / 2
                if not (left <= center_x <= right and top <= center_y <= bottom):
                    continue

                row = min(range(size), key=lambda idx: abs(center_y - row_centers[idx]))
                column = min(range(size), key=lambda idx: abs(center_x - col_centers[idx]))
                board[row][column] = int(char["text"])

            boards[(row_index, column_index)] = board

    return [boards[(row_index, column_index)] for row_index in range(board_rows) for column_index in range(board_columns)]


def board_to_string(board: list[list[int]]) -> str:
    return "".join(str(value) for row in board for value in row)


def validate_pair(puzzle: list[list[int]], solution: list[list[int]]) -> None:
    for row_index, row in enumerate(puzzle):
        for column_index, value in enumerate(row):
            if value and value != solution[row_index][column_index]:
                raise ValueError("Puzzle givens do not match solution")


def export_catalog() -> dict[str, dict[str, list[dict[str, Any]]]]:
    source_pdfs = parse_source_pdfs()
    catalog: dict[str, dict[str, list[dict[str, Any]]]] = {mode: {} for mode in MODE_CONFIG}

    for source_pdf in source_pdfs:
        with pdfplumber.open(str(source_pdf.path)) as pdf:
            puzzle_boards: list[list[list[int]]] = []
            answer_boards: list[list[list[int]]] = []

            for page in pdf.pages:
                boards = parse_board_page(page, source_pdf.size)
                if len(boards) == 6:
                    puzzle_boards.extend(boards)
                elif len(boards) == 24:
                    answer_boards.extend(boards)
                else:
                    raise ValueError(f"Unexpected board count {len(boards)} in {source_pdf.path}")

        if len(puzzle_boards) != len(answer_boards):
            raise ValueError(f"Puzzle/answer mismatch in {source_pdf.path}")

        bucket = catalog[source_pdf.mode].setdefault(source_pdf.difficulty, [])

        for index, (puzzle, solution) in enumerate(zip(puzzle_boards, answer_boards, strict=True), start=1):
            validate_pair(puzzle, solution)
            bucket.append(
                {
                    "id": f"{source_pdf.mode}-{source_pdf.file_index:02d}-{index:03d}",
                    "level": source_pdf.level,
                    "sourceIndex": source_pdf.file_index,
                    "title": source_pdf.title,
                    "technique": source_pdf.technique,
                    "sourceFile": str(source_pdf.path.relative_to(ROOT)).replace("\\", "/"),
                    "order": index,
                    "puzzle": board_to_string(puzzle),
                    "solution": board_to_string(solution),
                }
            )

    return catalog


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    catalog = export_catalog()
    OUTPUT_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
