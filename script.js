// script.js - Torneo Petanca (Club Torredonjimeno)
// Añadido: validación import JSON, export CSV, backups automáticos con UI (ver/restore/delete), selector 3/4/5 rondas
const LS_KEY = "petanca_torneo_v1";
const BACKUPS_KEY = LS_KEY + "_backups";

let state = {
  players: [],           // {id, name}
  rounds: [],            // [ {ronda:1, matches:[{equipoA,equipoB, scoreA, scoreB, pista}]}, ... ]
  historyPairs: {},      // "id-id" -> times been teammates
  historyFaced: {},      // "teamStr-teamStr" -> times faced
  settings: {
    roundsToGenerate: 3
  }
};

const DOM = {
  nombre: document.getElementById("nombreJugador"),
  btnAdd: document.getElementById("btnAdd"),
  listaJugadores: document.getElementById("listaJugadores"),
  btnStart: document.getElementById("btnStart"),
  btnClear: document.getElementById("btnClear"),
  sorteosCard: document.getElementById("sorteosCard"),
  rondasContainer: document.getElementById("rondasContainer"),
  rankingCard: document.getElementById("rankingCard"),
  rankingOutput: document.getElementById("rankingOutput"),
  btnCalcRanking: document.getElementById("btnCalcRanking"),
  btnWhats: document.getElementById("btnWhats"),
  btnPDF: document.getElementById("btnPDF"),
  btnSaveResults: document.getElementById("btnSaveResults"),
  btnKiosk: document.getElementById("btnKiosk"),
  optAvoidRepeat: document.getElementById("optAvoidRepeat"),
  optAssignPistas: document.getElementById("optAssignPistas"),
};

const uid = () => Math.random().toString(36).slice(2, 9);

// --- Storage helpers ---
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(raw){
    try{
      const parsed = JSON.parse(raw);
      // merge carefully
      state = Object.assign(state, parsed);
      if(!state.players) state.players = [];
      if(!state.rounds) state.rounds = [];
      if(!state.historyPairs) state.historyPairs = {};
      if(!state.historyFaced) state.historyFaced = {};
      if(!state.settings) state.settings = { roundsToGenerate: 3 };
    }catch(e){
      console.error("Error parsing state:", e);
    }
  }
}
function resetState(){
  state = { players: [], rounds: [], historyPairs: {}, historyFaced: {}, settings: { roundsToGenerate: 3 } };
  saveState();
  renderPlayers();
  DOM.sorteosCard.style.display='none';
  DOM.rondasContainer.innerHTML='';
  DOM.rankingCard.style.display='none';
  renderBackupsUI();
}

