// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const supabaseUrl = 'https://wgqqbahoalozgfukioza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let balance = 0; // Se actualizará al leer la base de datos

// ==========================================
// 2. VARIABLES DEL MULTIJUGADOR Y SINCRONIZACIÓN
// ==========================================
const GLOBAL_EPOCH = 1700000000000; 
const WAIT_TIME_MS = 15000;         // 15 segundos para apostar
const SPIN_TIME_MS = 8000;          // Animación de la ruleta
const EVAL_TIME_BASE = 4000;        // Tiempo base de pagos normales

let estadoActual = '';  // 'WAITING', 'SPINNING', 'REWARDING'
let currentRoundId = -1;
let currentRoundStart = 0;
let currentRoundData = null;
let enRondaActual = false; 

let crazyChannel = null;
let displayUsername = "Jugador" + Math.floor(Math.random() * 9999);
let historialResultados = [];

// ==========================================
// 3. LÓGICA DE AUTENTICACIÓN Y SALDOS
// ==========================================
async function verificarSesionYJugar() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Redirigir al lobby si no está logueado
        // window.location.href = 'index.html'; 
        // Para pruebas locales sin sesión, habilitamos modo prueba
        console.warn("No hay sesión activa. Iniciando en MODO PRUEBA...");
        currentUser = { id: 'usuario_prueba_local' };
        balance = 10000;
    } else {
        currentUser = session.user;
        if (currentUser.email) displayUsername = currentUser.email.split('@')[0];

        // Buscamos su saldo en la tabla "perfiles"
        const { data: perfilData, error } = await supabaseClient
            .from('perfiles')
            .select('saldo')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (perfilData) {
            balance = parseFloat(perfilData.saldo);
        } else {
            // Si no tiene perfil, le damos el saldo inicial
            balance = 10000; 
            await guardarSaldoEnBD(); 
        }
    }

    initGame(); 
    iniciarConexionMultijugador();
    sincronizarRelojGlobal();
}

async function guardarSaldoEnBD() {
    if(!currentUser || currentUser.id === 'usuario_prueba_local') return;
    
    await supabaseClient
        .from('perfiles')
        .upsert({ 
            id: currentUser.id, 
            saldo: balance 
        });
}

// Iniciar sesión apenas carga la ventana
window.onload = verificarSesionYJugar;


// ==========================================
// 4. SISTEMA DE CHAT Y MULTIJUGADOR (NUEVO)
// ==========================================
function iniciarConexionMultijugador() {
    const presenceKey = (currentUser.id === 'usuario_prueba_local') 
        ? 'guest_' + Math.floor(Math.random() * 1000000) 
        : currentUser.id;

    crazyChannel = supabaseClient.channel('crazytime_room', {
        config: { presence: { key: presenceKey } },
    });

    crazyChannel.on('presence', { event: 'sync' }, () => {
        const newState = crazyChannel.presenceState();
        document.getElementById('online-count-value').innerText = Object.keys(newState).length;
    });

    crazyChannel.on('broadcast', { event: 'chat_message' }, (payload) => {
        mostrarMensajeEnChat(payload.payload.user, payload.payload.text);
    });

    crazyChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await crazyChannel.track({
                online_at: new Date().toISOString(),
                username: displayUsername
            });
        }
    });
}

function toggleChat() {
    const popup = document.getElementById("chat-popup");
    if (popup.style.display === "flex") {
        popup.style.display = "none";
    } else {
        popup.style.display = "flex";
        const container = document.getElementById("chat-messages");
        container.scrollTop = container.scrollHeight;
        document.getElementById("chat-input").focus();
    }
}

function manejarEnterChat(e) { if (e.key === 'Enter') enviarMensajeChat(); }

function enviarMensajeChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    mostrarMensajeEnChat(displayUsername, text);
    if (crazyChannel) {
        crazyChannel.send({
            type: 'broadcast',
            event: 'chat_message',
            payload: { user: displayUsername, text: text }
        });
    }
    input.value = ""; 
}

