// ==========================================
// 1. КОНФІГУРАЦІЯ
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const bestScoreDisplay = document.getElementById('best-score');
const nextBlocksDiv = document.getElementById('next-blocks');

const gridSize = 45;
const cols = 8;
const rows = 8;
canvas.width = gridSize * cols;
canvas.height = gridSize * rows;

const dragOffsetY = 250;
const blockColors = ['#FF073A', '#00FF7F', '#1E90FF', '#FFD700', '#FF4500', '#9400D3'];

let score = 0;
let streakCount = 0;
let bestScore = localStorage.getItem('blockBlastBestScore') || 0;
let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let isDragging = false;
let mouseX = 0, mouseY = 0;

bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;

// ==========================================
// 2. АРХЕТИПИ БЛОКІВ (ОНОВЛЕНО: Твої пріоритети)
// ==========================================
const archetypes = {
    simple: [
        [[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1, 1], [1, 1]]
    ],
    // Твої улюблені фігури: кути 3х3 та палиці 4х1, 5х1
    favorites: [
        [[1, 1, 1], [1, 0, 0], [1, 0, 0]], // Кут 3х3
        [[1, 1, 1, 1, 1]],                // Палиця 5х1
        [[1], [1], [1], [1], [1]],        // Палиця 1х5
        [[1, 1, 1, 1]],                   // Палиця 4х1
        [[1, 1, 1], [1, 1, 1], [1, 1, 1]] // Квадрат 3х3
    ],
    challenging: [
        [[1, 1, 0], [0, 1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1], [1, 0]]
    ]
};

// ==========================================
// 3. ГЕНЕРАЦІЯ (The Director: Пріоритет на фаворитів)
// ==========================================
function evaluatePlacement(tGrid, shape) {
    let maxWeight = -1000;
    for (let r = 0; r <= rows - shape.length; r++) {
        for (let c = 0; c <= cols - shape[0].length; c++) {
            if (canPlaceOnTemp(tGrid, shape, c, r)) {
                let weight = 0;
                let tempForEval = tGrid.map(row => [...row]);
                applyToTemp(tempForEval, shape, c, r);

                let lines = 0;
                for (let i = 0; i < rows; i++) if (tempForEval[i].every(cell => cell !== 0)) lines++;
                for (let i = 0; i < cols; i++) if (tempForEval.every(row => row[i] !== 0)) lines++;

                weight += lines * 600; // Пріоритет на очищення
                if (weight > maxWeight) maxWeight = weight;
            }
        }
    }
    return maxWeight;
}

function generateValidNextBlocks() {
    const filled = grid.flat().filter(v => v !== 0).length;
    const fullness = filled / (rows * cols);

    // Створюємо пул кандидатів, де твої улюблені фігури мають більше шансів з'явитися
    const pool = [
        ...archetypes.simple,
        ...archetypes.favorites, ...archetypes.favorites, // Подвійний шанс для фаворитів
        ...archetypes.challenging
    ];

    let candidates = [];
    for(let i = 0; i < 15; i++) {
        let s = pool[Math.floor(Math.random() * pool.length)];
        candidates.push({
            shape: s,
            weight: evaluatePlacement(grid, s),
            color: blockColors[Math.floor(Math.random() * blockColors.length)]
        });
    }

    // Сортуємо: найкращі ходи нагору
    candidates.sort((a, b) => b.weight - a.weight);

    let selected = [];
    // Якщо поле вільне більше ніж на половину — даємо дофамін (кращі фігури)
    if (fullness < 0.55) {
        selected = candidates.slice(0, 3);
    } else {
        // Якщо поле забите — даємо одну ідеальну і дві середні (без жесті)
        selected = [candidates[0], candidates[5], candidates[8]];
    }

    return selected.sort(() => Math.random() - 0.5).map(c => ({shape: c.shape, color: c.color}));
}

// ==========================================
// 4. ПРАВИЛА ГРИ
// ==========================================
function canPlace(shape, gx, gy) {
    return shape.every((row, r) => row.every((v, c) => {
        if (!v) return true;
        let ny = gy + r, nx = gx + c;
        return ny >= 0 && ny < rows && nx >= 0 && nx < cols && !grid[ny][nx];
    }));
}

function calculateScore(shape, linesCleared) {
    let blocksCount = shape.flat().filter(cell => cell === 1).length;
    let baseBlocks = blocksCount * (11 + Math.floor(Math.random() * 5));

    let lineBonus = 0;
    if (linesCleared === 1) lineBonus = 491 + Math.floor(Math.random() * 47);
    else if (linesCleared === 2) lineBonus = 1283 + Math.floor(Math.random() * 112);
    else if (linesCleared === 3) lineBonus = 2934 + Math.floor(Math.random() * 215);
    else if (linesCleared === 4) lineBonus = 4712 + Math.floor(Math.random() * 380);

    const multipliers = [1, 1.15, 2.35, 3.81, 5.14];
    let currentMult = multipliers[Math.min(streakCount, 4)];

    return Math.floor((baseBlocks + lineBonus) * currentMult);
}

