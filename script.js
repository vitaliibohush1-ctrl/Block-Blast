const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const bestScoreDisplay = document.getElementById('best-score');
const nextBlocksDiv = document.getElementById('next-blocks');

const gridSize = 40;
const cols = 8;
const rows = 8;
let score = 0;
let bestScore = localStorage.getItem('blockBlastBestScore') || 0;
bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;

const blockColors = ['#FF073A', '#00FF7F', '#1E90FF', '#FFD700', '#FF4500', '#9400D3'];


// ОСНОВНІ БЛОКИ (Великі та складні)
const primaryShapes = [
    [[1, 1], [1, 1]], // Квадрат 2x2
    [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]], // Лінії 5
    [[1, 1, 1, 1]], [[1], [1], [1], [1]], // Лінії 4
    [[1, 1], [1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1]], // Прямокутники
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]], // Квадрат 3x3

    // Пірамідки
    [[1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 1], [1, 0]], [[0, 1], [1, 1], [0, 1]],

    // Великі кути 3x3
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]], [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
    [[1, 1, 1], [1, 0, 0], [1, 0, 0]], [[1, 1, 1], [0, 0, 1], [0, 0, 1]],

    // Змійки
    [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
    [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]]
];

// СПЕЦІАЛЬНІ БЛОКИ (Рятувальні, для виходу з тупика)
const specialShapes = [
    [[1]], // Крапка 1x1
    [[1, 1]], [[1], [1]], // Дует 2x1
    [[1, 1], [1, 0]], [[1, 1], [0, 1]], // Малі кутики
    [[1, 0], [1, 1]], [[0, 1], [1, 1]]
];



let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let isDragging = false;
let mouseX = 0, mouseY = 0;

// Офсет, щоб блок був над пальцем
const dragOffsetY = 100;

function updateCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    mouseX = clientX - rect.left;
    mouseY = clientY - rect.top;
}

function canPlace(shape, gx, gy) {
    return shape.every((row, r) => row.every((v, c) => {
        if (!v) return true;
        let ny = gy + r, nx = gx + c;
        return ny >= 0 && ny < rows && nx >= 0 && nx < cols && !grid[ny][nx];
    }));
}

function clearLines() {
    let toClearRows = [], toClearCols = [];
    for (let r = 0; r < rows; r++) if (grid[r].every(cell => cell !== 0)) toClearRows.push(r);
    for (let c = 0; c < cols; c++) if (grid.every(r => r[c] !== 0)) toClearCols.push(c);

    toClearRows.forEach(r => grid[r].fill(0));
    toClearCols.forEach(c => grid.forEach(r => r[c] = 0));

    if (toClearRows.length || toClearCols.length) {
        score += (toClearRows.length + toClearCols.length) * 10;
        scoreDisplay.innerText = `Очки: ${score}`;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('blockBlastBestScore', bestScore);
            bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Сітка
    ctx.strokeStyle = '#333';
    for(let i=0; i<=canvas.width; i+=gridSize) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke();
    }

    // Зайняті клітинки
    grid.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
            ctx.fillStyle = v;
            ctx.fillRect(c * gridSize + 1, r * gridSize + 1, gridSize - 2, gridSize - 2);
        }
    }));

    if (selectedBlock && isDragging) {
        // Розрахунок позиції на сітці для "привида"
        const gx = Math.round((mouseX - (selectedBlock.shape[0].length * gridSize / 2)) / gridSize);
        const gy = Math.round((mouseY - dragOffsetY) / gridSize);

        // 1. Малюємо напівпрозорий Ghost
        if (canPlace(selectedBlock.shape, gx, gy)) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = selectedBlock.color;
            selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) ctx.fillRect((gx + c) * gridSize + 1, (gy + r) * gridSize + 1, gridSize - 2, gridSize - 2);
            }));
        }

        // 2. Малюємо блок, який тягнемо (над пальцем)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = selectedBlock.color;
        selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) {
                const px = mouseX - (selectedBlock.shape[0].length * gridSize / 2) + (c * gridSize);
                const py = mouseY - dragOffsetY + (r * gridSize);
                ctx.fillRect(px, py, gridSize - 2, gridSize - 2);
            }
        }));
    }
    requestAnimationFrame(draw);
}

function renderNext() {
    nextBlocksDiv.innerHTML = '';
    nextBlocks.forEach((b, i) => {
        const canv = document.createElement('canvas');
        canv.width = 100; canv.height = 100; canv.dataset.index = i;
        canv.style.cursor = 'grab';
        const bCtx = canv.getContext('2d');
        const s = 20; bCtx.fillStyle = b.color;
        b.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) bCtx.fillRect(c * s, r * s, s - 1, s - 1);
        }));
        nextBlocksDiv.appendChild(canv);
    });
}

// Початок перетягування
const startDrag = (e) => {
    if (e.target.tagName === 'CANVAS') {
        const i = parseInt(e.target.dataset.index);
        selectedBlock = {...nextBlocks[i], index: i};
        isDragging = true;
        e.target.style.visibility = 'hidden'; // Ховаємо в меню
        updateCoords(e);
    }
};