function mostrarMensajeEnChat(user, text) {
    const container = document.getElementById("chat-messages");
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("chat-msg");
    const userSpan = document.createElement("span");
    userSpan.classList.add("user");
    userSpan.innerText = user + ":";
    const textSpan = document.createElement("span");
    textSpan.innerText = " " + text;
    msgDiv.appendChild(userSpan);
    msgDiv.appendChild(textSpan);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}


// ==========================================
// 5. MOTOR DEL JUEGO SINCRONIZADO GLOBALMENTE (NUEVO)
// ==========================================
function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function obtenerDatosDeRonda(roundId) {
    let rng = mulberry32(roundId);
    rng(); rng(); rng(); // Calentamiento

    // 1. Top Slot
    const slotOptions = ["1", "2", "5", "10", "COIN FLIP", "CASH HUNT", "PACHINKO", "CRAZY TIME"];
    const slotTarget = slotOptions[Math.floor(rng() * slotOptions.length)];
    const slotMults = [2, 3, 5, 10, 15, 25];
    const slotMultiplier = slotMults[Math.floor(rng() * slotMults.length)];

    // 2. Wheel Winner
    const totalSegments = segments.length; // 54
    const winnerIndex = Math.floor(rng() * totalSegments);
    const winningSegment = segments[winnerIndex];

    // 3. Predicciones deterministas para el Bonus
    let bonusData = {};
    if (winningSegment.name === "COIN FLIP") {
        bonusData.redMult = Math.floor(rng() * 20 + 2);
        bonusData.blueMult = Math.floor(rng() * 20 + 2);
        bonusData.sideWinner = rng() > 0.5 ? "ROJO" : "AZUL";
    } else if (winningSegment.name === "CASH HUNT") {
        const listMults = [10, 15, 20, 25, 50, 75, 100];
        bonusData.finalMultBase = listMults[Math.floor(rng() * listMults.length)];
    } else if (winningSegment.name === "PACHINKO") {
        const listMults = [10, 15, 25, 50, 100, 200];
        bonusData.finalMultBase = listMults[Math.floor(rng() * listMults.length)];
    } else if (winningSegment.name === "CRAZY TIME") {
        const listMults = [25, 50, 100, 250, 500, 1000];
        bonusData.finalMultBase = listMults[Math.floor(rng() * listMults.length)];
    }

    let bonusTime = (winningSegment.type === "bonus") ? 8000 : 0; 
    let totalDuration = WAIT_TIME_MS + SPIN_TIME_MS + EVAL_TIME_BASE + bonusTime;

    return { 
        slotTarget, slotMultiplier, 
        winnerIndex, winningSegment, 
        bonusData, totalDuration 
    };
}

function sincronizarRelojGlobal() {
    let nowMs = Date.now();
    currentRoundId = 1;
    currentRoundStart = GLOBAL_EPOCH;
    
    while (true) {
        currentRoundData = obtenerDatosDeRonda(currentRoundId);
        if (currentRoundStart + currentRoundData.totalDuration > nowMs) {
            break; // Momento actual
        }
        currentRoundStart += currentRoundData.totalDuration;
        currentRoundId++;
    }

    // Comprobar si quedó colgado o si hay apuestas que borrar por desconexión
    clearBetsLocally(); 
    generarHistorial(currentRoundId);
    requestAnimationFrame(loopGlobalJuego);
}

function generarHistorial(roundActual) {
    historialResultados = [];
    for (let i = 1; i <= 15; i++) {
        let pastRoundId = roundActual - i;
        if (pastRoundId < 1) continue;
        let pastData = obtenerDatosDeRonda(pastRoundId);
        historialResultados.push(pastData.winningSegment.name); 
    }
    renderizarHistorial();
}

