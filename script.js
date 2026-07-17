const segments = [
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "PACHINKO", type: "bonus", color: "#ff00ff" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "COIN FLIP", type: "bonus", color: "#ff4500" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "10", type: "number", val: 10, color: "#4b0082" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "CASH HUNT", type: "bonus", color: "#00ff66" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "COIN FLIP", type: "bonus", color: "#ff4500" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "10", type: "number", val: 10, color: "#4b0082" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "PACHINKO", type: "bonus", color: "#ff00ff" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "COIN FLIP", type: "bonus", color: "#ff4500" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "10", type: "number", val: 10, color: "#4b0082" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "CASH HUNT", type: "bonus", color: "#00ff66" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "COIN FLIP", type: "bonus", color: "#ff4500" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "5", type: "number", val: 5, color: "#ff007f" },
    { name: "2", type: "number", val: 2, color: "#ffd700" },
    { name: "10", type: "number", val: 10, color: "#4b0082" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "CRAZY TIME", type: "bonus", color: "#ff0055" },
    { name: "1", type: "number", val: 1, color: "#00bfff" },
    { name: "2", type: "number", val: 2, color: "#ffd700" }
];

let balance = 100000; 
let activeChipValue = 25; 

let bets = {
    "1": 0, "2": 0, "5": 0, "10": 0,
    "COIN FLIP": 0, "CASH HUNT": 0, "PACHINKO": 0, "CRAZY TIME": 0
};
let previousBets = null; 

let currentRotation = 0;
let isSpinning = false;

function initGame() {
    generateWheelSlices();
    setupBetButtons();
    setupControlButtons();
    setupChipSelector();
    updateUI();
}

function generateWheelSlices() {
    const wheel = document.getElementById("wheel");
    if (!wheel) return;
    
    const center = wheel.querySelector(".wheel-center");
    wheel.innerHTML = "";  
    
    const numSlices = segments.length;
    const anglePerSlice = 360 / numSlices;  

    segments.forEach((seg, index) => {
        const slice = document.createElement("div");
        slice.className = "slice";
        slice.setAttribute("data-index", index);
        slice.setAttribute("data-name", seg.name);
        slice.setAttribute("data-type", seg.type);
        slice.setAttribute("data-val", seg.val || 0);
        
        const rotation = (anglePerSlice * index);
        slice.style.transform = `rotate(${rotation}deg)`;
        slice.style.backgroundColor = seg.color;

        const textWrapper = document.createElement("div");
        textWrapper.className = "slice-text";
        textWrapper.textContent = seg.name;

        slice.appendChild(textWrapper);
        wheel.appendChild(slice);
    });

    if (center) wheel.appendChild(center);
}

function setupChipSelector() {
    const chips = document.querySelectorAll(".selector-chip");
    chips.forEach(chip => {
        chip.onclick = () => {
            if (isSpinning) return;
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            activeChipValue = parseInt(chip.getAttribute("data-value"));
        };
    });
}

function setupBetButtons() {
    const buttons = document.querySelectorAll(".bet-btn");
    buttons.forEach(btn => {
        btn.onclick = () => {
            if (isSpinning) return;
            const target = btn.getAttribute("data-target");
            const betCost = activeChipValue; 
            
            if (balance >= betCost) {
                balance -= betCost;
                bets[target] += betCost;
                updateUI();
            } else {
                document.getElementById('display-message').textContent = "❌ ¡Saldo insuficiente para esta ficha!";
            }
        };
    });
}

function setupControlButtons() {
    const spinBtn = document.getElementById("spin-btn");
    const clearBtn = document.getElementById("clear-btn");
    const repeatBtn = document.getElementById("repeat-btn");

    if (spinBtn) {
        spinBtn.onclick = () => {
            spinWheel();
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            clearBets();
        };
    }

    if (repeatBtn) {
        repeatBtn.onclick = () => {
            repeatLastBet();
        };
    }
}

