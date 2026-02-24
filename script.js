const LS_KEY = "petanca_v12_final_restaurada";
let state = { mode: null, data: [], rounds: [] };

const get = (id) => document.getElementById(id);
const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

// Inicialización de la App
function init() {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
        state = JSON.parse(raw);
        updateUI();
        if (state.rounds.length > 0) {
            renderRounds();
            renderResumen();
        }
    }
}

function setMode(m) {
    state.mode = m; state.data = []; state.rounds = [];
    updateUI(); save();
}

function updateUI() {
    if (!state.mode) {
        get("modeSelectorCard").style.display = "block";
        get("mainCard").style.display = "none";
        get("sorteosCard").style.display = "none";
        get("rankingCard").style.display = "none";
        get("resumenCompañerosCard").style.display = "none";
        return;
    }
    get("modeSelectorCard").style.display = "none";
    get("mainCard").style.display = "block";
    const isMele = state.mode === 'mele';
    get("titleRegistro").innerText = isMele ? "1. Registro de Jugadores (Melé)" : "1. Registro de Parejas Montadas";
    get("inputNombre").placeholder = isMele ? "Nombre..." : "Nombre Pareja...";
    renderEntries();
}

// Gestión de Jugadores
function addEntry() {
    const val = get("inputNombre").value.trim();
    if (!val) return;
    state.data.push({ name: val });
    get("inputNombre").value = "";
    save(); renderEntries();
}

window.removeEntry = (i) => { state.data.splice(i, 1); save(); renderEntries(); };

function renderEntries() {
    get("listaEntradas").innerHTML = state.data.map((item, i) => `
        <div class="jugador">
            <div style="display:flex; align-items:center;">
                <div class="dorsal">${i + 1}</div>
                <span style="font-weight:600;">${item.name}</span>
            </div>
            <button onclick="removeEntry(${i})" style="color:red; background:none; border:none; font-size:18px; cursor:pointer; font-weight:bold;">×</button>
        </div>
    `).join("");
    get("countText").innerText = `Total: ${state.data.length}`;
}

// Lógica de Ganadores
window.checkWinner = (r, i) => {
    const valA = parseInt(get(`s_${r}_${i}_A`).value) || 0;
    const valB = parseInt(get(`s_${r}_${i}_B`).value) || 0;
    const labelA = get(`name_${r}_${i}_A`);
    const labelB = get(`name_${r}_${i}_B`);
    labelA.classList.remove("winner", "loser");
    labelB.classList.remove("winner", "loser");
    
    if (valA > valB) { labelA.classList.add("winner"); labelB.classList.add("loser"); }
    else if (valB > valA) { labelB.classList.add("winner"); labelA.classList.add("loser"); }
};

