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
  [[1, 1], [1, 1]], // 0: Квадрат 2х2
  [[1, 1, 1]],      // 1: 1х3
  [[1], [1], [1]],  // 2: 3х1
  [[1, 1], [0, 1]], // 3: Кутик
  [[1, 0], [1, 1]], // 4: Кутик
  [[1, 1, 1], [0, 1, 0]], // 5: Т-подібний
  [[1, 1, 1], [1, 1, 1], [1, 1, 1]], // 6: Квадрат 3х3
  [[1, 1, 1, 1, 1]], // 7: 1х5
  [[1], [1], [1], [1], [1]], // 8: 5х1
  [[1, 1, 1, 1]],    // 9: 1х4
  [[1], [1], [1], [1]],      // 10: 4х1
  [[1, 1], [1, 1], [1, 1]],  // 11: 2х3
  [[1, 1, 1], [1, 1, 1]]     // 12: 3х2
];

let grid = Array(rows).fill().map(() => Array(cols).fill(0));
let nextBlocks = [];
let selectedBlock = null;
let offsetX = 50, offsetY = 50, mouseX = 0, mouseY = 0;

// Універсальна функція отримання координат
function updateCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    mouseX = clientX - rect.left;
    mouseY = clientY - rect.top;
}

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

    // Рахуємо вільні клітинки на полі
    let emptyCells = 0;
    grid.forEach(row => row.forEach(cell => { if(cell === 0) emptyCells++; }));

    while (attempts < 200) {
        newBlocks = Array(3).fill().map(() => {
            let randomIndex = Math.floor(Math.random() * blockShapes.length);

            // Якщо місця мало (менше 25 клітинок), прибираємо блоки 3х3 та 1х5
            if (emptyCells < 25 && (randomIndex === 6 || randomIndex === 7 || randomIndex === 8)) {
                randomIndex = Math.floor(Math.random() * 6);
            }

            return { shape: blockShapes[randomIndex], color: blockColors[randomIndex % blockColors.length] };
        });

        // Перевірка: чи можна поставити хоча б 2 з 3 нових фігур
        let playableCount = newBlocks.filter(b => canPlaceAnywhere(b.shape)).length;
        if (playableCount >= 2) return newBlocks;
        attempts++;
    }
    return newBlocks;
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

    if (selectedBlock) {
        const gx = Math.round((mouseX - offsetX) / gridSize);
        const gy = Math.round((mouseY - offsetY) / gridSize);
        const valid = canPlace(selectedBlock.shape, gx, gy);

        ctx.globalAlpha = valid ? 0.6 : 0.2;
        ctx.fillStyle = selectedBlock.color;
        selectedBlock.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) {
                let px = (gx + c) * gridSize, py = (gy + r) * gridSize;
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

// Нові змінні для модального вікна
const modal = document.getElementById('game-over-modal');
const finalScoreText = document.getElementById('final-score');
const finalBestText = document.getElementById('final-best');
const restartBtn = document.getElementById('restart-btn');

function handleGameOver() {
    // Замість alert показуємо модалку
    finalScoreText.innerText = `Твій результат: ${score}`;
    finalBestText.innerText = `Найкращий: ${bestScore}`;
    modal.style.display = 'flex';
}

function restartGame() {
    // Скидання гри, як було в оригіналі
    grid = Array(rows).fill().map(() => Array(cols).fill(0));
    score = 0;
    scoreDisplay.innerText = `Очки: ${score}`;

    // Ховаємо модалку
    modal.style.display = 'none';

    // Нові блоки
    nextBlocks = generateValidNextBlocks();
    renderNext();
}

// Слухаємо натискання на кнопку рестарту
restartBtn.addEventListener('click', restartGame);
restartBtn.addEventListener('touchstart', (e) => { e.preventDefault(); restartGame(); });

// Події для Canvas (Миша + Тач)
const handleAction = () => {
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
            if (!nextBlocks.some(b => canPlaceAnywhere(b.shape))) setTimeout(handleGameOver, 100);
        }
    }
};

canvas.addEventListener('mousemove', updateCoords);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); updateCoords(e); }, {passive: false});

canvas.addEventListener('mousedown', handleAction);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); updateCoords(e); handleAction(); }, {passive: false});

// Вибір блоків
const selectBlock = (e) => {
    if (e.target.tagName === 'CANVAS') {
        const i = parseInt(e.target.dataset.index);
        selectedBlock = {...nextBlocks[i], index: i};
    }
};

nextBlocksDiv.addEventListener('mousedown', selectBlock);
nextBlocksDiv.addEventListener('touchstart', (e) => { selectBlock(e); }, {passive: true});

// Старт
nextBlocks = generateValidNextBlocks();
renderNext();
draw();
