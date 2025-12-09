// script.js - Torneo Petanca (Club Torredonjimeno)
// Requisitos implementados:
// - guardado automático en localStorage
// - 3 sorteos, control de pistas, prevención de repeticiones
// - introducir resultados, calcular ranking (victorias>avg>favor)
// - compartir ranking por WhatsApp
// - exportar ranking a PDF (html2canvas + jsPDF)
// - modo kiosko (pantalla completa)

const LS_KEY = "petanca_torneo_v1";

let state = {
  players: [],           // {id, name}
  rounds: [],            // [ {ronda:1, matches:[{equipoA,equipoB, scoreA, scoreB, pista}]}, ... ]
  historyPairs: {},      // "id-id" -> times been teammates
  historyFaced: {},      // "teamStr-teamStr" -> times faced
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

// util
const uid = () => Math.random().toString(36).slice(2, 9);

function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(raw){
    try{
      state = JSON.parse(raw);
      if(!state.players) state.players = [];
      if(!state.rounds) state.rounds = [];
      if(!state.historyPairs) state.historyPairs = {};
      if(!state.historyFaced) state.historyFaced = {};
    }catch(e){}
  }
}

function resetState(){
  state = { players: [], rounds: [], historyPairs: {}, historyFaced: {} };
  saveState();
  renderPlayers();
  DOM.sorteosCard.style.display='none';
  DOM.rondasContainer.innerHTML='';
  DOM.rankingCard.style.display='none';
}

// players management
function addPlayer(){
  const name = DOM.nombre.value.trim();
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

// distribution logic (same pattern you provided)
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
  // same strategy you gave: maximize dupletas, tripletas = overflow when players > space for dupletas*2
  const maxDuplePlayers = equipos * 2;
  tripletas = Math.max(0, N - maxDuplePlayers);
  if(N > 40) tripletas = N - 40; // as your rule
  const dupletas = equipos - tripletas;
  return { enfrentamientos: enf, equipos, dupletas, tripletas };
}

// create teams from shuffled players, using names
function buildTeamsFromShuffle(shuffledIds, dupletas, tripletas){
  const teams = [];
  let idx = 0;
  // first dupletas (we'll draw dupletas first to match earlier table priority)
  for(let i=0;i<dupletas;i++){
    const a = shuffledIds[idx++], b = shuffledIds[idx++];
    teams.push({ id: uid(), members: [a,b] });
  }
  // then tripletas
  for(let i=0;i<tripletas;i++){
    const a = shuffledIds[idx++], b = shuffledIds[idx++], c = shuffledIds[idx++];
    teams.push({ id: uid(), members: [a,b,c] });
  }
  return teams;
}

// helper: team string unique
function teamStr(team){
  return team.members.slice().sort((a,b)=>a-b).join("-");
}

// check teammates repetition allowed?
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

// check faced repetition
function canUseMatches(matches){
  if(!DOM.optAvoidRepeat.checked) return true;
  for(const m of matches){
    const a=teamStr(m.equipoA), b=teamStr(m.equipoB);
    const key = [a,b].sort().join("_");
    if((state.historyFaced[key]||0) > 0) return false;
  }
  return true;
}

// pair teams into matches and optionally assign pistas
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