// GENERACIÓN DEL TORNEO
function generate() {
    let entries = [...state.data];
    const n = entries.length;
    if (state.mode === 'mele' && n < 8) return alert("Mínimo 8 jugadores.");
    if (state.mode === 'montadas' && n < 4) return alert("Mínimo 4 parejas.");

    let tieneDescanso = false;
    if (state.mode === 'montadas' && n % 2 !== 0) {
        if (!entries.some(e => e.name === "DESCANSA")) entries.push({ name: "DESCANSA" });
        tieneDescanso = true;
    }

    const numRondas = parseInt(get("selRondas").value);
    const isFixed = get("optFixedTeams") ? get("optFixedTeams").checked : false;
    state.rounds = [];
    let yaDescansaron = [];
    let fixedMeleTeams = null;

    for (let r = 1; r <= numRondas; r++) {
        let pool = entries.map((_, i) => i).sort(() => Math.random() - 0.5);
        let matchesRonda = [];
        let matchDescanso = null;
        let teams = [];

        if (state.mode === 'mele') {
            if (isFixed && fixedMeleTeams) {
                teams = JSON.parse(JSON.stringify(fixedMeleTeams));
            } else {
                let idx = 0;
                const numEnf = n >= 40 ? 10 : Math.floor(n / 4);
                const numTrip = n - ((numEnf * 2) * 2);
                const numDup = (numEnf * 2) - numTrip;
                for (let i = 0; i < numDup; i++) teams.push({ members: [pool[idx++], pool[idx++]] });
                for (let i = 0; i < numTrip; i++) teams.push({ members: [pool[idx++], pool[idx++], pool[idx++]] });
                if (isFixed) fixedMeleTeams = JSON.parse(JSON.stringify(teams));
            }
        } else {
            let idxDescansa = entries.findIndex(e => e.name === "DESCANSA");
            let poolParejas = entries.map((_, i) => i);
            if (tieneDescanso && idxDescansa !== -1) {
                let candidatos = poolParejas.filter(idx => idx !== idxDescansa && !yaDescansaron.includes(idx));
                if (candidatos.length === 0) { yaDescansaron = []; candidatos = poolParejas.filter(idx => idx !== idxDescansa); }
                let elegidoIdx = candidatos[Math.floor(Math.random() * candidatos.length)];
                yaDescansaron.push(elegidoIdx);
                matchDescanso = {
                    namesA: entries[elegidoIdx].name, namesB: "DESCANSA",
                    scoreA: 13, scoreB: 5, pista: "L", // Regla estipulada 13-5
                    tA: { members: [elegidoIdx] }, tB: { members: [idxDescansa] }
                };
                poolParejas = poolParejas.filter(i => i !== elegidoIdx && i !== idxDescansa);
            }
            poolParejas.sort(() => Math.random() - 0.5);
            for (let i = 0; i < poolParejas.length; i++) teams.push({ members: [poolParejas[i]] });
        }

        if (state.mode === 'mele') teams.sort(() => Math.random() - 0.5);
        for (let i = 0; i < teams.length; i += 2) {
            if (teams[i+1] === undefined) break;
            matchesRonda.push({
                namesA: teams[i].members.map(idx => entries[idx].name).join(" / "),
                namesB: teams[i+1].members.map(idx => entries[idx].name).join(" / "),
                scoreA: 0, scoreB: 0, pista: matchesRonda.length + 1,
                tA: teams[i], tB: teams[i+1]
            });
        }
        if (matchDescanso) matchesRonda.push(matchDescanso);
        state.rounds.push({ ronda: r, matches: matchesRonda });
    }
    state.data = entries;
    save(); 
    renderRounds();
    renderResumen();
}

// NUEVA FUNCIÓN: RESUMEN DE COMPAÑEROS Y RIVALES
function renderResumen() {
    const resumenCard = get("resumenCompañerosCard");
    const listaResumen = get("listaResumen");
    if (state.rounds.length === 0) { resumenCard.style.display = "none"; return; }
    
    resumenCard.style.display = "block";
    let porJugador = {};
    state.data.forEach((p, i) => { if(p.name !== "DESCANSA") porJugador[i] = []; });

    state.rounds.forEach(r => {
        r.matches.forEach(m => {
            const processTeam = (currentTeam, otherTeam, otherNames) => {
                currentTeam.members.forEach(idx => {
                    if(state.data[idx].name === "DESCANSA") return;
                    const comps = currentTeam.members.filter(i => i !== idx).map(i => state.data[i].name);
                    const compText = comps.length > 0 ? `<strong>${comps.join(" / ")}</strong>` : "Pareja Fija";
                    
                    let infoRival = otherNames.includes("DESCANSA") 
                        ? "🟡 <strong style='color:#e67e22;'>DESCANSA (Ganas 13-5)</strong>" 
                        : `vs <strong>${otherNames}</strong> (Pista ${m.pista})`;
                    
                    porJugador[idx].push(`<li>R${r.ronda}: Con ${compText} ${infoRival}</li>`);
                });
            };
            processTeam(m.tA, m.tB, m.namesB);
            processTeam(m.tB, m.tA, m.namesA);
        });
    });

    let html = "";
    for (let idx in porJugador) {
        html += `<div class="equipoBox" style="font-size:12px; border-top: 3px solid var(--primary);">
            <div style="margin-bottom:5px;">
                <span class="dorsal" style="display:inline-flex;">${parseInt(idx)+1}</span> 
                <strong style="text-transform:uppercase;">${state.data[idx].name}</strong>
            </div>
            <ul style="padding-left:15px; margin:0; list-style-type: none;">${porJugador[idx].join("")}</ul>
        </div>`;
    }
    listaResumen.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">${html}</div>`;
}

