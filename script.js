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
let bestScore = localStorage.getItem('blockBlastBestScore') || 0;
let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let isDragging = false;
let mouseX = 0, mouseY = 0;

bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;

// ==========================================
// 2. АРХЕТИПИ БЛОКІВ
// ==========================================
const archetypes = {
    builders: [[[1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 0]]],
    hooks: [[[1, 1, 0], [0, 1, 1]], [[1, 1, 1], [1, 0, 0]]],
    saviors: [[[1]], [[1, 1]], [[1], [1]], [[1, 1], [1, 0]]],
    bombs: [
        [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]],
        [[1, 1, 1, 1]], [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
        [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
    ]
};

// ==========================================
// 3. ГЕНЕРАЦІЯ
// ==========================================
function getRandomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateValidNextBlocks() {
    const filled = grid.flat().filter(v => v !== 0).length;
    const fullness = filled / (rows * cols);
    let shapes = [];

    if (fullness < 0.4) {
        shapes = [getRandomFrom(archetypes.bombs), getRandomFrom(archetypes.bombs), getRandomFrom(archetypes.builders)];
    } else if (fullness > 0.8) {
        shapes = [getRandomFrom(archetypes.saviors), getRandomFrom(archetypes.saviors), getRandomFrom(archetypes.saviors)];
    } else {
        shapes = [getRandomFrom(archetypes.builders), getRandomFrom(archetypes.hooks), getRandomFrom(archetypes.bombs)];
    }

    let candidate = shapes.map(s => ({
        shape: s,
        color: blockColors[Math.floor(Math.random() * blockColors.length)]
    }));

    return canSolve(grid, candidate) ? candidate : Array(3).fill().map(() => ({
        shape: getRandomFrom(archetypes.saviors),
        color: blockColors[Math.floor(Math.random() * blockColors.length)]
    }));
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

// ==========================================
// 5. СИМУЛЯЦІЯ
// ==========================================
function canSolve(currentGrid, blocksLeft) {
    const activeBlocks = blocksLeft.filter(b => b !== null);
    if (activeBlocks.length === 0) return true;

    const block = activeBlocks[0];
    const remaining = activeBlocks.slice(1);

    for (let r = 0; r <= rows - block.shape.length; r++) {
        for (let c = 0; c <= cols - block.shape[0].length; c++) {
            if (canPlaceOnTemp(currentGrid, block.shape, c, r)) {
                let tempGrid = currentGrid.map(row => [...row]);
                applyToTemp(tempGrid, block.shape, c, r);
                if (canSolve(tempGrid, remaining)) return true;
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

// ==========================================
// 6. МАЛЮВАННЯ
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
// 7. DRAG & DROP
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
            clearLines();
            nextBlocks[selectedBlock.index] = null;
            if (nextBlocks.every(b => b === null)) nextBlocks = generateValidNextBlocks();
            renderNext();
            const rem = nextBlocks.filter(b => b !== null);
            if (rem.length > 0 && !rem.some(b => canPlaceAnywhere(b.shape))) setTimeout(handleGameOver, 100);
        } else { renderNext(); }
    }
    selectedBlock = null; isDragging = false;
};

function canPlaceAnywhere(shape) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (canPlace(shape, c, r)) return true;
    return false;
}

// ==========================================
// 8. МЕНЮ
// ==========================================
const modal = document.getElementById('game-over-modal');
const restartBtn = document.getElementById('restart-btn');

function handleGameOver() {
    document.getElementById('final-score').innerText = `Результат: ${score}`;
    modal.style.display = 'flex';
}

restartBtn.onclick = () => {
    grid = Array(rows).fill().map(() => Array(cols).fill(0));
    score = 0; scoreDisplay.innerText = 'Очки: 0';
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
