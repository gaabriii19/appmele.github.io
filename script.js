const LS_KEY = "petanca_v12_final_restaurada";
let state = { mode: null, data: [], rounds: [] };

const get = (id) => document.getElementById(id);
const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

function init() {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
        state = JSON.parse(raw);
        updateUI();
        if (state.rounds.length > 0) renderRounds();
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
        return;
    }
    get("modeSelectorCard").style.display = "none";
    get("mainCard").style.display = "block";
    const isMele = state.mode === 'mele';
    get("titleRegistro").innerText = isMele ? "1. Registro de Jugadores (Melé)" : "1. Registro de Parejas Montadas";
    get("inputNombre").placeholder = isMele ? "Nombre..." : "Nombre Pareja...";
    renderEntries();
}

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
            // RESTAURADA LÓGICA ORIGINAL DE MELÉ (Dupletas y Tripletas)
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
            // MODO PAREJAS MONTADAS
            let idxDescansa = entries.findIndex(e => e.name === "DESCANSA");
            let poolParejas = entries.map((_, i) => i);

            if (tieneDescanso && idxDescansa !== -1) {
                let candidatos = poolParejas.filter(idx => idx !== idxDescansa && !yaDescansaron.includes(idx));
                if (candidatos.length === 0) { yaDescansaron = []; candidatos = poolParejas.filter(idx => idx !== idxDescansa); }
                let elegidoIdx = candidatos[Math.floor(Math.random() * candidatos.length)];
                yaDescansaron.push(elegidoIdx);

                matchDescanso = {
                    namesA: entries[elegidoIdx].name, namesB: "DESCANSA",
                    scoreA: 13, scoreB: 6, pista: "L",
                    tA: { members: [elegidoIdx] }, tB: { members: [idxDescansa] }
                };
                poolParejas = poolParejas.filter(i => i !== elegidoIdx && i !== idxDescansa);
            }
            poolParejas.sort(() => Math.random() - 0.5);
            for (let i = 0; i < poolParejas.length; i++) teams.push({ members: [poolParejas[i]] });
        }

        // Emparejamiento Final 1 vs 1
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
    save(); renderRounds();
}

function renderRounds() {
    get("sorteosCard").style.display = "block";
    get("rankingCard").style.display = "block";
    get("rondasContainer").innerHTML = state.rounds.map(r => `
        <div class="mt" style="background:var(--dark); color:white; padding:10px 15px; border-radius:8px; font-size:12px;"><strong>RONDA ${r.ronda}</strong></div>
        ${r.matches.map((m, i) => {
            const esDA = m.namesA.toUpperCase().includes("DESCANSA");
            const esDB = m.namesB.toUpperCase().includes("DESCANSA");
            const styleA = esDA ? 'style="color: #FF8C00 !important; font-weight: bold;"' : '';
            const styleB = esDB ? 'style="color: #FF8C00 !important; font-weight: bold;"' : '';

            const dorsalesA = m.tA.members.map(idx => (idx + 1)).join(",");
            const dorsalesB = m.tB.members.map(idx => (idx + 1)).join(",");
            
            const badgeA = esDA ? "" : `<span class="dorsal-partido">${dorsalesA}</span> `;
            const badgeB = esDB ? "" : `<span class="dorsal-partido">${dorsalesB}</span> `;

            // CAMBIO AQUÍ: 'P' + m.pista por 'PISTA ' + m.pista
            const textoPista = m.pista === 'L' ? 'LIBRE' : 'PISTA ' + m.pista;

            return `
            <div class="equipoBox">
                <div class="row" style="justify-content:space-between; align-items:center;">
                    <div id="name_${r.ronda}_${i}_A" class="equipo-nombres ${m.scoreA===13?'winner':''}" style="text-align:left;" ${styleA}>
                        ${badgeA}${m.namesA}
                    </div>
                    <div class="capsula-score">
                        <input type="number" value="${m.scoreA}" id="s_${r.ronda}_${i}_A" oninput="checkWinner(${r.ronda}, ${i})" style="padding:0; text-align:center;">
                        <span style="font-weight:bold; color:#888;">-</span>
                        <input type="number" value="${m.scoreB}" id="s_${r.ronda}_${i}_B" oninput="checkWinner(${r.ronda}, ${i})" style="padding:0; text-align:center;">
                    </div>
                    <div id="name_${r.ronda}_${i}_B" class="equipo-nombres ${m.scoreB===13?'winner':''}" style="text-align:right;" ${styleB}>
                        ${m.namesB} ${badgeB} <span class="pistaLabel">${textoPista}</span>
                    </div>
                </div>
            </div>`;
        }).join("")}
    `).join("");
}