// RENDERIZADO DE RONDAS (ENFRENTAMIENTOS)
function renderRounds() {
    get("sorteosCard").style.display = "block";
    get("rankingCard").style.display = "block";
    get("rondasContainer").innerHTML = state.rounds.map(r => `
        <div class="mt" style="background:var(--dark); color:white; padding:10px 15px; border-radius:8px; font-size:12px;"><strong>RONDA ${r.ronda}</strong></div>
        ${r.matches.map((m, i) => {
            const textoPista = m.pista === 'L' ? 'LIBRE' : 'PISTA ' + m.pista;
            return `
            <div class="equipoBox">
                <div class="row" style="justify-content:space-between; align-items:center;">
                    <div id="name_${r.ronda}_${i}_A" class="equipo-nombres ${m.scoreA > m.scoreB?'winner':''}" style="text-align:left;">
                        ${m.namesA}
                    </div>
                    <div class="capsula-score">
                        <input type="number" value="${m.scoreA}" id="s_${r.ronda}_${i}_A" oninput="checkWinner(${r.ronda}, ${i})">
                        <span style="font-weight:bold; color:#888;">-</span>
                        <input type="number" value="${m.scoreB}" id="s_${r.ronda}_${i}_B" oninput="checkWinner(${r.ronda}, ${i})">
                    </div>
                    <div id="name_${r.ronda}_${i}_B" class="equipo-nombres ${m.scoreB > m.scoreA?'winner':''}" style="text-align:right;">
                        ${m.namesB} <span class="pistaLabel">${textoPista}</span>
                    </div>
                </div>
            </div>`;
        }).join("")}
    `).join("");
}

// CLASIFICACIÓN (RANKING)
function rank() {
    state.rounds.forEach(r => r.matches.forEach((m, i) => {
        m.scoreA = parseInt(get(`s_${r.ronda}_${i}_A`).value) || 0;
        m.scoreB = parseInt(get(`s_${r.ronda}_${i}_B`).value) || 0;
    }));
    let s = {};
    state.data.forEach((d, i) => { s[i] = { name: d.name, dorsal: i + 1, w: 0, pf: 0, pc: 0, d: 0 }; });
    state.rounds.forEach(r => r.matches.forEach(m => {
        const up = (ids, p, o) => ids.forEach(id => { 
            if(s[id]) { s[id].pf += p; s[id].pc += o; s[id].d += (p-o); if(p>o) s[id].w++; }
        });
        up(m.tA.members, m.scoreA, m.scoreB); up(m.tB.members, m.scoreB, m.scoreA);
    }));
    const sorted = Object.values(s).filter(x => x.name !== "DESCANSA").sort((a,b) => b.w - a.w || b.d - a.d || b.pf - a.pf);
    get("rankingOutput").innerHTML = `
        <div class="tabla-container">
            <table class="tabla">
                <thead><tr><th>Pos</th><th>Dorsal</th><th>Jugad@r</th><th>PG</th><th>PF</th><th>PC</th><th>Dif</th></tr></thead>
                <tbody>${sorted.map((p, i) => `
                    <tr class="${i<1?'pos-1':''}">
                        <td><strong>${i+1}º</strong></td>
                        <td><span class="dorsal-ranking">${p.dorsal}</span></td>
                        <td style="text-align:left;">${p.name}</td>
                        <td>${p.w}</td><td>${p.pf}</td><td>${p.pc}</td><td>${p.d}</td>
                    </tr>`).join("")}
                </tbody>
            </table>
        </div>
        <button onclick="rank()" class="primary mt">Actualizar Ranking</button>`;
}

// EVENT LISTENERS
get("btnAdd").onclick = addEntry;
get("btnStart").onclick = generate;
get("btnSaveResults").onclick = () => { rank(); save(); alert("Resultados Guardados."); };
get("btnBack").onclick = () => { if(confirm("¿Cambiar modo?")) { state.mode = null; save(); location.reload(); }};
get("btnClear").onclick = () => { if(confirm("¿Borrar todo?")) { localStorage.clear(); location.reload(); }};
get("inputNombre").onkeydown = (e) => { if(e.key === 'Enter') addEntry(); };

// Selector de Rondas Dinámico
if(!get("selRondas")) {
    const sel = document.createElement("select"); sel.id = "selRondas";
    [3,4,5,6].forEach(n => { let o = document.createElement("option"); o.value = n; o.innerText = n + " Rondas"; sel.appendChild(o); });
    get("mainActions").insertBefore(sel, get("btnStart"));
}

init();
