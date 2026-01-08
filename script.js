const LS_KEY = "petanca_v3_final";
let state = { players: [], rounds: [], settings: { rounds: 3 } };

const get = (id) => document.getElementById(id);
const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

function init() {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = JSON.parse(raw);
    renderPlayers();
    if (state.rounds.length > 0) renderRounds();
}

const getFormattedName = (index) => `${index + 1}. ${state.players[index].name}`;

function addPlayer() {
    const input = get("nombreJugador");
    const name = input.value.trim();
    if (!name) return;
    state.players.push({ name });
    input.value = "";
    save(); renderPlayers();
}

window.removePlayer = (index) => {
    state.players.splice(index, 1);
    save(); renderPlayers();
};

function renderPlayers() {
    get("listaJugadores").innerHTML = state.players.map((p, i) => `
        <div class="jugador">
            <div style="display:flex; align-items:center;">
                <div class="dorsal">${i + 1}</div>
                <span style="font-weight:600;">${p.name}</span>
            </div>
            <button onclick="removePlayer(${i})" style="color:red; background:none; font-size:18px;">×</button>
        </div>
    `).join("");
    get("playerCount").innerText = `(Total: ${state.players.length})`;
}

window.checkWinner = (r, i) => {
    const valA = parseInt(get(`s_${r}_${i}_A`).value) || 0;
    const valB = parseInt(get(`s_${r}_${i}_B`).value) || 0;
    const labelA = get(`name_${r}_${i}_A`);
    const labelB = get(`name_${r}_${i}_B`);

    labelA.classList.remove("winner", "loser");
    labelB.classList.remove("winner", "loser");

    if (valA === 13) { labelA.classList.add("winner"); labelB.classList.add("loser"); }
    else if (valB === 13) { labelB.classList.add("winner"); labelA.classList.add("loser"); }
};

function generate() {
    const N = state.players.length;
    if (N < 8) return alert("Mínimo 8 jugadores");

    const numRondas = parseInt(get("selRondas").value);
    const isFixed = get("optFixedTeams").checked;
    const numEnf = N >= 40 ? 10 : Math.floor(N / 4);
    const numEquipos = numEnf * 2;
    const numTripletas = N - (numEquipos * 2);
    const numDupletas = numEquipos - numTripletas;

    state.rounds = [];
    let historyMatches = new Set();
    let fixedTeams = null;

    for (let r = 1; r <= numRondas; r++) {
        let ok = false, attempts = 0, matches = [];
        while (!ok && attempts < 1500) {
            attempts++;
            let indices = state.players.map((_, i) => i).sort(() => Math.random() - 0.5);
            let teams = (isFixed && fixedTeams) ? JSON.parse(JSON.stringify(fixedTeams)) : [];

            if (!isFixed || r === 1) {
                let idx = 0;
                for (let i = 0; i < numDupletas; i++) teams.push({ members: [indices[idx++], indices[idx++]] });
                for (let i = 0; i < numTripletas; i++) teams.push({ members: [indices[idx++], indices[idx++], indices[idx++]] });
                if (isFixed && r === 1) fixedTeams = JSON.parse(JSON.stringify(teams));
            }

            teams.sort(() => Math.random() - 0.5);
            let tempMatches = [], matchRepetido = false;

            for (let i = 0; i < teams.length; i += 2) {
                let keyA = teams[i].members.sort((a,b)=>a-b).join("-");
                let keyB = teams[i+1].members.sort((a,b)=>a-b).join("-");
                let matchKey = [keyA, keyB].sort().join("VS");
                if (historyMatches.has(matchKey)) matchRepetido = true;
                tempMatches.push({ equipoA: teams[i], equipoB: teams[i+1], scoreA: 0, scoreB: 0, pista: (i/2)+1 });
            }
            if (!matchRepetido) { matches = tempMatches; ok = true; }
        }
        matches.forEach(m => historyMatches.add([m.equipoA.members.sort((a,b)=>a-b).join("-"), m.equipoB.members.sort((a,b)=>a-b).join("-")].sort().join("VS")));
        state.rounds.push({ ronda: r, matches });
    }
    save(); renderRounds();
}