function updateUI() {
    document.getElementById('balance').textContent = balance;
    
    let totalBet = 0;
    for (let key in bets) {
        totalBet += bets[key];
        let elementId = "";
        if (key === "COIN FLIP") elementId = "chip-coin";
        else if (key === "CASH HUNT") elementId = "chip-cash";
        else if (key === "PACHINKO") elementId = "chip-pachinko";
        else if (key === "CRAZY TIME") elementId = "chip-crazy";
        else elementId = `chip-${key}`;

        const chip = document.getElementById(elementId);
        if (chip) {
            chip.textContent = bets[key] > 0 ? `$${bets[key]}` : "$0";
        }
    }
    document.getElementById('total-bet').textContent = totalBet;
}

function clearBets() {
    if (isSpinning) return;
    for (let key in bets) {
        balance += bets[key];
        bets[key] = 0;
    }
    updateUI();
}

function repeatLastBet() {
    if (isSpinning) return;
    
    if (!previousBets) {
        document.getElementById('display-message').textContent = "⚠️ No hay ninguna apuesta anterior guardada.";
        return;
    }

    let totalCost = 0;
    for (let key in previousBets) {
        totalCost += previousBets[key];
    }

    if (totalCost === 0) {
        document.getElementById('display-message').textContent = "⚠️ La apuesta anterior estaba vacía.";
        return;
    }

    clearBets();

    if (balance >= totalCost) {
        balance -= totalCost;
        bets = { ...previousBets };
        updateUI();
        document.getElementById('display-message').textContent = "✅ ¡Apuesta anterior repetida!";
    } else {
        document.getElementById('display-message').textContent = "❌ ¡Saldo insuficiente para repetir esta apuesta!";
    }
}

function spinWheel() {
    if (isSpinning) return;

    let totalBet = 0;
    for (let key in bets) { totalBet += bets[key]; }

    if (totalBet === 0) {
        document.getElementById('display-message').textContent = "⚠️ ¡Primero haz una apuesta!";
        return;
    }

    previousBets = { ...bets };

    isSpinning = true;
    document.getElementById('display-message').textContent = "🎰 El Top Slot está girando...";

    const slotOptions = ["1", "2", "5", "10", "COIN FLIP", "CASH HUNT", "PACHINKO", "CRAZY TIME"];
    const slotTarget = slotOptions[Math.floor(Math.random() * slotOptions.length)];
    const slotMultiplier = [2, 3, 5, 10, 15, 25][Math.floor(Math.random() * 6)];

    document.getElementById('slot-segment').textContent = slotTarget;
    document.getElementById('slot-multiplier').textContent = slotMultiplier + "x";

    setTimeout(() => {
        document.getElementById('display-message').textContent = "🎡 ¡GIRANDO LA RUEDA!";
        
        const totalSegments = segments.length;
        const winnerIndex = Math.floor(Math.random() * totalSegments);
        const winningSegment = segments[winnerIndex];

        const degreesPerSegment = 360 / totalSegments;
        const targetAngle = -(winnerIndex * degreesPerSegment) - (degreesPerSegment / 2);
        const normalizedTarget = ((targetAngle % 360) + 360) % 360;
        const extraSpins = 360 * (5 + Math.floor(Math.random() * 4));

        currentRotation = (Math.ceil(currentRotation / 360) * 360) + extraSpins + normalizedTarget;

        const wheelEl = document.getElementById('wheel');
        wheelEl.style.transition = "transform 6s cubic-bezier(0.15, 0.85, 0.2, 1)";
        wheelEl.style.transform = `rotate(${currentRotation}deg)`;

        setTimeout(() => {
            evaluateResult(winningSegment, slotTarget, slotMultiplier);
        }, 6000);

    }, 1500);
}

function evaluateResult(winner, slotTarget, slotMultiplier) {
    isSpinning = false;
    let multiplier = 1;

    if (winner.name === slotTarget) {
        multiplier = slotMultiplier;
        document.getElementById('display-message').innerHTML = `🎯 ¡Top Slot! El segmento ${winner.name} tiene un multiplicador de ${multiplier}x`;
    } else {
        document.getElementById('display-message').innerHTML = `¡Cayó en: ${winner.name}!`;
    }

    if (winner.type === "number") {
        let winAmount = 0;
        if (bets[winner.name] > 0) {
            winAmount = bets[winner.name] + (bets[winner.name] * winner.val * multiplier);
            balance += winAmount;
            document.getElementById('display-message').innerHTML += `<br>💰 ¡Ganaste $${winAmount}!`;
        } else {
            document.getElementById('display-message').innerHTML += `<br>No tenías apuesta en este número.`;
        }
        for (let key in bets) bets[key] = 0;
        updateUI();
    } else {
        triggerBonus(winner.name, bets[winner.name], multiplier);
    }
}

