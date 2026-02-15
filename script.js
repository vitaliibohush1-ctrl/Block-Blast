const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const bestScoreDisplay = document.getElementById('best-score');
const nextBlocksDiv = document.getElementById('next-blocks');

const gridSize = 40;
const cols = 8; // Розмір 8 на 8
const rows = 8;
let score = 0;
let bestScore = localStorage.getItem('blockBlastBestScore') || 0;
bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;

const blockColors = ['#FF073A', '#00FF7F', '#1E90FF', '#FFD700', '#FF4500', '#9400D3'];
const blockShapes = [
    [[1, 1], [1, 1]], [[1, 1, 1]], [[1], [1], [1]],
    [[1, 1], [0, 1]], [[1, 0], [1, 1]], [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
];

let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let offsetX, offsetY, mouseX = 0, mouseY = 0;

// Функція перевірки, чи можна поставити фігуру хоча б кудись
function canPlaceAnywhere(shape) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (canPlace(shape, c, r)) return true;
        }
    }
    return false;
}

// ГАРАНТОВАНА комбінація: хоча б один блок з трьох має підходити
function generateValidNextBlocks() {
    let newBlocks;
    let attempts = 0;

    while (attempts < 100) {
        newBlocks = Array(3).fill().map(() => {
            const i = Math.floor(Math.random() * blockShapes.length);
            return { shape: blockShapes[i], color: blockColors[i % blockColors.length] };
        });

        // Перевіряємо, чи є хоча б один можливий хід для будь-якої з нових фігур
        if (newBlocks.some(b => canPlaceAnywhere(b.shape))) {
            return newBlocks;
        }
        attempts++;
    }
    return newBlocks; // Якщо за 100 спроб не знайшли (майже неможливо), повертаємо що є
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

    // Фон сітки
    ctx.strokeStyle = '#ddd';
    for(let i=0; i<=canvas.width; i+=gridSize) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke();
    }

    // Блоки на полі
    grid.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
            ctx.fillStyle = v;
            ctx.fillRect(c * gridSize + 1, r * gridSize + 1, gridSize - 2, gridSize - 2);
        }
    }));

    // Фігурка під курсором (впирання/блокування)
    if (selectedBlock) {
        const gx = Math.round((mouseX - offsetX) / gridSize);
        const gy = Math.round((mouseY - offsetY) / gridSize);

        const valid = canPlace(selectedBlock.shape, gx, gy);

        ctx.globalAlpha = valid ? 0.6 : 0.2; // Якщо не можна поставити — вона майже прозора
        ctx.fillStyle = selectedBlock.color;

        selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) {
                let px = (gx + c) * gridSize;
                let py = (gy + r) * gridSize;
                // Малюємо тільки в межах поля
                if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                    ctx.fillRect(px + 1, py + 1, gridSize - 2, gridSize - 2);
                }
            }
        }));
        ctx.globalAlpha = 1.0;
    }
    requestAnimationFrame(draw);
}

function renderNext() {
    nextBlocksDiv.innerHTML = '';
    nextBlocks.forEach((b, i) => {
        const canv = document.createElement('canvas');
        canv.width = 100; canv.height = 100; canv.dataset.index = i;
        const bCtx = canv.getContext('2d');
        const s = 20; bCtx.fillStyle = b.color;
        b.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) bCtx.fillRect(c * s, r * s, s - 1, s - 1);
        }));
        nextBlocksDiv.appendChild(canv);
    });
}

function handleGameOver() {
    alert(`Гру закінчено!\nВаш результат: ${score}\nНайкращий результат: ${bestScore}`);
    grid = Array(rows).fill().map(() => Array(cols).fill(0));
    score = 0;
    scoreDisplay.innerText = `Очки: ${score}`;
    nextBlocks = generateValidNextBlocks();
    renderNext();
}

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => {
    if (selectedBlock) {
        const gx = Math.round((mouseX - offsetX) / gridSize);
        const gy = Math.round((mouseY - offsetY) / gridSize);

        if (canPlace(selectedBlock.shape, gx, gy)) {
            selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) grid[gy + r][gx + c] = selectedBlock.color;
            }));
            clearLines();
            nextBlocks.splice(selectedBlock.index, 1);
            if (nextBlocks.length === 0) nextBlocks = generateValidNextBlocks();
            selectedBlock = null;
            renderNext();

            // Перевірка на програш після кожного ходу
            if (!nextBlocks.some(b => canPlaceAnywhere(b.shape))) {
                setTimeout(handleGameOver, 100);
            }
        }
    }
});

nextBlocksDiv.addEventListener('mousedown', e => {
    if (e.target.tagName === 'CANVAS') {
        const i = parseInt(e.target.dataset.index);
        selectedBlock = {...nextBlocks[i], index: i};
        offsetX = 50; offsetY = 50;
    }
});

// Старт гри
nextBlocks = generateValidNextBlocks();
renderNext();
draw();
