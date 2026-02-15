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
const blockShapes = [
    [[1, 1], [1, 1]], [[1, 1, 1]], [[1], [1], [1]], [[1, 1], [0, 1]],
    [[1, 0], [1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]], [[1, 1, 1, 1]], [[1], [1], [1], [1]],
    [[1, 1], [1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1]]
];

let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let isDragging = false;
let mouseX = 0, mouseY = 0;

// Офсет, щоб блок був над пальцем
const dragOffsetY = 60;

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

function generateValidNextBlocks() {
    let newBlocks;
    let attempts = 0;
    let emptyCells = 0;
    grid.forEach(row => row.forEach(cell => { if(cell === 0) emptyCells++; }));

    while (attempts < 200) {
        newBlocks = Array(3).fill().map(() => {
            let randomIndex = Math.floor(Math.random() * blockShapes.length);
            if (emptyCells < 25 && (randomIndex === 6 || randomIndex === 7 || randomIndex === 8)) {
                randomIndex = Math.floor(Math.random() * 6);
            }
            return { shape: blockShapes[randomIndex], color: blockColors[randomIndex % blockColors.length] };
        });
        if (newBlocks.filter(b => canPlaceAnywhere(b.shape)).length >= 2) return newBlocks;
        attempts++;
    }
    return newBlocks;
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