function loopGlobalJuego() {
    let nowMs = Date.now();
    let elapsed = nowMs - currentRoundStart;

    if (elapsed >= currentRoundData.totalDuration) {
        let saltos = 0;
        while (elapsed >= currentRoundData.totalDuration) {
            currentRoundStart += currentRoundData.totalDuration;
            currentRoundId++;
            currentRoundData = obtenerDatosDeRonda(currentRoundId);
            elapsed = nowMs - currentRoundStart;
            saltos++;
            if (saltos > 100) return sincronizarRelojGlobal();
        }
        
        estadoActual = '';
        enRondaActual = false;
        clearBetsLocally(); // Limpiamos mesa al iniciar nueva ronda si algo falló
        generarHistorial(currentRoundId);
    }

    if (elapsed < WAIT_TIME_MS) {
        // --- FASE 1: APUESTAS ---
        if (estadoActual !== 'WAITING') {
            estadoActual = 'WAITING';
            enRondaActual = true;
            document.getElementById('spin-btn').style.background = "linear-gradient(to bottom, #ffcc00, #ff6600)";
            // Restaurar rueda a 0
            document.getElementById('wheel').style.transition = "none";
            document.getElementById('wheel').style.transform = `rotate(0deg)`;
            currentRotation = 0;
            document.getElementById('bonus-screen').classList.add('hidden');
        }
        let secsLeft = Math.ceil((WAIT_TIME_MS - elapsed) / 1000);
        document.getElementById('display-message').innerHTML = `⏳ TIEMPO PARA APOSTAR: <strong>${secsLeft}s</strong>`;
        document.getElementById('spin-btn').innerText = `APUESTAS: ${secsLeft}s`;

    } else if (elapsed < WAIT_TIME_MS + SPIN_TIME_MS) {
        // --- FASE 2: GIRO ---
        if (estadoActual !== 'SPINNING') {
            estadoActual = 'SPINNING';
            document.getElementById('spin-btn').innerText = `¡GIRANDO!`;
            document.getElementById('spin-btn').style.background = "#666";
            
            // Guardamos las apuestas actuales para el botón Repetir
            let totalBet = 0;
            for (let key in bets) totalBet += bets[key];
            if (totalBet > 0) previousBets = { ...bets };

            ejecutarGiroSincronizado(currentRoundData);
        }
    } else {
        // --- FASE 3: RESULTADO Y PAGOS ---
        if (estadoActual !== 'REWARDING') {
            estadoActual = 'REWARDING';
            // Validamos resultado con la misma data precalculada
            evaluateResult(currentRoundData.winningSegment, currentRoundData.slotTarget, currentRoundData.slotMultiplier, currentRoundData.bonusData);
            
            historialResultados.unshift(currentRoundData.winningSegment.name); 
            if (historialResultados.length > 15) historialResultados.pop();
            renderizarHistorial();
        }
    }

    requestAnimationFrame(loopGlobalJuego);
}


// ==========================================
// 6. LÓGICA DEL JUEGO CRAZY TIME (ORIGINAL MODIFICADO PARA SYNC)
// ==========================================
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

let activeChipValue = 25; 
let bets = { "1": 0, "2": 0, "5": 0, "10": 0, "COIN FLIP": 0, "CASH HUNT": 0, "PACHINKO": 0, "CRAZY TIME": 0 };
let previousBets = null; 
let currentRotation = 0;

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
            if (estadoActual !== 'WAITING') return; // Bloqueo si no es tiempo de apostar
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
            if (estadoActual !== 'WAITING') {
                document.getElementById('display-message').textContent = "⚠️ ¡El tiempo de apuestas ya cerró!";
                return;
            }
            const target = btn.getAttribute("data-target");
            const betCost = activeChipValue; 
            
            if (balance >= betCost) {
                balance -= betCost;
                bets[target] += betCost;
                updateUI();
                guardarSaldoEnBD();
            } else {
                document.getElementById('display-message').textContent = "❌ ¡Saldo insuficiente para esta ficha!";
            }
        };
    });
}

function setupControlButtons() {
    const clearBtn = document.getElementById("clear-btn");
    const repeatBtn = document.getElementById("repeat-btn");

    if (clearBtn) clearBtn.onclick = clearBets;
    if (repeatBtn) repeatBtn.onclick = repeatLastBet;
}

function updateUI() {
    document.getElementById('balance').textContent = Number(balance).toFixed(2);
    
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
        if (chip) chip.textContent = bets[key] > 0 ? `$${bets[key]}` : "$0";
    }
    document.getElementById('total-bet').textContent = totalBet;
}

function clearBets() {
    if (estadoActual !== 'WAITING') return;
    
    let refundedAmount = 0;
    for (let key in bets) {
        refundedAmount += bets[key];
        balance += bets[key];
        bets[key] = 0;
    }
    updateUI();
    if (refundedAmount > 0) guardarSaldoEnBD(); 
}

