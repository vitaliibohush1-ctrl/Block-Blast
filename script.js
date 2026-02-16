// ==========================================
// 1. КОНСТАНТИ, вводні змінні
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

// Налаштування гри
const settings = {
    music: true,
    sound: true,
    vibration: true
};

// Об'єкт зі звуками
const audioFiles = {
    pickup: new Audio('sounds/pickup.mp3'),
    place: new Audio('sounds/place.mp3'),
    combo1: new Audio('sounds/combo1.mp3'), // Зараз буде один для всіх
    loss: new Audio('sounds/loss.mp3'),      // Звук програшу 1
    gameOver: new Audio('sounds/gameover.mp3'), // Звук програшу 2
    open: new Audio('sounds/open.mp3'),
    close: new Audio('sounds/close.mp3'),
    click: new Audio('sounds/click.mp3')
};

const bgMusic = new Audio('sounds/bg-music.mp3');
bgMusic.loop = true;

// Стан гри
let score = 0;
let streakCount = 0;
let bestScore = localStorage.getItem('blockBlastBestScore') || 0;
let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let isDragging = false;
let mouseX = 0, mouseY = 0;

bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;

//  ВИДИ БЛОКІВ
const archetypes = {
    simple: [[[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1, 1], [1, 1]]],
    favorites: [
        [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
        [[1, 1, 1, 1, 1]],
        [[1], [1], [1], [1], [1]],
        [[1, 1, 1, 1]],
        [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
    ],
    challenging: [[[1, 1, 0], [0, 1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1], [1, 0]]]
};

// ==========================================
// 2. СТВОРЕННЯ БЛОКІВ (ГЕЕНРАЦІЯ)
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
                weight += lines * 600;
                if (weight > maxWeight) maxWeight = weight;
            }
        }
    }
    return maxWeight;
}

function generateValidNextBlocks() {
    const filled = grid.flat().filter(v => v !== 0).length;
    const fullness = filled / (rows * cols);
    const pool = [...archetypes.simple, ...archetypes.favorites, ...archetypes.favorites, ...archetypes.challenging];
    let candidates = [];
    for(let i = 0; i < 15; i++) {
        let s = pool[Math.floor(Math.random() * pool.length)];
        candidates.push({ shape: s, weight: evaluatePlacement(grid, s), color: blockColors[Math.floor(Math.random() * blockColors.length)] });
    }
    candidates.sort((a, b) => b.weight - a.weight);
    let selected = fullness < 0.55 ? candidates.slice(0, 3) : [candidates[0], candidates[5], candidates[8]];
    return selected.sort(() => Math.random() - 0.5).map(c => ({shape: c.shape, color: c.color}));
}

// ==========================================
// 3. ПРАВИЛА ГРИ (ЧИ МОЖНА ПОСТАВИТИ, ОЧИЩЕННЯ ЛІНІЙ, ОБРАХУНОК ОЧОК...)
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
    if (linesCleared === 1) lineBonus = 500;
    else if (linesCleared === 2) lineBonus = 1300;
    else if (linesCleared === 3) lineBonus = 3000;
    else if (linesCleared === 4) lineBonus = 4800;
    const multipliers = [1, 1.15, 2.35, 3.81, 5.14];
    return Math.floor((baseBlocks + lineBonus) * multipliers[Math.min(streakCount, 4)]);
}

function clearLines(placedShape) {
    let toClearRows = [], toClearCols = [];
    for (let r = 0; r < rows; r++) if (grid[r].every(cell => cell !== 0)) toClearRows.push(r);
    for (let c = 0; c < cols; c++) if (grid.every(r => r[c] !== 0)) toClearCols.push(c);

    const totalLines = toClearRows.length + toClearCols.length;

    if (totalLines > 0) {
        streakCount++;
        const pointsEarned = calculateScore(placedShape, totalLines);
        score += pointsEarned;

        // Відтворюємо звук комбо
        playSound('combo1')

        if (scoreDisplay) scoreDisplay.innerText = `Очки: ${score}`;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('blockBlastBestScore', bestScore);
            bestScoreDisplay.innerText = `Найкращий: ${bestScore}`;
        }
        if (settings.vibration && navigator.vibrate) navigator.vibrate(50);
    } else {
        streakCount = 0;
    }

    toClearRows.forEach(r => grid[r].fill(0));
    toClearCols.forEach(c => grid.forEach(r => r[c] = 0));
}

