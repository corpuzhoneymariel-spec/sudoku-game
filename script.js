const SIZE = 9;
const BOX = 3;
const MAX_HINTS = 5;
const DIFFICULTY_REMOVALS = { Easy: 36, Medium: 45, Hard: 52 };
const DIFFICULTY_TIME_LIMITS = { Easy: 10, Medium: 15, Hard: 20 };

const boardElement = document.querySelector("#board");
const timerElement = document.querySelector("#timer");
const difficultyElement = document.querySelector("#difficulty");
const messageElement = document.querySelector("#game-message");
const statusElement = document.querySelector("#status-text");
const notesButton = document.querySelector("#notes-button");
const hintButton = document.querySelector("#hint-button");
const hintsRemainingElement = document.querySelector("#hints-remaining");
const homeScreen = document.querySelector("#home-screen");
const gameCard = document.querySelector("#game-card");
const homeStartButton = document.querySelector("#home-start-button");
const homeContinueButton = document.querySelector("#home-continue-button");
const homeLink = document.querySelector("#home-link");
const previewBoard = document.querySelector("#preview-board");
const homeDifficultyButtons = [...document.querySelectorAll("[data-home-difficulty]")];

let puzzle = [];
let solution = [];
let values = [];
let notes = Array.from({ length: SIZE * SIZE }, () => new Set());
let selectedCell = -1;
let noteMode = false;
let remainingSeconds = 0;
let timerId;
let gameComplete = false;
let hintsUsed = 0;
let hasStartedGame = false;
let gameVisible = false;
let selectedHomeDifficulty = difficultyElement.value;

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function makeSolution() {
  const bands = shuffled([0, 1, 2]);
  const rows = bands.flatMap((band) => shuffled([0, 1, 2]).map((row) => band * 3 + row));
  const stacks = shuffled([0, 1, 2]);
  const columns = stacks.flatMap((stack) => shuffled([0, 1, 2]).map((column) => stack * 3 + column));
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  return rows.map((row) => columns.map((column) => {
    const pattern = (BOX * (row % BOX) + Math.floor(row / BOX) + column) % SIZE;
    return digits[pattern];
  }));
}

function candidatesFor(grid, row, column) {
  const used = new Set();
  for (let index = 0; index < SIZE; index += 1) {
    used.add(grid[row][index]);
    used.add(grid[index][column]);
    used.add(grid[Math.floor(row / BOX) * BOX + Math.floor(index / BOX)][Math.floor(column / BOX) * BOX + index % BOX]);
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((number) => !used.has(number));
}

function countSolutions(grid, limit = 2) {
  let bestCell = null;
  let bestCandidates = null;

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (grid[row][column] !== 0) continue;
      const candidates = candidatesFor(grid, row, column);
      if (candidates.length === 0) return 0;
      if (bestCandidates === null || candidates.length < bestCandidates.length) {
        bestCell = [row, column];
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (bestCandidates?.length === 1) break;
  }

  if (bestCell === null) return 1;
  const [row, column] = bestCell;
  let count = 0;
  for (const number of bestCandidates) {
    grid[row][column] = number;
    count += countSolutions(grid, limit - count);
    grid[row][column] = 0;
    if (count >= limit) return count;
  }
  return count;
}

function generatePuzzle(difficulty) {
  const solved = makeSolution();
  const grid = solved.map((row) => [...row]);
  const cells = shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index));
  let removed = 0;

  for (const index of cells) {
    if (removed >= DIFFICULTY_REMOVALS[difficulty]) break;
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    const saved = grid[row][column];
    grid[row][column] = 0;
    if (countSolutions(grid.map((line) => [...line])) === 1) {
      removed += 1;
    } else {
      grid[row][column] = saved;
    }
  }

  return { puzzle: grid, solution: solved };
}

function showMessage(message, kind = "") {
  messageElement.textContent = message;
  messageElement.dataset.kind = kind;
}