function triggerBonus(bonusName, betAmount, topSlotMult) {
    const screen = document.getElementById('bonus-screen');
    const title = document.getElementById('bonus-title');
    const area = document.getElementById('bonus-game-area');

    if (!screen) return;
    
    screen.classList.remove('hidden');
    title.textContent = bonusName;
    area.innerHTML = "Estableciendo multiplicadores...";

    setTimeout(() => {
        if (bonusName === "COIN FLIP") {
            const redMult = Math.floor(Math.random() * 20 + 2) * topSlotMult;
            const blueMult = Math.floor(Math.random() * 20 + 2) * topSlotMult;
            const sideWinner = Math.random() > 0.5 ? "ROJO" : "AZUL";
            const finalMult = sideWinner === "ROJO" ? redMult : blueMult;

            area.innerHTML = `
                <p style="margin-bottom:15px;">Cara Roja: <span style="color:red; font-weight:bold;">${redMult}x</span> | Cara Azul: <span style="color:blue; font-weight:bold;">${blueMult}x</span></p>
                <div class="cf-coin ${sideWinner === "ROJO" ? "cf-red" : "cf-blue"}">${sideWinner}</div>
                <p style="margin-top:15px; font-size:1.5rem; color:#ffd700;">¡El resultado es ${finalMult}x!</p>
            `;
            finishBonus(betAmount, finalMult);

        } else if (bonusName === "CASH HUNT") {
            const listMults = [10, 15, 20, 25, 50, 75, 100].map(x => x * topSlotMult);
            const finalMult = listMults[Math.floor(Math.random() * listMults.length)];
            area.innerHTML = `
                <p>Disparando cañones a los símbolos...</p>
                <p style="font-size:3rem; margin:20px 0;">🎯 💥 🃏</p>
                <p style="font-size:1.5rem; color:#00ffcc;">¡Revelado un multiplicador de <strong>${finalMult}x</strong>!</p>
            `;
            finishBonus(betAmount, finalMult);

        } else if (bonusName === "PACHINKO") {
            const finalMult = [10, 15, 25, 50, 100, 200][Math.floor(Math.random() * 6)] * topSlotMult;
            area.innerHTML = `
                <p>La bola de luz brillante rebota sobre los clavos...</p>
                <div class="pachinko-box">🟡</div>
                <p style="font-size:1.5rem; color:#ffd700; margin-top:20px;">¡Cayó en <strong>${finalMult}x</strong>!</p>
            `;
            finishBonus(betAmount, finalMult);

        } else if (bonusName === "CRAZY TIME") {
            const finalMult = [25, 50, 100, 250, 500, 1000][Math.floor(Math.random() * 6)] * topSlotMult;
            area.innerHTML = `
                <p>¡Abriendo la mítica puerta roja del Crazy Time! 🚪✨</p>
                <p style="font-size:3.5rem; margin: 15px 0;">🎡🎩🌈</p>
                <p style="font-size:1.6rem; color:#ff0055;">¡Tu flecha seleccionó <strong>${finalMult}x</strong>!</p>
            `;
            finishBonus(betAmount, finalMult);
        }
    }, 2500);
}

function finishBonus(betAmount, multiplier) {
    setTimeout(() => {
        const screen = document.getElementById('bonus-screen');
        if (screen) screen.classList.add('hidden');
        
        if (betAmount > 0) {
            let winAmount = betAmount * multiplier;
            balance += winAmount;
            document.getElementById('display-message').innerHTML = `🎉 ¡Fin del Bonus! Multiplicador de ${multiplier}x. ¡Ganaste $${winAmount}!`;
        } else {
            document.getElementById('display-message').innerHTML = `🎁 Fin del Bonus: ${multiplier}x (No tenías apuesta aquí).`;
        }

        for (let key in bets) bets[key] = 0;
        updateUI();
    }, 5000);
}

initGame();