// Вспоміжні функції для симуляції
function canPlaceOnTemp(tGrid, shape, gx, gy) {
    return shape.every((row, r) => row.every((v, c) => {
        if (!v) return true;
        let ny = gy + r, nx = gx + c;
        return ny >= 0 && ny < rows && nx >= 0 && nx < cols && !tGrid[ny][nx];
    }));
}
function applyToTemp(tGrid, shape, gx, gy) {
    shape.forEach((row, r) => row.forEach((v, c) => { if (v) tGrid[gy + r][gx + c] = 1; }));
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
// 4. МАЛЮВАННЯ
// ==========================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    for(let i=0; i<=canvas.width; i+=gridSize) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke();
    }
    grid.forEach((row, r) => row.forEach((v, c) => {
        if (v) { ctx.fillStyle = v; ctx.fillRect(c * gridSize + 1, r * gridSize + 1, gridSize - 2, gridSize - 2); }
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
            b.shape.forEach((row, r) => row.forEach((v, c) => { if (v) bCtx.fillRect(c * s, r * s, s - 1, s - 1); }));
            slot.appendChild(canv);
        }
        nextBlocksDiv.appendChild(slot);
    });
}

// ==========================================
// 5.  Рухи ВЗЯТИ ТА ПОСТАВИТИ  (DRAG & DROP)
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
        playSound('pickup');
    }
};

const endDrag = () => {
    if (selectedBlock && isDragging) {
        const gx = Math.round((mouseX - (selectedBlock.shape[0].length * gridSize / 2)) / gridSize);
        const gy = Math.round((mouseY - dragOffsetY) / gridSize);

        if (canPlace(selectedBlock.shape, gx, gy)) {
            playSound('place');
            selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
                if (v) grid[gy + r][gx + c] = selectedBlock.color;
            }));
            clearLines(selectedBlock.shape);
            nextBlocks[selectedBlock.index] = null;
            if (nextBlocks.every(b => b === null)) nextBlocks = generateValidNextBlocks();
            renderNext();
            const rem = nextBlocks.filter(b => b !== null);
            if (rem.length > 0 && !rem.some(b => canPlaceAnywhere(b.shape))) setTimeout(handleGameOver, 100);
        } else {
            renderNext();
        }
    }
    selectedBlock = null; isDragging = false;
};

// ==========================================
// 6. МУЗИКА ТА ЗВУКИ
// ==========================================

// Грати звук (враховує налаштування)
function playSound(name) {
    if (settings.sound && audioFiles[name]) {
        audioFiles[name].currentTime = 0;
        audioFiles[name].play().catch(() => {});
    }
}
// Керування музикою
function toggleMusic() {
    if (settings.music) bgMusic.play().catch(() => {
        window.addEventListener('click', () => bgMusic.play(), { once: true });
    });
    else bgMusic.pause();
}

// Прив'язка до кнопок
document.getElementById('settings-btn').addEventListener('click', () => playSound('open'));
document.getElementById('close-settings').addEventListener('click', () => playSound('close'));
// виправлений баг з дабл звуком
document.querySelectorAll('button').forEach(btn => {
    // Додаємо перевірку: якщо це НЕ кнопка налаштувань, тоді грати 'click'
    if (btn.id !== 'settings-btn' && btn.id !== 'close-settings') {
        btn.addEventListener('click', () => playSound('click'));
    }
});
// ==========================================
// 7. МЕНЮ ТА НАЛАШТУВАННЯ
// ==========================================
const modal = document.getElementById('game-over-modal');
const restartBtn = document.getElementById('restart-btn');
const sModal = document.getElementById('settings-modal');

function handleGameOver() {
    playSound('loss'); // Граємо перший звук
    setTimeout(() => playSound('gameOver'), 600); // Другий звук через 0.6 сек

    document.getElementById('final-score').innerText = `Результат: ${score}`;
    modal.style.display = 'flex';
}


restartBtn.onclick = () => {
    grid = Array(rows).fill().map(() => Array(cols).fill(0));
    score = 0; streakCount = 0;
    scoreDisplay.innerText = 'Очки: 0';
    modal.style.display = 'none';
    nextBlocks = generateValidNextBlocks();
    renderNext();
};

document.getElementById('settings-btn').onclick = () => sModal.style.display = 'flex';
document.getElementById('close-settings').onclick = () => sModal.style.display = 'none';

document.getElementById('music-toggle').onchange = (e) => {
    settings.music = e.target.checked;
    toggleMusic();
};
document.getElementById('sound-toggle').onchange = (e) => settings.sound = e.target.checked;
document.getElementById('vibe-toggle').onchange = (e) => settings.vibration = e.target.checked;

document.getElementById('restart-from-settings').onclick = () => {
    sModal.style.display = 'none';
    restartBtn.click();
};

// ==========================================
// 8. ЗАПУСК
// ==========================================
window.addEventListener('mousemove', updateCoords);
window.addEventListener('touchmove', (e) => { if(isDragging) e.preventDefault(); updateCoords(e); }, {passive: false});
nextBlocksDiv.onmousedown = startDrag;
nextBlocksDiv.ontouchstart = startDrag;
window.onmouseup = endDrag;
window.ontouchend = endDrag;

toggleMusic(); // запуск музики 
nextBlocks = generateValidNextBlocks();
renderNext();
draw();