function renderBoard() {
  boardElement.replaceChildren();
  const selectedValue = selectedCell >= 0 ? values[Math.floor(selectedCell / SIZE)][selectedCell % SIZE] : 0;

  for (let index = 0; index < SIZE * SIZE; index += 1) {
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    const value = values[row][column];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}${value ? `, ${value}` : ", empty"}`);
    button.dataset.index = String(index);
    button.setAttribute("aria-selected", String(selectedCell === index));

    if (puzzle[row][column] !== 0) {
      button.classList.add("given");
    } else if (value !== 0 && solution[row][column] !== value) {
      button.classList.add("error");
    }
    if (selectedCell >= 0 && (row === Math.floor(selectedCell / SIZE) || column === selectedCell % SIZE ||
      (Math.floor(row / BOX) === Math.floor(Math.floor(selectedCell / SIZE) / BOX) && Math.floor(column / BOX) === Math.floor((selectedCell % SIZE) / BOX)))) {
      button.classList.add("related");
    }
    if (selectedValue !== 0 && value === selectedValue) button.classList.add("same-number");
    if (selectedCell === index) button.classList.add("selected");

    if (value !== 0) {
      button.textContent = String(value);
    } else if (notes[index].size > 0) {
      const noteGrid = document.createElement("span");
      noteGrid.className = "notes-grid";
      for (let number = 1; number <= SIZE; number += 1) {
        const note = document.createElement("span");
        note.textContent = notes[index].has(number) ? String(number) : "";
        noteGrid.append(note);
      }
      button.append(noteGrid);
    }

    button.addEventListener("click", () => {
      selectedCell = index;
      renderBoard();
    });
    boardElement.append(button);
  }
}

function updateTimer() {
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  timerElement.textContent = `${minutes}:${seconds}`;
}

function updateHintButton() {
  const hintsRemaining = MAX_HINTS - hintsUsed;
  hintsRemainingElement.textContent = `${hintsRemaining} ${hintsRemaining === 1 ? "hint" : "hints"} left`;
  hintButton.disabled = hintsRemaining === 0;
}

function renderPreviewBoard() {
  const sample = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ];
  const highlightedCells = new Set([22, 40, 57]);
  previewBoard.replaceChildren();
  sample.flat().forEach((value, index) => {
    const cell = document.createElement("span");
    cell.className = "preview-cell";
    if (highlightedCells.has(index)) cell.classList.add("is-highlighted");
    cell.textContent = value === 0 ? "" : String(value);
    previewBoard.append(cell);
  });
}

function startTimer() {
  window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    if (gameComplete) return;
    remainingSeconds -= 1;
    updateTimer();
    if (remainingSeconds === 0) {
      gameComplete = true;
      statusElement.textContent = "Time’s up";
      showMessage("Time’s up! Start a new puzzle to try again.", "error");
      window.clearInterval(timerId);
    }
  }, 1000);
}

function startNewGame() {
  const generated = generatePuzzle(difficultyElement.value);
  puzzle = generated.puzzle;
  solution = generated.solution;
  values = puzzle.map((row) => [...row]);
  notes = Array.from({ length: SIZE * SIZE }, () => new Set());
  selectedCell = -1;
  noteMode = false;
  remainingSeconds = DIFFICULTY_TIME_LIMITS[difficultyElement.value] * 60;
  gameComplete = false;
  hintsUsed = 0;
  hasStartedGame = true;
  homeContinueButton.hidden = false;
  statusElement.textContent = "In progress";
  notesButton.setAttribute("aria-pressed", "false");
  updateHintButton();
  updateTimer();
  showMessage("Every row, column & 3×3 box needs 1–9.");
  renderBoard();
  startTimer();
}

function showHome() {
  window.clearInterval(timerId);
  gameVisible = false;
  homeScreen.hidden = false;
  gameCard.hidden = true;
  selectHomeDifficulty(difficultyElement.value);
  homeContinueButton.hidden = !hasStartedGame;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showGame() {
  homeScreen.hidden = true;
  gameCard.hidden = false;
  gameVisible = true;
  if (hasStartedGame && !gameComplete && remainingSeconds > 0) startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startHomeGame() {
  difficultyElement.value = selectedHomeDifficulty;
  startNewGame();
  showGame();
}

function selectHomeDifficulty(difficulty) {
  selectedHomeDifficulty = difficulty;
  homeDifficultyButtons.forEach((button) => {
    const selected = button.dataset.homeDifficulty === difficulty;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function enterNumber(number) {
  if (gameComplete) return;
  if (selectedCell < 0) {
    showMessage("Choose an empty square first.");
    return;
  }

  const row = Math.floor(selectedCell / SIZE);
  const column = selectedCell % SIZE;
  if (puzzle[row][column] !== 0) {
    showMessage("That number is part of the puzzle. Choose an empty square.");
    return;
  }

  if (noteMode) {
    if (values[row][column] !== 0) {
      showMessage("Erase the number before adding notes.");
      return;
    }
    if (notes[selectedCell].has(number)) notes[selectedCell].delete(number);
    else notes[selectedCell].add(number);
    showMessage("Notes updated.");
  } else {
    notes[selectedCell].clear();
    values[row][column] = number;
    if (number !== solution[row][column]) {
      showMessage("Not quite yet — try another number or use a hint.", "error");
    } else {
      showMessage("Nice move!", "success");
    }
  }

  if (values.every((line, rowIndex) => line.every((value, columnIndex) => value === solution[rowIndex][columnIndex]))) {
    gameComplete = true;
    window.clearInterval(timerId);
    statusElement.textContent = "Puzzle complete";
    showMessage("Beautifully done! You solved the puzzle before time ran out.", "success");
  }
  renderBoard();
}

function eraseSelected() {
  if (gameComplete) return;
  if (selectedCell < 0) {
    showMessage("Choose a square to erase.");
    return;
  }
  const row = Math.floor(selectedCell / SIZE);
  const column = selectedCell % SIZE;
  if (puzzle[row][column] !== 0) {
    showMessage("Starting numbers can’t be erased.");
    return;
  }
  values[row][column] = 0;
  notes[selectedCell].clear();
  showMessage("Square cleared.");
  renderBoard();
}

function revealHint() {
  if (gameComplete) return;
  if (hintsUsed >= MAX_HINTS) {
    showMessage("You’ve used all 5 hints for this puzzle.");
    return;
  }
  const emptyCells = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (puzzle[row][column] === 0 && values[row][column] !== solution[row][column]) {
        emptyCells.push(row * SIZE + column);
      }
    }
  }
  if (emptyCells.length === 0) {
    showMessage("The puzzle is already complete!", "success");
    return;
  }
  let target = emptyCells.find((index) => index === selectedCell);
  if (target === undefined) target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  selectedCell = target;
  const row = Math.floor(target / SIZE);
  const column = target % SIZE;
  values[row][column] = solution[row][column];
  notes[target].clear();
  hintsUsed += 1;
  updateHintButton();
  if (values.every((line, rowIndex) => line.every((value, columnIndex) => value === solution[rowIndex][columnIndex]))) {
    gameComplete = true;
    window.clearInterval(timerId);
    statusElement.textContent = "Puzzle complete";
    showMessage("Beautifully done! You solved the puzzle before time ran out.", "success");
  } else {
    showMessage("A little nudge in the right direction.", "success");
  }
  renderBoard();
}

function checkPuzzle() {
  if (gameComplete) return;
  let emptyCount = 0;
  let incorrectCount = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (values[row][column] === 0) emptyCount += 1;
      else if (values[row][column] !== solution[row][column]) incorrectCount += 1;
    }
  }
  if (incorrectCount > 0) showMessage(`There ${incorrectCount === 1 ? "is" : "are"} ${incorrectCount} incorrect ${incorrectCount === 1 ? "number" : "numbers"} to revisit.`, "error");
  else if (emptyCount > 0) showMessage(`Looking good so far! ${emptyCount} ${emptyCount === 1 ? "square" : "squares"} left.`, "success");
  else {
    gameComplete = true;
    window.clearInterval(timerId);
    statusElement.textContent = "Puzzle complete";
    showMessage("Beautifully done! You solved the puzzle before time ran out.", "success");
  }
  renderBoard();
}

function moveSelection(rowDelta, columnDelta) {
  if (selectedCell < 0) selectedCell = 0;
  else {
    const row = Math.floor(selectedCell / SIZE);
    const column = selectedCell % SIZE;
    const nextRow = (row + rowDelta + SIZE) % SIZE;
    const nextColumn = (column + columnDelta + SIZE) % SIZE;
    selectedCell = nextRow * SIZE + nextColumn;
  }
  renderBoard();
  boardElement.children[selectedCell].focus();
}

document.querySelectorAll(".number-button").forEach((button) => {
  button.addEventListener("click", () => enterNumber(Number(button.dataset.number)));
});
notesButton.addEventListener("click", () => {
  noteMode = !noteMode;
  notesButton.setAttribute("aria-pressed", String(noteMode));
  showMessage(noteMode ? "Notes mode is on." : "Notes mode is off.");
});
document.querySelector("#erase-button").addEventListener("click", eraseSelected);
hintButton.addEventListener("click", revealHint);
document.querySelector("#check-button").addEventListener("click", checkPuzzle);
document.querySelector("#restart-button").addEventListener("click", () => {
  values = puzzle.map((row) => [...row]);
  notes = Array.from({ length: SIZE * SIZE }, () => new Set());
  selectedCell = -1;
  remainingSeconds = DIFFICULTY_TIME_LIMITS[difficultyElement.value] * 60;
  gameComplete = false;
  hintsUsed = 0;
  statusElement.textContent = "In progress";
  updateHintButton();
  updateTimer();
  showMessage("Puzzle restarted. Take your time.");
  renderBoard();
  startTimer();
});
document.querySelector("#new-game-button").addEventListener("click", startNewGame);
difficultyElement.addEventListener("change", startNewGame);
homeStartButton.addEventListener("click", startHomeGame);
homeContinueButton.addEventListener("click", showGame);
homeDifficultyButtons.forEach((button) => {
  button.addEventListener("click", () => selectHomeDifficulty(button.dataset.homeDifficulty));
});
homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});

document.addEventListener("keydown", (event) => {
  if (!gameVisible || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^[1-9]$/.test(event.key)) {
    enterNumber(Number(event.key));
  } else if (event.key === "Backspace" || event.key === "Delete") {
    eraseSelected();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1, 0);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1, 0);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveSelection(0, -1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveSelection(0, 1);
  }
});

renderPreviewBoard();