function clearBetsLocally() {
    for (let key in bets) bets[key] = 0;
    updateUI();
}

function repeatLastBet() {
    if (estadoActual !== 'WAITING') return;
    
    if (!previousBets) {
        document.getElementById('display-message').textContent = "⚠️ No hay ninguna apuesta anterior guardada.";
        return;
    }

    let totalCost = 0;
    for (let key in previousBets) totalCost += previousBets[key];

    if (totalCost === 0) return;

    clearBets();

    if (balance >= totalCost) {
        balance -= totalCost;
        bets = { ...previousBets };
        updateUI();
        guardarSaldoEnBD(); 
        document.getElementById('display-message').textContent = "✅ ¡Apuesta anterior repetida!";
    } else {
        document.getElementById('display-message').textContent = "❌ ¡Saldo insuficiente para repetir esta apuesta!";
    }
}

function ejecutarGiroSincronizado(dataRound) {
    document.getElementById('display-message').textContent = "🎰 El Top Slot está girando...";

    document.getElementById('slot-segment').textContent = dataRound.slotTarget;
    document.getElementById('slot-multiplier').textContent = dataRound.slotMultiplier + "x";

    setTimeout(() => {
        if(estadoActual !== 'SPINNING') return; // Prevención si el usuario refrescó mal

        document.getElementById('display-message').textContent = "🎡 ¡GIRANDO LA RUEDA!";
        
        const degreesPerSegment = 360 / segments.length;
        const targetAngle = -(dataRound.winnerIndex * degreesPerSegment) - (degreesPerSegment / 2);
        const normalizedTarget = ((targetAngle % 360) + 360) % 360;
        const extraSpins = 360 * 5; 

        // Reseteamos visualmente para evitar giros bizarros en refrescos
        document.getElementById('wheel').style.transition = "none";
        document.getElementById('wheel').style.transform = `rotate(0deg)`;

        setTimeout(() => {
            currentRotation = extraSpins + normalizedTarget;
            const wheelEl = document.getElementById('wheel');
            wheelEl.style.transition = "transform 6s cubic-bezier(0.15, 0.85, 0.2, 1)";
            wheelEl.style.transform = `rotate(${currentRotation}deg)`;
        }, 50);

    }, 1500);
}

function evaluateResult(winner, slotTarget, slotMultiplier, bonusData) {
    let multiplier = 1;

    if (winner.name === slotTarget) {
        multiplier = slotMultiplier;
        document.getElementById('display-message').innerHTML = `🎯 ¡Top Slot! Multiplicador de ${multiplier}x en ${winner.name}`;
    } else {
        document.getElementById('display-message').innerHTML = `¡Cayó en: ${winner.name}!`;
    }

    if (winner.type === "number") {
        let winAmount = 0;
        if (bets[winner.name] > 0) {
            winAmount = bets[winner.name] + (bets[winner.name] * winner.val * multiplier);
            balance += winAmount;
            document.getElementById('display-message').innerHTML += `<br>💰 ¡Ganaste $${winAmount}!`;
            guardarSaldoEnBD(); 
        } else {
            document.getElementById('display-message').innerHTML += `<br>No tenías apuesta en este número.`;
        }
        clearBetsLocally();
    } else {
        triggerBonusSync(winner.name, bets[winner.name], multiplier, bonusData);
    }
}