// generate 3 rounds with constraints
function generateRounds(){
  const N = state.players.length;
  if(N < 8){ alert("Se necesitan al menos 8 jugadores."); return; }
  const structure = calcStructure(N);
  const { dupletas, tripletas, enfrentamientos } = structure;

  state.rounds = [];
  // prepare id array
  const ids = state.players.map(p=>p.id);

  for(let r=1;r<=3;r++){
    let attempts=0;
    let ok=false;
    let matches=[];
    while(!ok && attempts < 300){
      attempts++;
      // shuffle ids
      const s = ids.slice();
      for(let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
      const teams = buildTeamsFromShuffle(s, dupletas, tripletas);
      // simple check: all players should be included
      const flattened = teams.flatMap(t=>t.members);
      if(flattened.length !== N) { continue; } // not matched
      if(!canUseTeams(teams)) continue;
      const ms = pairTeams(teams);
      if(!canUseMatches(ms)) continue;
      matches = ms;
      ok=true;
    }
    if(!ok){
      // relax constraints: accept first valid
      const s = ids.slice();
      for(let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
      const teams = buildTeamsFromShuffle(s, dupletas, tripletas);
      matches = pairTeams(teams);
    }

    // register history pairs/faced
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
}

// render rounds and input fields for scores
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
            <input type="number" min="0" value="${m.scoreA}" id="score_${rData.ronda}_${idx}_A" style="width:70px;padding:6px;border-radius:6px;border:1px solid #ddd;">
          </div>
          <div style="font-weight:700"> - </div>
          <div>
            <input type="number" min="0" value="${m.scoreB}" id="score_${rData.ronda}_${idx}_B" style="width:70px;padding:6px;border-radius:6px;border:1px solid #ddd;">
          </div>
          <div style="flex:1;min-width:200px;text-align:right"><strong>B:</strong> ${teamB} ${pistaSpan}</div>
        </div>
      `;
      div.appendChild(row);
    });
    container.appendChild(div);
  });
}

// helper to get name
function playerNameById(id){
  const p = state.players.find(x=>x.id===id);
  return p ? p.name : `J${id}`;
}

// read scores from DOM into state
function readScoresIntoState(){
  state.rounds.forEach(rData=>{
    rData.matches.forEach((m, idx)=>{
      const a = parseInt(document.getElementById(`score_${rData.ronda}_${idx}_A`).value) || 0;
      const b = parseInt(document.getElementById(`score_${rData.ronda}_${idx}_B`).value) || 0;
      m.scoreA = a; m.scoreB = b;
    });
  });
  saveState();
}

// calculate ranking per rules
function calculateRanking(){
  readScoresIntoState();
  // init per player
  const stats = {};
  state.players.forEach(p => {
    stats[p.id] = { id: p.id, name: p.name, wins: 0, losses:0, bf:0, bc:0, avg:0 };
  });

  state.rounds.forEach(r=>{
    r.matches.forEach(m=>{
      const a = m.scoreA, b = m.scoreB;
      // update team players
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
      } // empate = ninguno
    });
  });

  // to array and sort
  let arr = Object.values(stats);
  arr.sort((x,y)=>{
    if(y.wins !== x.wins) return y.wins - x.wins;          // wins desc
    if(y.avg !== x.avg) return y.avg - x.avg;              // average desc
    return y.bf - x.bf;                                    // bf desc
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
        <tr><th>Pos</th><th>ID</th><th>Jugador</th><th>Vict</th><th>Der</th><th>BF</th><th>BC</th><th>Avg</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// share whatsapp
function shareWhatsApp(){
  const arr = calculateRanking();
  let text = `Ranking Torneo - Club Petanca Torredonjimeno\n\n`;
  arr.forEach((p,i)=>{
    text += `${i+1}. ${p.name} — Vict: ${p.wins} — Avg: ${p.avg} — BF: ${p.bf}\n`;
  });
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

// export to PDF (uses html2canvas + jsPDF)
async function exportPDF(){
  // build a printable view
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
  pdf.save('ranking_torneo_petanca.pdf');

  document.body.removeChild(printNode);
}

// load/save rounds and scores
function saveResults(){
  readScoresIntoState();
  saveState();
  alert("Resultados guardados en este navegador (localStorage).");
}

// kiosk: toggle fullscreen
async function toggleKiosk(){
  if(!document.fullscreenElement){
    await document.documentElement.requestFullscreen();
    DOM.btnKiosk.textContent = "Salir Kiosko";
  } else {
    await document.exitFullscreen();
    DOM.btnKiosk.textContent = "Modo Kiosko";
  }
}

// wire events
DOM.btnAdd.addEventListener('click', ()=>{ addPlayer(); });
DOM.btnStart.addEventListener('click', ()=>{ generateRounds(); });
DOM.btnClear.addEventListener('click', ()=>{ if(confirm('Limpiar todos los datos?')) resetState(); });
DOM.btnCalcRanking.addEventListener('click', ()=>{ calculateRanking(); });
DOM.btnWhats.addEventListener('click', ()=>{ shareWhatsApp(); });
DOM.btnPDF.addEventListener('click', ()=>{ exportPDF(); });
DOM.btnSaveResults.addEventListener('click', ()=>{ saveResults(); });
DOM.btnKiosk.addEventListener('click', ()=>{ toggleKiosk(); });

// init
loadState();
renderPlayers();
if(state.rounds && state.rounds.length>0){
  DOM.sorteosCard.style.display='block';
  DOM.rondasContainer.innerHTML=''; renderRounds();
  DOM.rankingCard.style.display='block';
}