function clearLines(placedShape) {
    let toClearRows = [], toClearCols = [];
    for (let r = 0; r < rows; r++) if (grid[r].every(cell => cell !== 0)) toClearRows.push(r);
    for (let c = 0; c < cols; c++) if (grid.every(r => r[c] !== 0)) toClearCols.push(c);

    const totalLines = toClearRows.length + toClearCols.length;

    if (totalLines > 0) {
        const pointsEarned = calculateScore(placedShape, totalLines);
        score += pointsEarned;
        streakCount++;

        if (scoreDisplay) scoreDisplay.innerText = `Очки: ${score}`;
        const sc = document.getElementById('score-container');
        if (sc) sc.innerText = score;

        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('blockBlastBestScore', bestScore);
            bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;
        }
    } else {
        streakCount = 0;
    }

    toClearRows.forEach(r => grid[r].fill(0));
    toClearCols.forEach(c => grid.forEach(r => r[c] = 0));
}

// ==========================================
// 5. СИМУЛЯЦІЯ
// ==========================================
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

function canPlaceAnywhere(shape) {
    for (let r = 0; r <= rows - shape.length; r++) {
        for (let c = 0; c <= cols - shape[0].length; c++) {
            if (canPlaceOnTemp(grid, shape, c, r)) return true;
        }
    }
    return false;
}

// ==========================================
// 6. МАЛЮВАННЯ (Без змін)
// ==========================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    for(let i=0; i<=canvas.width; i+=gridSize) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke();
    }
    grid.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
            ctx.fillStyle = v;
            ctx.fillRect(c * gridSize + 1, r * gridSize + 1, gridSize - 2, gridSize - 2);
        }
    }));
    if (selectedBlock && isDragging) {
        const gx = Math.round((mouseX - (selectedBlock.shape[0].length * gridSize / 2)) / gridSize);
        const gy = Math.round((mouseY - dragOffsetY) / gridSize);
        if (canPlace(selectedBlock.shape, gx, gy)) {
            ctx.globalAlpha = 0.3; ctx.fillStyle = selectedBlock.color;
            selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) ctx.fillRect((gx + c) * gridSize + 1, (gy + r) * gridSize + 1, gridSize - 2, gridSize - 2);
            }));
        }
        ctx.globalAlpha = 1.0; ctx.fillStyle = selectedBlock.color;
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
        const slot = document.createElement('div');
        if (b !== null) {
            const canv = document.createElement('canvas');
            canv.width = 90; canv.height = 90; canv.dataset.index = i;
            const bCtx = canv.getContext('2d');
            const s = 18; bCtx.fillStyle = b.color;
            b.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) bCtx.fillRect(c * s, r * s, s - 1, s - 1);
            }));
            slot.appendChild(canv);
        }
        nextBlocksDiv.appendChild(slot);
    });
}

// ==========================================
// 7. DRAG & DROP (Без змін)
// ==========================================
function updateCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    mouseX = clientX - rect.left;
    mouseY = clientY - rect.top;
}

const startDrag = (e) => {
    if (e.target.tagName === 'CANVAS') {
        const i = parseInt(e.target.dataset.index);
        selectedBlock = {...nextBlocks[i], index: i};
        isDragging = true;
        e.target.style.visibility = 'hidden';
        updateCoords(e);
    }
};

const endDrag = () => {
    if (selectedBlock && isDragging) {
        const gx = Math.round((mouseX - (selectedBlock.shape[0].length * gridSize / 2)) / gridSize);
        const gy = Math.round((mouseY - dragOffsetY) / gridSize);
        if (canPlace(selectedBlock.shape, gx, gy)) {
            selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) grid[gy + r][gx + c] = selectedBlock.color;
            }));
            clearLines(selectedBlock.shape);
            nextBlocks[selectedBlock.index] = null;
            if (nextBlocks.every(b => b === null)) nextBlocks = generateValidNextBlocks();
            renderNext();
            const rem = nextBlocks.filter(b => b !== null);
            if (rem.length > 0 && !rem.some(b => canPlaceAnywhere(b.shape))) setTimeout(handleGameOver, 100);
        } else { renderNext(); }
    }
    selectedBlock = null; isDragging = false;
};

// ==========================================
// 8. МЕНЮ (Без змін)
// ==========================================
const modal = document.getElementById('game-over-modal');
const restartBtn = document.getElementById('restart-btn');

function handleGameOver() {
    document.getElementById('final-score').innerText = `Результат: ${score}`;
    modal.style.display = 'flex';
}

restartBtn.onclick = () => {
    grid = Array(rows).fill().map(() => Array(cols).fill(0));
    score = 0;
    streakCount = 0;
    scoreDisplay.innerText = 'Очки: 0';
    const sc = document.getElementById('score-container');
    if (sc) sc.innerText = '0';
    modal.style.display = 'none';
    nextBlocks = generateValidNextBlocks();
    renderNext();
};

window.addEventListener('mousemove', updateCoords);
window.addEventListener('touchmove', (e) => { if(isDragging) e.preventDefault(); updateCoords(e); }, {passive: false});
nextBlocksDiv.onmousedown = startDrag;
nextBlocksDiv.ontouchstart = startDrag;
window.onmouseup = endDrag;
window.ontouchend = endDrag;

nextBlocks = generateValidNextBlocks();
renderNext();
draw();