function triggerBonusSync(bonusName, betAmount, topSlotMult, bonusData) {
    const screen = document.getElementById('bonus-screen');
    const title = document.getElementById('bonus-title');
    const area = document.getElementById('bonus-game-area');

    if (!screen) return;
    
    screen.classList.remove('hidden');
    title.textContent = bonusName;
    area.innerHTML = "Estableciendo multiplicadores...";

    setTimeout(() => {
        if(estadoActual !== 'REWARDING') return;

        let finalMult = 0;

        if (bonusName === "COIN FLIP") {
            const redMult = bonusData.redMult * topSlotMult;
            const blueMult = bonusData.blueMult * topSlotMult;
            const sideWinner = bonusData.sideWinner;
            finalMult = sideWinner === "ROJO" ? redMult : blueMult;

            area.innerHTML = `
                <p style="margin-bottom:15px;">Cara Roja: <span style="color:red; font-weight:bold;">${redMult}x</span> | Cara Azul: <span style="color:blue; font-weight:bold;">${blueMult}x</span></p>
                <div class="cf-coin ${sideWinner === "ROJO" ? "cf-red" : "cf-blue"}">${sideWinner}</div>
                <p style="margin-top:15px; font-size:1.5rem; color:#ffd700;">¡El resultado es ${finalMult}x!</p>
            `;

        } else if (bonusName === "CASH HUNT") {
            finalMult = bonusData.finalMultBase * topSlotMult;
            area.innerHTML = `
                <p>Disparando cañones a los símbolos...</p>
                <p style="font-size:3rem; margin:20px 0;">🎯 💥 🃏</p>
                <p style="font-size:1.5rem; color:#00ffcc;">¡Revelado un multiplicador de <strong>${finalMult}x</strong>!</p>
            `;

        } else if (bonusName === "PACHINKO") {
            finalMult = bonusData.finalMultBase * topSlotMult;
            area.innerHTML = `
                <p>La bola de luz rebota sobre los clavos...</p>
                <div class="pachinko-box">🟡</div>
                <p style="font-size:1.5rem; color:#ffd700; margin-top:20px;">¡Cayó en <strong>${finalMult}x</strong>!</p>
            `;

        } else if (bonusName === "CRAZY TIME") {
            finalMult = bonusData.finalMultBase * topSlotMult;
            area.innerHTML = `
                <p>¡Abriendo la mítica puerta roja del Crazy Time! 🚪✨</p>
                <p style="font-size:3.5rem; margin: 15px 0;">🎡🎩🌈</p>
                <p style="font-size:1.6rem; color:#ff0055;">¡Tu flecha seleccionó <strong>${finalMult}x</strong>!</p>
            `;
        }

        finishBonusSync(betAmount, finalMult);
    }, 2000);
}

function finishBonusSync(betAmount, multiplier) {
    setTimeout(() => {
        const screen = document.getElementById('bonus-screen');
        if (screen) screen.classList.add('hidden');
        
        if (betAmount > 0) {
            let winAmount = betAmount * multiplier;
            balance += winAmount;
            document.getElementById('display-message').innerHTML = `🎉 ¡Fin del Bonus! Multiplicador de ${multiplier}x. ¡Ganaste $${winAmount}!`;
            guardarSaldoEnBD(); 
        } else {
            document.getElementById('display-message').innerHTML = `🎁 Fin del Bonus: ${multiplier}x (No tenías apuesta aquí).`;
        }

        clearBetsLocally();
    }, 4500);
}

// ==========================================
// 7. FUNCIONES DEL HISTORIAL DE IMÁGENES
// ==========================================

function obtenerImagenResultado(name) {
    // Aquí defines el nombre exacto de la imagen que vas a subir a tu carpeta
    switch(name) {
        case "1": return "res-1.png";
        case "2": return "res-2.png";
        case "5": return "res-5.png";
        case "10": return "res-10.png";
        case "COIN FLIP": return "res-coinflip.png";
        case "CASH HUNT": return "res-cashhunt.png";
        case "PACHINKO": return "res-pachinko.png";
        case "CRAZY TIME": return "res-crazytime.png";
        default: return "";
    }
}

function renderizarHistorial() {
    const barra = document.getElementById("history-bar");
    if (!barra) return;
    barra.innerHTML = ""; 

    historialResultados.forEach(nombreRes => {
        const item = document.createElement("div");
        item.classList.add("history-item");
        
        const imgSrc = obtenerImagenResultado(nombreRes);
        
        // Si no encuentra imagen (porque no la subiste aún), muestra un texto de fallback para que no quede roto
        item.innerHTML = `<img src="${imgSrc}" alt="${nombreRes}" onerror="this.style.display='none'; this.parentNode.innerHTML='<span style=\\'font-size:10px; color:#fff;\\'>${nombreRes}</span>';">`;
        
        barra.appendChild(item);
    });
}