// Завершення перетягування
const endDrag = () => {
    if (selectedBlock && isDragging) {
        const gx = Math.round((mouseX - (selectedBlock.shape[0].length * gridSize / 2)) / gridSize);
        const gy = Math.round((mouseY - dragOffsetY) / gridSize);

        if (canPlace(selectedBlock.shape, gx, gy)) {
            selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) grid[gy + r][gx + c] = selectedBlock.color;
            }));
            clearLines();
            nextBlocks.splice(selectedBlock.index, 1);
            if (nextBlocks.length === 0) nextBlocks = generateValidNextBlocks();
            renderNext();
            if (!nextBlocks.some(b => canPlaceAnywhere(b.shape))) setTimeout(handleGameOver, 100);
        } else {
            renderNext(); // Повертаємо блок у меню, якщо не поставили
        }
    }
    selectedBlock = null;
    isDragging = false;
};

// Події
window.addEventListener('mousemove', updateCoords);
window.addEventListener('touchmove', (e) => {
    if(isDragging) e.preventDefault();
    updateCoords(e);
}, {passive: false});

nextBlocksDiv.addEventListener('mousedown', startDrag);
nextBlocksDiv.addEventListener('touchstart', startDrag, {passive: true});

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

// --- Решта твоїх допоміжних функцій (generateValidNextBlocks, restart і т.д.) залишаються без змін ---
function canPlaceAnywhere(shape) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (canPlace(shape, c, r)) return true;
        }
    }
    return false;
}

// ГЕНЕРУЄМО НОВІ БЛОКИ
function generateValidNextBlocks() {
    let attempts = 0;

    // Спроба 1: Тільки складні основні блоки
    while (attempts < 300) {
        let candidate = Array(3).fill().map(() => getRandomBlock(primaryShapes));
        if (canSolve(grid, candidate)) return candidate;
        attempts++;
    }

    // Спроба 2: Якщо не лізуть, додаємо 1-2 маленьких "спецблока"
    while (attempts < 600) {
        let candidate = [
            getRandomBlock(primaryShapes),
            getRandomBlock(specialShapes),
            getRandomBlock(Math.random() > 0.5 ? primaryShapes : specialShapes)
        ];
        if (canSolve(grid, candidate)) return candidate;
        attempts++;
    }

    // Спроба 3: Повний рятувальний режим (тільки маленькі блоки)
    return Array(3).fill().map(() => getRandomBlock(specialShapes));
}

// Допоміжна функція для вибору випадкового блоку з кольором
function getRandomBlock(shapesArray) {
    const randomIndex = Math.floor(Math.random() * shapesArray.length);
    return {
        shape: shapesArray[randomIndex],
        color: blockColors[Math.floor(Math.random() * blockColors.length)]
    };
}

// cansolve і canplaysment on 2 функції які допомагають з підбором 3 блоків

function canSolve(currentGrid, blocksLeft) {
    if (blocksLeft.length === 0) return true;

    for (let i = 0; i < blocksLeft.length; i++) {
        const block = blocksLeft[i];
        const remaining = blocksLeft.filter((_, idx) => idx !== i);

        // Перевіряємо кожну клітинку для поточного блоку
        for (let r = 0; r <= rows - block.shape.length; r++) {
            for (let c = 0; c <= cols - block.shape[0].length; c++) {
                if (canPlaceOnTemp(currentGrid, block.shape, c, r)) {
                    // Копіюємо сітку та симулюємо встановлення + очищення
                    let tempGrid = currentGrid.map(row => [...row]);
                    applyToTemp(tempGrid, block.shape, c, r);
                    clearTempLines(tempGrid);

                    // Йдемо глибше в рекурсію
                    if (canSolve(tempGrid, remaining)) return true;
                }
            }
        }
    }
    return false;
}

function canPlaceOnTemp(tGrid, shape, gx, gy) {
    return shape.every((row, r) => row.every((v, c) => {
        if (!v) return true;
        let ny = gy + r, nx = gx + c;
        return ny >= 0 && ny < rows && nx >= 0 && nx < cols && !tGrid[ny][nx];
    }));
}

function applyToTemp(tGrid, shape, gx, gy) {
    shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) tGrid[gy + r][gx + c] = 1;
    }));
}

function clearTempLines(tGrid) {
    let toClearRows = [], toClearCols = [];
    for (let r = 0; r < rows; r++) if (tGrid[r].every(cell => cell !== 0)) toClearRows.push(r);
    for (let c = 0; c < cols; c++) if (tGrid.every(r => r[c] !== 0)) toClearCols.push(c);
    toClearRows.forEach(r => tGrid[r].fill(0));
    toClearCols.forEach(c => tGrid.forEach(r => r[c] = 0));
}


const modal = document.getElementById('game-over-modal');
const finalScoreText = document.getElementById('final-score');
const finalBestText = document.getElementById('final-best');
const restartBtn = document.getElementById('restart-btn');

function handleGameOver() {
    finalScoreText.innerText = `Твій результат: ${score}`;
    finalBestText.innerText = `Найкращий: ${bestScore}`;
    modal.style.display = 'flex';
}

function restartGame() {
    grid = Array(rows).fill().map(() => Array(cols).fill(0));
    score = 0;
    scoreDisplay.innerText = `Очки: ${score}`;
    modal.style.display = 'none';
    nextBlocks = generateValidNextBlocks();
    renderNext();
}

restartBtn.addEventListener('click', restartGame);
nextBlocks = generateValidNextBlocks();
renderNext();
draw();