// --- Backups management ---
function loadBackups(){
  try{
    const raw = localStorage.getItem(BACKUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveBackups(list){
  localStorage.setItem(BACKUPS_KEY, JSON.stringify(list));
}
function saveBackup(label){
  // Save snapshot of current state with timestamp and label
  const list = loadBackups();
  const ts = new Date().toISOString();
  const item = { id: uid(), ts, label: label || `Export ${ts}`, state: state };
  list.unshift(item); // newest first
  // keep up to 50 backups to avoid huge storage
  saveBackups(list.slice(0, 50));
  renderBackupsUI();
}
function renderBackupsUI(){
  // create / update a backups panel inside sorteosCard
  if(!DOM.sorteosCard) return;
  // if container exists, remove to re-create
  const existing = document.getElementById("backupsPanel");
  if(existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "backupsPanel";
  panel.className = "card";
  const backups = loadBackups();
  panel.innerHTML = `<h3>Copias de seguridad (${backups.length})</h3>`;
  if(backups.length === 0){
    panel.innerHTML += `<p class="muted">No hay copias guardadas.</p>`;
  } else {
    const list = document.createElement("div");
    backups.forEach(b=>{
      const row = document.createElement("div");
      row.style.display="flex"; row.style.justifyContent="space-between"; row.style.alignItems="center"; row.style.gap="8px";
      row.style.marginBottom="8px";
      const left = document.createElement("div");
      left.innerHTML = `<strong>${new Date(b.ts).toLocaleString()}</strong><div class="muted" style="font-size:13px">${b.label}</div>`;
      const controls = document.createElement("div");
      const btnRestore = document.createElement("button");
      btnRestore.textContent = "Restaurar";
      btnRestore.className = "sec";
      btnRestore.style.marginRight="6px";
      btnRestore.onclick = ()=> {
        if(confirm("Restaurar esta copia de seguridad y reemplazar el estado actual?")) {
          state = b.state;
          saveState();
          renderPlayers();
          if(state.rounds && state.rounds.length>0){
            DOM.sorteosCard.style.display='block';
            renderRounds();
            DOM.rankingCard.style.display='block';
          }
          alert("Copia restaurada.");
        }
      };
      const btnDelete = document.createElement("button");
      btnDelete.textContent = "Eliminar";
      btnDelete.className = "rojo";
      btnDelete.onclick = ()=>{
        if(!confirm("Eliminar esta copia de seguridad?")) return;
        const newList = loadBackups().filter(x => x.id !== b.id);
        saveBackups(newList);
        renderBackupsUI();
      };
      controls.appendChild(btnRestore);
      controls.appendChild(btnDelete);
      row.appendChild(left);
      row.appendChild(controls);
      list.appendChild(row);
    });
    panel.appendChild(list);
  }
  // append after the export/import UI if present, otherwise before rondasContainer
  const importUI = document.getElementById("exportImportUI");
  if(importUI) DOM.sorteosCard.insertBefore(panel, importUI.nextSibling);
  else DOM.sorteosCard.insertBefore(panel, DOM.rondasContainer);
}

// --- Players management ---
function addPlayer(){
  const name = (DOM.nombre.value || "").trim();
  if(!name){ alert("Introduce un nombre"); return; }
  const id = state.players.length + 1;
  state.players.push({ id, name });
  DOM.nombre.value = "";
  saveState();
  renderPlayers();
}
function removePlayer(id){
  state.players = state.players.filter(p => p.id !== id).map((p,i)=>({id:i+1,name:p.name}));
  saveState();
  renderPlayers();
}
function renderPlayers(){
  const out = state.players.map(p => `
    <div class="jugador">
      <span>${p.id}. ${p.name}</span>
      <div>
        <button class="rojo" onclick="removePlayer(${p.id})">Eliminar</button>
      </div>
    </div>
  `).join("");
  DOM.listaJugadores.innerHTML = out || '<p class="muted">Aún no hay jugadores registrados.</p>';
}

// --- Distribution logic ---
function calcEnfrentamientos(N){
  if(N < 12) return 2;
  if(N < 16) return 3;
  if(N < 20) return 4;
  if(N < 24) return 5;
  if(N < 28) return 6;
  if(N < 32) return 7;
  if(N < 36) return 8;
  if(N < 40) return 9;
  return 10;
}
function calcStructure(N){
  const enf = calcEnfrentamientos(N);
  const equipos = enf * 2;
  let tripletas = 0;
  const maxDuplePlayers = equipos * 2;
  tripletas = Math.max(0, N - maxDuplePlayers);
  if(N > 40) tripletas = N - 40;
  const dupletas = equipos - tripletas;
  return { enfrentamientos: enf, equipos, dupletas, tripletas };
}

// --- Teams / Matches helpers ---
function buildTeamsFromShuffle(shuffledIds, dupletas, tripletas){
  const teams = [];
  let idx = 0;
  // dupletas first (priority)
  for(let i=0;i<dupletas;i++){
    const a = shuffledIds[idx++], b = shuffledIds[idx++];
    teams.push({ id: uid(), members: [a,b] });
  }
  for(let i=0;i<tripletas;i++){
    const a = shuffledIds[idx++], b = shuffledIds[idx++], c = shuffledIds[idx++];
    teams.push({ id: uid(), members: [a,b,c] });
  }
  return teams;
}
function teamStr(team){
  return team.members.slice().sort((a,b)=>a-b).join("-");
}
function canUseTeams(teams){
  if(!DOM.optAvoidRepeat.checked) return true;
  for(const t of teams){
    for(let i=0;i<t.members.length;i++){
      for(let j=i+1;j<t.members.length;j++){
        const key = [t.members[i], t.members[j]].sort((a,b)=>a-b).join("-");
        if((state.historyPairs[key]||0) > 0) return false;
      }
    }
  }
  return true;
}
function canUseMatches(matches){
  if(!DOM.optAvoidRepeat.checked) return true;
  for(const m of matches){
    const a=teamStr(m.equipoA), b=teamStr(m.equipoB);
    const key = [a,b].sort().join("_");
    if((state.historyFaced[key]||0) > 0) return false;
  }
  return true;
}
function pairTeams(teams){
  const matches = [];
  const copy = teams.slice();
  // shuffle teams
  for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]];}
  for(let i=0;i<copy.length;i+=2){
    matches.push({
      equipoA: copy[i],
      equipoB: copy[i+1],
      scoreA: 0, scoreB: 0,
      pista: (i/2)+1
    });
  }
  return matches;
}

// --- Rounds generation (variable rounds) ---
function generateRounds(){
  const N = state.players.length;
  if(N < 8){ alert("Se necesitan al menos 8 jugadores."); return; }
  const structure = calcStructure(N);
  const { dupletas, tripletas } = structure;
  const numRounds = parseInt(state.settings.roundsToGenerate || 3, 10) || 3;

  state.rounds = [];
  const ids = state.players.map(p=>p.id);

  for(let r=1; r<=numRounds; r++){
    let attempts=0;
    let ok=false;
    let matches=[];
    while(!ok && attempts < 500){
      attempts++;
      // shuffle ids
      const s = ids.slice();
      for(let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
      const teams = buildTeamsFromShuffle(s, dupletas, tripletas);
      const flattened = teams.flatMap(t=>t.members);
      if(flattened.length !== N) { continue; }
      if(!canUseTeams(teams)) continue;
      const ms = pairTeams(teams);
      if(!canUseMatches(ms)) continue;
      matches = ms;
      ok=true;
    }
    if(!ok){
      // relax constraints
      const s = ids.slice();
      for(let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
      const teams = buildTeamsFromShuffle(s, dupletas, tripletas);
      matches = pairTeams(teams);
    }

    // register histories
    for(const t of matches.flatMap(m=>[m.equipoA,m.equipoB])){
      for(let i=0;i<t.members.length;i++){
        for(let j=i+1;j<t.members.length;j++){
          const key=[t.members[i],t.members[j]].sort((a,b)=>a-b).join("-");
          state.historyPairs[key] = (state.historyPairs[key]||0) + 1;
        }
      }
    }
    for(const m of matches){
      const a=teamStr(m.equipoA), b=teamStr(m.equipoB), key=[a,b].sort().join("_");
      state.historyFaced[key] = (state.historyFaced[key]||0) + 1;
    }

    state.rounds.push({ ronda: r, matches });
  }

  saveState();
  renderRounds();
  DOM.sorteosCard.style.display='block';
  DOM.rankingCard.style.display='block';
  renderBackupsUI(); // keep backups visible updated
}

// --- Render rounds ---
function renderRounds(){
  const container = DOM.rondasContainer;
  container.innerHTML = "";
  state.rounds.forEach(rData=>{
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<h3>Ronda ${rData.ronda} — (${rData.matches.length} enfrentamientos)</h3>`;
    rData.matches.forEach((m, idx)=>{
      const teamA = m.equipoA.members.map(id=>playerNameById(id)).join(" - ");
      const teamB = m.equipoB.members.map(id=>playerNameById(id)).join(" - ");
      const pistaSpan = DOM.optAssignPistas.checked ? `<span class="pistaLabel">Pista ${m.pista}</span>` : "";
      const row = document.createElement("div");
      row.className = "equipoBox";
      row.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px"><strong>A:</strong> ${teamA}</div>
          <div>
            <input type="number" min="0" value="${m.scoreA||0}" id="score_${rData.ronda}_${idx}_A" style="width:70px;padding:6px;border-radius:6px;border:1px solid #ddd;">
          </div>
          <div style="font-weight:700"> - </div>
          <div>
            <input type="number" min="0" value="${m.scoreB||0}" id="score_${rData.ronda}_${idx}_B" style="width:70px;padding:6px;border-radius:6px;border:1px solid #ddd;">
          </div>
          <div style="flex:1;min-width:200px;text-align:right"><strong>B:</strong> ${teamB} ${pistaSpan}</div>
        </div>
      `;
      div.appendChild(row);
    });
    container.appendChild(div);
  });
}

// --- Helpers ---
function playerNameById(id){
  const p = state.players.find(x=>x.id===id);
  return p ? p.name : `J${id}`;
}
function readScoresIntoState(){
  state.rounds.forEach(rData=>{
    rData.matches.forEach((m, idx)=>{
      const elA = document.getElementById(`score_${rData.ronda}_${idx}_A`);
      const elB = document.getElementById(`score_${rData.ronda}_${idx}_B`);
      const a = elA ? parseInt(elA.value) || 0 : 0;
      const b = elB ? parseInt(elB.value) || 0 : 0;
      m.scoreA = a; m.scoreB = b;
    });
  });
  saveState();
}

// --- Ranking ---
function calculateRanking(){
  readScoresIntoState();
  const stats = {};
  state.players.forEach(p => {
    stats[p.id] = { id: p.id, name: p.name, wins: 0, losses:0, bf:0, bc:0, avg:0 };
  });

  state.rounds.forEach(r=>{
    r.matches.forEach(m=>{
      const a = m.scoreA || 0, b = m.scoreB || 0;
      m.equipoA.members.forEach(pid=>{
        stats[pid].bf += a; stats[pid].bc += b; stats[pid].avg += (a - b);
      });
      m.equipoB.members.forEach(pid=>{
        stats[pid].bf += b; stats[pid].bc += a; stats[pid].avg += (b - a);
      });
      if(a > b){
        m.equipoA.members.forEach(pid=> stats[pid].wins++ );
        m.equipoB.members.forEach(pid=> stats[pid].losses++ );
      } else if(b > a){
        m.equipoB.members.forEach(pid=> stats[pid].wins++ );
        m.equipoA.members.forEach(pid=> stats[pid].losses++ );
      }
    });
  });

  let arr = Object.values(stats);
  arr.sort((x,y)=>{
    if(y.wins !== x.wins) return y.wins - x.wins;
    if(y.avg !== x.avg) return y.avg - x.avg;
    return y.bf - x.bf;
  });

  renderRanking(arr);
  return arr;
}
function renderRanking(arr){
  const container = DOM.rankingOutput;
  const rows = arr.map((p,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${p.id}</td>
      <td style="text-align:left;font-weight:700">${p.name}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.bf}</td>
      <td>${p.bc}</td>
      <td>${p.avg}</td>
    </tr>
  `).join("");
  container.innerHTML = `
    <table class="tabla" style="width:100%">
      <thead>
        <tr><th>Pos</th><th>ID</th><th>Jugador</th><th>PG</th><th>PP</th><th>PF</th><th>PC</th><th>Avg</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// --- Share / PDF / CSV / Export JSON ---
// Share WhatsApp
function shareWhatsApp(){
  const arr = calculateRanking();
  let text = `Ranking Torneo - Club Petanca Torredonjimeno\n\n`;
  arr.forEach((p,i)=>{
    text += `${i+1}. ${p.name} — Vict: ${p.wins} — Avg: ${p.avg} — BF: ${p.bf}\n`;
  });
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
// Export PDF (keeps backup)
async function exportPDF(){
  const printNode = document.createElement("div");
  printNode.style.padding = "18px";
  printNode.style.background = "#fff";
  printNode.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <img src="ESCUDO CP TORREDONJIMENO OK.png" style="width:80px;height:80px;object-fit:contain"/>
      <div><h2 style="margin:0">Club de Petanca Torredonjimeno</h2><div style="font-size:14px;margin-top:6px">Ranking Torneo</div></div>
    </div>
    <hr style="margin:12px 0"/>
  `;

  const arr = calculateRanking();
  const table = document.createElement("table");
  table.style.width="100%";
  table.style.borderCollapse="collapse";
  let rows = `<tr><th style="border-bottom:1px solid #ddd;padding:6px">Pos</th><th style="padding:6px">Jugador</th><th style="padding:6px">Vict</th><th style="padding:6px">Avg</th><th style="padding:6px">BF</th></tr>`;
  arr.forEach((p,i)=> rows += `<tr><td style="padding:6px">${i+1}</td><td style="padding:6px">${p.name}</td><td style="padding:6px">${p.wins}</td><td style="padding:6px">${p.avg}</td><td style="padding:6px">${p.bf}</td></tr>`);
  table.innerHTML = rows;
  printNode.appendChild(table);
  document.body.appendChild(printNode);

  const canvas = await html2canvas(printNode, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
  const filename = `ranking_torneo_petanca_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`;
  pdf.save(filename);

  document.body.removeChild(printNode);
  // backup
  saveBackup(`PDF export: ${filename}`);
}
// Export JSON snapshot (with backup)
function exportJSON(){
  const snapshot = JSON.stringify(state, null, 2);
  const blob = new Blob([snapshot], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = (new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `petanca_torneo_export_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  saveBackup(`JSON export: ${a.download || date}`);
  alert("Exportado JSON y backup guardado.");
}
// Export CSV (ranking) (with backup)
function exportCSV(){
  const arr = calculateRanking();
  // CSV header
  const header = ["Pos","ID","Jugador","Victorias","Derrotas","BolasFavor","BolasContra","Average"];
  const lines = [header.join(";")];
  arr.forEach((p,i)=>{
    const row = [i+1, p.id, `"${p.name.replace(/\"/g,'\"\"')}"`, p.wins, p.losses, p.bf, p.bc, p.avg];
    lines.push(row.join(";"));
  });
  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = (new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `petanca_ranking_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  saveBackup(`CSV export: ${a.download || date}`);
  alert("CSV exportado y backup guardado.");
}

// --- Save / Kiosk ---
function saveResults(){
  readScoresIntoState();
  saveState();
  alert("Resultados guardados en este navegador (localStorage).");
}
async function toggleKiosk(){
  if(!document.fullscreenElement){
    await document.documentElement.requestFullscreen();
    DOM.btnKiosk.textContent = "Salir Kiosko";
  } else {
    await document.exitFullscreen();
    DOM.btnKiosk.textContent = "Modo Kiosko";
  }
}

// --- Export / Import UI (create buttons + file input) ---
function createExportImportUI(){
  if(document.getElementById("exportImportUI")) return;
  const div = document.createElement("div");
  div.id = "exportImportUI";
  div.style.display = "flex";
  div.style.gap = "8px";
  div.style.marginBottom = "12px";

  // Export JSON button
  const btnExportJSON = document.createElement("button");
  btnExportJSON.id = "btnExportJSON";
  btnExportJSON.textContent = "Exportar JSON";
  btnExportJSON.className = "sec";
  btnExportJSON.onclick = exportJSON;

  // Export CSV
  const btnExportCSV = document.createElement("button");
  btnExportCSV.id = "btnExportCSV";
  btnExportCSV.textContent = "Exportar CSV";
  btnExportCSV.className = "sec";
  btnExportCSV.onclick = exportCSV;

  // Import
  const btnImport = document.createElement("button");
  btnImport.id = "btnImportData";
  btnImport.textContent = "Importar JSON";
  btnImport.className = "sec";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.style.display = "none";
  fileInput.id = "importFileInput";
  fileInput.addEventListener("change", (e)=>{
    const f = e.target.files[0];
    if(f) importDataFromFile(f);
    fileInput.value = "";
  });

  btnImport.addEventListener("click", ()=> fileInput.click());

  div.appendChild(btnExportJSON);
  div.appendChild(btnExportCSV);
  div.appendChild(btnImport);
  div.appendChild(fileInput);

  DOM.sorteosCard.insertBefore(div, DOM.rondasContainer);
}

// --- Import with validation ---
function validateImportedData(parsed){
  const errors = [];
  // top-level checks
  if(!parsed || typeof parsed !== 'object') { errors.push("El JSON no es un objeto válido."); return errors; }
  if(!Array.isArray(parsed.players) && !Array.isArray(parsed.players || parsed.jugadores)) {
    errors.push('Falta campo "players" (array de jugadores).');
  }
  const players = parsed.players || parsed.jugadores;
  if(players && (!Array.isArray(players) || players.length < 1)) errors.push('"players" debe ser un array con al menos 1 elemento.');

  // rounds
  const rounds = parsed.rounds || parsed.rondas;
  if(!rounds || !Array.isArray(rounds)) errors.push('Falta campo "rounds" (array).');
  else {
    rounds.forEach((r, ri)=>{
      if(!r.matches || !Array.isArray(r.matches)) errors.push(`Ronda ${ri+1}: falta campo "matches" (array).`);
      else {
        r.matches.forEach((m, mi)=>{
          if(!m.equipoA || !m.equipoB) errors.push(`Ronda ${ri+1} partido ${mi+1}: falta equipoA o equipoB.`);
          else {
            const aMembers = m.equipoA.members || (m.equipoA.miembros) || null;
            const bMembers = m.equipoB.members || (m.equipoB.miembros) || null;
            if(!Array.isArray(aMembers) || aMembers.length<1) errors.push(`Ronda ${ri+1} partido ${mi+1}: equipoA debe tener miembros.`);
            if(!Array.isArray(bMembers) || bMembers.length<1) errors.push(`Ronda ${ri+1} partido ${mi+1}: equipoB debe tener miembros.`);
          }
        });
      }
    });
  }

  // players vs rounds consistency
  if(players && rounds){
    const declaredN = players.length;
    const usedIds = new Set();
    rounds.forEach(r=>{
      (r.matches||[]).forEach(m=>{
        const all = [];
        if(m.equipoA && Array.isArray(m.equipoA.members)) all.push(...m.equipoA.members);
        if(m.equipoB && Array.isArray(m.equipoB.members)) all.push(...m.equipoB.members);
        all.forEach(id => usedIds.add(id));
      });
    });
    // it's ok if not all players appear in rounds (new import) but we check for invalid ids
    for(const id of usedIds){
      if(typeof id !== 'number' || id < 1 || id > declaredN) {
        errors.push(`ID de jugador inválido en rondas: ${id} (debe ser número entre 1 y ${declaredN}).`);
      }
    }
  }

  return errors;
}

function importDataFromFile(file){
  const reader = new FileReader();
  reader.onload = function(evt){
    try{
      const parsed = JSON.parse(evt.target.result);
      const errors = validateImportedData(parsed);
      if(errors.length){
        alert("Error al importar:\n" + errors.join("\n"));
        return;
      }
      // Map alt keys if necessary
      // Ensure players use {id, name}
      const players = parsed.players || parsed.jugadores || [];
      const normalizedPlayers = players.map((p,i)=>({ id: i+1, name: p.name || p.nombre || (`J${i+1}`) }));
      // rounds: ensure structure matches our internal format
      const roundsRaw = parsed.rounds || parsed.rondas || [];
      const normalizedRounds = roundsRaw.map((r,ri)=>{
        const matches = (r.matches||r.partidos||[]).map(m=>{
          // expected: m.equipoA { members: [ids] } etc.
          const ea = m.equipoA || m.a;
          const eb = m.equipoB || m.b;
          return {
            equipoA: { id: uid(), members: ea.members || ea.miembros || [] },
            equipoB: { id: uid(), members: eb.members || eb.miembros || [] },
            scoreA: m.scoreA || m.score_a || 0,
            scoreB: m.scoreB || m.score_b || 0,
            pista: m.pista || null
          };
        });
        return { ronda: r.ronda || ri+1, matches };
      });

      // Overwrite state but keep settings if present
      state.players = normalizedPlayers;
      state.rounds = normalizedRounds;
      state.historyPairs = parsed.historyPairs || parsed.historialParejas || {};
      state.historyFaced = parsed.historyFaced || parsed.historialEnfrentamientos || {};
      state.settings = parsed.settings || state.settings || { roundsToGenerate: 3 };
      saveState();
      renderPlayers();
      if(state.rounds && state.rounds.length>0){
        DOM.sorteosCard.style.display='block';
        renderRounds();
        DOM.rankingCard.style.display='block';
      }
      alert("Datos importados correctamente.");
      saveBackup("Import JSON (manual)");
    }catch(e){
      alert("Error al leer el fichero: " + e.message);
    }
  };
  reader.readAsText(file);
}

// --- Create rounds selector UI (3/4/5) ---
function createRoundsSelector(){
  if(document.getElementById("selectRounds")) return;
  const container = DOM.btnStart.parentElement;
  if(!container) return;
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  const label = document.createElement("label");
  label.style.fontSize = "14px";
  label.style.fontWeight = "600";
  label.textContent = "Rondas:";
  const select = document.createElement("select");
  select.id = "selectRounds";
  select.style.padding = "8px";
  select.style.borderRadius = "6px";
  [3,4,5].forEach(n=>{
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n + " rondas";
    select.appendChild(opt);
  });
  select.value = state.settings.roundsToGenerate || 3;
  select.addEventListener("change", ()=>{
    state.settings.roundsToGenerate = parseInt(select.value,10);
    saveState();
  });
  wrapper.appendChild(label);
  wrapper.appendChild(select);
  container.insertBefore(wrapper, DOM.btnStart);
}

// --- Wire events & boot ---
function wireEvents(){
  DOM.btnAdd.addEventListener('click', ()=>{ addPlayer(); });
  DOM.btnStart.addEventListener('click', ()=>{ generateRounds(); });
  DOM.btnClear.addEventListener('click', ()=>{ if(confirm('Limpiar todos los datos?')) resetState(); });
  DOM.btnCalcRanking.addEventListener('click', ()=>{ calculateRanking(); });
  DOM.btnWhats.addEventListener('click', ()=>{ shareWhatsApp(); });
  DOM.btnPDF.addEventListener('click', ()=>{ exportPDF(); });
  DOM.btnSaveResults.addEventListener('click', ()=>{ saveResults(); });
  DOM.btnKiosk.addEventListener('click', ()=>{ toggleKiosk(); });
  // keyboard: enter to add
  DOM.nombre.addEventListener('keydown', e=>{ if(e.key==='Enter'){ addPlayer(); }});
}

// --- Boot ---
loadState();
renderPlayers();
createRoundsSelector();
createExportImportUI();
renderBackupsUI();
wireEvents();
if(state.rounds && state.rounds.length>0){
  DOM.sorteosCard.style.display='block';
  DOM.rondasContainer.innerHTML=''; renderRounds();
  DOM.rankingCard.style.display='block';
}