function renderRounds() {
    get("sorteosCard").style.display = "block";
    get("rankingCard").style.display = "block";
    get("rondasContainer").innerHTML = state.rounds.map(r => `
        <div class="mt" style="background:var(--dark); color:white; padding:10px 15px; border-radius:8px; font-size:12px;"><strong>RONDA ${r.ronda}</strong></div>
        ${r.matches.map((m, i) => `
            <div class="equipoBox">
                <div class="row" style="justify-content:space-between;">
                    <div id="name_${r.ronda}_${i}_A" class="equipo-nombres ${m.scoreA === 13 ? 'winner' : (m.scoreB === 13 ? 'loser' : '')}" style="text-align:left;">
                        ${m.equipoA.members.map(idx => getFormattedName(idx)).join(" / ")}
                    </div>
                    <div class="capsula-score">
                        <input type="number" value="${m.scoreA}" id="s_${r.ronda}_${i}_A" oninput="checkWinner(${r.ronda}, ${i})">
                        <span style="font-weight:bold; color:#888;">-</span>
                        <input type="number" value="${m.scoreB}" id="s_${r.ronda}_${i}_B" oninput="checkWinner(${r.ronda}, ${i})">
                    </div>
                    <div id="name_${r.ronda}_${i}_B" class="equipo-nombres ${m.scoreB === 13 ? 'winner' : (m.scoreA === 13 ? 'loser' : '')}" style="text-align:right;">
                        ${m.equipoB.members.map(idx => getFormattedName(idx)).join(" / ")} 
                        ${get("optAssignPistas").checked ? `<span class="pistaLabel">Pista ${m.pista}</span>`:''}
                    </div>
                </div>
            </div>
        `).join("")}
    `).join("");
}

function rank() {
    state.rounds.forEach(r => r.matches.forEach((m, i) => {
        m.scoreA = parseInt(get(`s_${r.ronda}_${i}_A`).value) || 0;
        m.scoreB = parseInt(get(`s_${r.ronda}_${i}_B`).value) || 0;
    }));
    let s = {};
    state.players.forEach((p, i) => s[i] = { fullName: getFormattedName(i), w: 0, pf: 0, pc: 0, d: 0 });
    state.rounds.forEach(r => r.matches.forEach(m => {
        const up = (ids, p, o) => ids.forEach(id => { 
            if(s[id]) { s[id].pf += p; s[id].pc += o; s[id].d += (p-o); if(p>o) s[id].w++; }
        });
        up(m.equipoA.members, m.scoreA, m.scoreB);
        up(m.equipoB.members, m.scoreB, m.scoreA);
    }));
    const sorted = Object.values(s).sort((a,b) => b.w - a.w || b.d - a.d || b.pf - a.pf);
    get("rankingOutput").innerHTML = `
        <div class="row" style="margin-bottom:15px;"><button onclick="rank()" class="primary">Calcular Ranking Final</button></div>
        <div class="tabla-container"><table class="tabla">
            <thead><tr><th>Posición</th><th>Jugador</th><th>PG</th><th>PF</th><th>PC</th><th>Dif</th></tr></thead>
            <tbody>${sorted.map((p,i)=>`<tr><td><strong>${i+1}º</strong></td><td style="text-align:left; padding-left:20px;">${p.fullName}</td><td>${p.w}</td><td>${p.pf}</td><td>${p.pc}</td><td>${p.d}</td></tr>`).join("")}</tbody>
        </table></div>`;
}

get("btnAdd").onclick = addPlayer;
get("btnStart").onclick = generate;
get("btnSaveResults").onclick = () => { rank(); save(); alert("Datos guardados."); };
get("btnClear").onclick = () => { if(confirm("¿Borrar todo?")) { localStorage.clear(); location.reload(); }};
get("nombreJugador").onkeydown = (e) => { if(e.key === 'Enter') addPlayer(); };

const sel = document.createElement("select"); sel.id = "selRondas";
[3,4,5,6].forEach(n => { let o = document.createElement("option"); o.value = n; o.innerText = n + " Rondas"; sel.appendChild(o); });
get("mainActions").insertBefore(sel, get("btnStart"));

init();