function rank() {
    state.rounds.forEach(r => r.matches.forEach((m, i) => {
        m.scoreA = parseInt(get(`s_${r.ronda}_${i}_A`).value) || 0;
        m.scoreB = parseInt(get(`s_${r.ronda}_${i}_B`).value) || 0;
    }));
    
    let s = {};
    // Mapeamos los datos originales para mantener el dorsal (índice + 1)
    state.data.forEach((d, i) => {
        s[i] = { name: d.name, dorsal: i + 1, w: 0, pf: 0, pc: 0, d: 0 };
    });

    state.rounds.forEach(r => r.matches.forEach(m => {
        const up = (ids, p, o) => ids.forEach(id => { 
            if(s[id]) { 
                s[id].pf += p; 
                s[id].pc += o; 
                s[id].d += (p-o); 
                if(p>o) s[id].w++; 
            }
        });
        up(m.tA.members, m.scoreA, m.scoreB); 
        up(m.tB.members, m.scoreB, m.scoreA);
    }));

    const sorted = Object.values(s)
        .filter(x => x.name !== "DESCANSA")
        .sort((a,b) => b.w - a.w || b.d - a.d || b.pf - a.pf);

    get("rankingOutput").innerHTML = `
        <div class="tabla-container">
            <table class="tabla">
                <thead>
                    <tr><th>Posición</th><th>Dorsal</th><th>Jugad@r</th><th>PG</th><th>PF</th><th>PC</th><th>Dif</th></tr>
                </thead>
                <tbody>
                    ${sorted.map((p, i) => {
                        const pos = i + 1;
                        let claseFila = '';
                        let icono = '';

                        if (pos === 1) { claseFila = 'class="pos-1"'; icono = '🥇 '; }
                        else if (pos === 2) { claseFila = 'class="pos-2"'; icono = '🥈 '; }
                        else if (pos === 3) { claseFila = 'class="pos-3"'; icono = '🥉 '; }
                        else if (pos === 4) { claseFila = 'class="pos-4"'; icono = '🎖️ '; }
                        else if (pos === 5) { claseFila = 'class="pos-5"'; icono = '🔹 '; }
                        else if (pos === 6) { claseFila = 'class="pos-6"'; icono = '🔸 '; }

                        return `
                        <tr ${claseFila}>
                            <td><strong>${pos}º</strong></td>
                            <td><span class="dorsal-ranking">${p.dorsal}</span></td>
                            <td style="text-align:left;">${icono}${p.name}</td>
                            <td>${p.w}</td>
                            <td>${p.pf}</td>
                            <td>${p.pc}</td>
                            <td>${p.d}</td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
        </div>
        <button onclick="rank()" class="primary mt">Actualizar Ranking</button>
    `;
}

get("btnAdd").onclick = addEntry;
get("btnStart").onclick = generate;
get("btnSaveResults").onclick = () => { rank(); save(); alert("Guardado."); };
get("btnBack").onclick = () => { if(confirm("¿Cambiar modo?")) { state.mode = null; save(); location.reload(); }};
get("btnClear").onclick = () => { if(confirm("¿Borrar todo?")) { localStorage.clear(); location.reload(); }};
get("inputNombre").onkeydown = (e) => { if(e.key === 'Enter') addEntry(); };

const sel = get("selRondas") || document.createElement("select"); 
sel.id = "selRondas";
if(!get("selRondas")) {
    [3,4,5,6].forEach(n => { let o = document.createElement("option"); o.value = n; o.innerText = n + " Rondas"; sel.appendChild(o); });
    get("mainActions").insertBefore(sel, get("btnStart"));
}
init();
