"use strict";
/* ===================== Speicher ===================== */
const KEY = "foxstanze.v1";
function load(){
  try{ const d = JSON.parse(localStorage.getItem(KEY)); if(d && d.jobs) return d; }catch(e){}
  return null;
}
let DB = Object.assign({jobs:[], shifts:[], notes:{}, quizBest:0, theme:"auto", seeded:false, fehler:null, checklist:null, checkDone:[], timer:null, remind:null}, load() || {});
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); return true; }
  catch(e){ toast("Speicher voll – bitte Fotos löschen oder sichern"); return false; }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { let t = String(v ?? "").trim().replace(/\s/g,""); if(t.includes(",")) t = t.replace(/\./g,"").replace(",", "."); const n = parseFloat(t); return isNaN(n) ? null : n; };
const CAP = window.Capacitor, NATIVE = !!(CAP && CAP.nativePromise);
const capCall = (plugin, method, opts) => NATIVE ? CAP.nativePromise(plugin, method, opts || {}) : Promise.reject("web");
const fmt = (n, d=0) => n == null || isNaN(n) ? "–" : n.toLocaleString("de-DE",{minimumFractionDigits:d, maximumFractionDigits:d});
const today = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const dDE = iso => iso ? iso.split("-").reverse().join(".") : "";
function toast(t){ const el=document.createElement("div"); el.className="toast"; el.textContent=t; document.body.appendChild(el); setTimeout(()=>el.remove(),2200); }

/* ===================== Rüstblatt-Aufbau ===================== */
/* Felder angelehnt an die Bildschirme der Göpfert-Bedienung. AS = Antriebsseite, BS = Bedienseite. */
const SECTIONS = [
  {id:"anleger", icon:"📥", title:"Anleger", fields:[
    {k:"anl_seitenf_as", l:"Seitenführung AS", u:"mm", h:"Bildschirm: 634,0 (gekoppelt 🔗)"},
    {k:"anl_seitenf_bs", l:"Seitenführung BS", u:"mm", h:"Bildschirm: −634,0"},
    {k:"anl_anschlag_pos_as", l:"Anschlag Position AS", u:"mm", h:"Bildschirm: 500"},
    {k:"anl_anschlag_pos_bs", l:"Anschlag Position BS", u:"mm", h:"Bildschirm: −500"},
    {k:"anl_anschlag_h_as", l:"Anschlag Höhe AS", u:"mm", h:"Bildschirm: 1,8"},
    {k:"anl_anschlag_h_bs", l:"Anschlag Höhe BS", u:"mm", h:"Bildschirm: 1,8"},
    {k:"anl_hinteranschlag", l:"Hinteranschlag", u:"mm", h:"Bildschirm: 1235 (Format)"},
    {k:"anl_band", l:"Band / Transport", u:"", h:"Bildschirm: 1,5"},
    {k:"anl_sensor", l:"Sensor-Wert", u:"", h:"Bildschirm: 32 / 52"},
    {k:"anl_walze", l:"Walze / Einzug Höhe", u:"", h:"Bildschirm: 0"},
    {k:"anl_geblaese", l:"Gebläse", u:"", h:"Bildschirm: 0"},
  ]},
  {id:"stanze", icon:"🔨", title:"Stanze (Tiegel)", fields:[
    {k:"st_spalt_as", l:"Spalt AS", u:"mm", h:"Bildschirm: −1,34 (gekoppelt 🔗)"},
    {k:"st_spalt_bs", l:"Spalt BS", u:"mm", h:"Bildschirm: −1,34"},
    {k:"st_druck", l:"Druck", u:"t", h:"Bildschirm: 238 t"},
    {k:"st_tiegel", l:"Position Tiegel", u:"°", h:"Bildschirm: 184,4"},
    {k:"st_temp1", l:"Temperatur 1", u:"°C", h:"Bildschirm: 38,1"},
    {k:"st_temp2", l:"Temperatur 2", u:"°C", h:"Bildschirm: 38,7"},
    {k:"st_werkzeug", l:"Stanzwerkzeug-Nr.", u:"", h:"", full:true, text:true},
    {k:"st_zurichtung", l:"Zurichtung / Unterlage", u:"", h:"z. B. wo Papier untergelegt wurde", full:true, text:true},
  ]},
  {id:"ausbrech", icon:"🪓", title:"Ausbrechstation", fields:[
    {k:"ab_seitenf_as", l:"Seitenführung AS", u:"mm", h:"Bildschirm: 524 (gekoppelt 🔗)"},
    {k:"ab_seitenf_bs", l:"Seitenführung BS", u:"mm", h:"Bildschirm: −537"},
    {k:"ab_hoehe", l:"Höhe Oberteil", u:"mm", h:"Bildschirm: 0"},
    {k:"ab_laenge", l:"Format / Anschlag", u:"mm", h:"Bildschirm: 1282"},
    {k:"ab_unter", l:"Unterteil Position", u:"mm", h:"Bildschirm: 1007"},
    {k:"ab_werkzeug", l:"Ausbrechwerkzeug-Nr.", u:"", h:"", full:true, text:true},
  ]},
  {id:"ablage", icon:"📦", title:"Bogenablager", fields:[
    {k:"bl_seitenf_as", l:"Seitenführung AS", u:"mm", h:"Bildschirm: 625 (gekoppelt 🔗)"},
    {k:"bl_seitenf_bs", l:"Seitenführung BS", u:"mm", h:"Bildschirm: −626"},
    {k:"bl_hinten", l:"Hinteranschlag", u:"mm", h:"Bildschirm: 1205"},
    {k:"bl_buerste", l:"Bürstenwalze", u:"", h:"Bildschirm: 48"},
    {k:"bl_klappe", l:"Klappe / Neigung", u:"", h:"Bildschirm: 0,0"},
    {k:"bl_stapel", l:"Stapelhöhe", u:"", h:"Bildschirm: 100"},
  ]},
  {id:"auslauf", icon:"➡️", title:"Austransport", fields:[
    {k:"au_band", l:"Bandgeschwindigkeit", u:"", h:"Bildschirm: 50"},
    {k:"au_takt", l:"Zeit", u:"s", h:"Bildschirm: 0,5"},
    {k:"au_hoehe", l:"Höhe", u:"mm", h:"Bildschirm: 555"},
  ]},
  {id:"stopper", icon:"🚦", title:"Stopperüberwachung", fields:[
    {k:"sp_kp1", l:"Kontrollpunkt 1", u:"mm", h:"Abstand zur Bogenvorderkante · Bildschirm: 150"},
    {k:"sp_kp2", l:"Kontrollpunkt 2", u:"mm", h:"Bildschirm: 1085"},
  ]},
  {id:"pal", icon:"🧱", title:"Palettierer (Corrpal)", fields:[
    {k:"pal_buendelh", l:"Bündelhöhe", u:"mm", h:"Auftrag › Allgemein · Bildschirm: 130"},
    {k:"pal_lagen", l:"Lagenanzahl", u:"", h:"Bildschirm: 10"},
    {k:"pal_eintrans", l:"Eintransport (Bündelmaß / Anordnung)", u:"", h:"z. B. 998 x 464, 2 Bündel", full:true, text:true},
    {k:"pal_palette", l:"Palettenformat", u:"", h:"z. B. Europalette 800 x 1200 x 150", full:true, text:true},
    {k:"pal_lagenformat", l:"Lagenformat / Muster", u:"", h:"z. B. 928 x 998, Muster 1", full:true, text:true},
    {k:"pal_brecher1", l:"Zyklen Brecher 1", u:"", h:"Bildschirm: 1"},
    {k:"pal_brecher2", l:"Zyklen Brecher 2", u:"", h:"Bildschirm: 1"},
    {k:"pal_sammeln", l:"Vor Brechen nicht sammeln", u:"", h:"an / aus", full:true, text:true},
    {k:"pal_zwbogen", l:"Zwischenbogen", u:"", h:"Keine / Alle / 1,3,5 / 2,4,6 / eigene", full:true, text:true},
    {k:"pal_wenden", l:"Lage wenden", u:"", h:"Keine / Alle / 1,3,5 / 2,4,6", full:true, text:true},
    {k:"pal_ausrichten", l:"Stapel ausrichten", u:"", h:"Keine / Alle / 1,3,5 / 2,4,6", full:true, text:true},
    {k:"pal_schutzbogen", l:"Schutzbogen", u:"", h:"z. B. ganz / halb / Viertel", full:true, text:true},
    {k:"pal_schutzmass", l:"Schutzbogenmaß", u:"mm", h:"Bildschirm: 0"},
    {k:"pal_v_band", l:"Band", u:"%", h:"Geschwindigkeit · Bildschirm: 60"},
    {k:"pal_a_band", l:"Band Beschleunigung", u:"%", h:"Bildschirm: 60"},
    {k:"pal_v_dreh", l:"Drehung", u:"%", h:"Bildschirm: 60"},
    {k:"pal_a_dreh", l:"Drehung Beschleunigung", u:"%", h:"Bildschirm: 60"},
    {k:"pal_v_gabel", l:"Gabel", u:"%", h:"Bildschirm: 60"},
    {k:"pal_a_gabel", l:"Gabel Beschleunigung", u:"%", h:"Bildschirm: 60"},
    {k:"pal_v_lift", l:"Lift", u:"%", h:"Bildschirm: 60"},
    {k:"pal_a_lift", l:"Lift Beschleunigung", u:"%", h:"Bildschirm: 60"},
  ]},
];
const JOB_TOGGLES = [
  {k:"einschub", l:"Einschub Automatik"},
  {k:"bremsbuerste", l:"Bremsbürste"},
];

/* Beispiel von deinen Fotos (18.11.2026) */
function seed(){
  if(DB.seeded) return;
  DB.seeded = true;
  DB.jobs.push({
    id: uid(), kunde:"Seyfert", artikel:"6040", format:"1235 x 1268", dicke:"1,2",
    speed:"3300", leerhuebe:"4", einschub:true, bremsbuerste:true,
    notiz:"Beispiel – Werte von den Fotos vom 18.11.2026. Ausstoß lag bei 3173 Stck/h.",
    values:{anl_seitenf_as:"634,0",anl_seitenf_bs:"-634,0",anl_anschlag_pos_as:"500",anl_anschlag_pos_bs:"-500",anl_anschlag_h_as:"1,8",anl_anschlag_h_bs:"1,8",anl_hinteranschlag:"1235",anl_band:"1,5",anl_sensor:"32 / 52",anl_walze:"0",anl_geblaese:"0",
      st_spalt_as:"-1,34",st_spalt_bs:"-1,34",st_druck:"238",st_tiegel:"184,4",st_temp1:"38,1",st_temp2:"38,7",
      ab_seitenf_as:"524",ab_seitenf_bs:"-537",ab_hoehe:"0",ab_laenge:"1282",ab_unter:"1007",
      bl_seitenf_as:"625",bl_seitenf_bs:"-626",bl_hinten:"1205",bl_buerste:"48",bl_klappe:"0,0",bl_stapel:"100",
      au_band:"50",au_takt:"0,5",au_hoehe:"555",sp_kp1:"150",sp_kp2:"1085"},
    extra:{}, photos:[], created:Date.now(), updated:Date.now(), used:Date.now()
  });
  save();
}

/* ===================== Navigation ===================== */
let TAB = "ruesten", SUB = null;
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { TAB = b.dataset.tab; SUB = null; render(); scrollTo(0,0); });
function render(){
  if(typeof simStop==="function" && SUB!=="palsim") simStop();
  if(typeof gStopAnim==="function" && SUB!=="gsim") gStopAnim();
  if(typeof gPalStop==="function") gPalStop();
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === TAB));
  const v = document.getElementById("view");
  ({ruesten:viewRuesten, schicht:viewSchicht, wissen:viewWissen, rechner:viewRechner})[TAB](v);
  drawTimer();
}

/* ===================== RÜSTEN ===================== */
let jobFilter = "";
const ALL_FIELDS = SECTIONS.flatMap(s => s.fields.map(f => Object.assign({sec:s.title}, f)));
const JOB_BASE = [["artikel","Artikel"],["kunde","Kunde"],["format","Format"],["dicke","Bogendicke"],["speed","Geschwindigkeit"],["leerhuebe","Leerhübe"],["buendel","Bogen pro Bündel"]];
function snapshot(j){
  return {t:Date.now(), values:Object.assign({}, j.values), base:Object.fromEntries(JOB_BASE.map(([k])=>[k,j[k]||""])),
    extra:JSON.parse(JSON.stringify(j.extra||{})), einschub:!!j.einschub, bremsbuerste:!!j.bremsbuerste};
}
function diffSnap(a, b){ /* Änderungen von a (alt) nach b (neu) */
  const out = [];
  if(!a) return out;
  for(const [k,l] of JOB_BASE) if((a.base[k]||"") !== (b.base[k]||"")) out.push({l, alt:a.base[k], neu:b.base[k]});
  for(const f of ALL_FIELDS) if((a.values[f.k]||"") !== (b.values[f.k]||"")) out.push({k:f.k, l:f.sec+" · "+f.l, alt:a.values[f.k], neu:b.values[f.k]});
  for(const t of JOB_TOGGLES) if(!!a[t.k] !== !!b[t.k]) out.push({l:t.l, alt:a[t.k]?"an":"aus", neu:b[t.k]?"an":"aus"});
  const ex = s => JSON.stringify(s.extra||{});
  if(ex(a) !== ex(b)) out.push({l:"Eigene Werte", alt:"", neu:"geändert"});
  return out;
}
function viewRuesten(v){
  if(SUB === "gsim") return viewGSim(v);
  if(SUB) return viewJob(v, SUB);
  const list = DB.jobs.filter(j => (j.artikel+" "+j.kunde+" "+(j.notiz||"")).toLowerCase().includes(jobFilter.toLowerCase()))
    .sort((a,b) => (b.used||b.updated) - (a.used||a.updated));
  v.innerHTML = `
    <div class="hero"><div class="big">🧰</div><small>Rüstblätter</small><h1>${DB.jobs.length} Artikel gespeichert</h1>
      <p>Einstellwerte pro Artikel ablegen – beim nächsten Auftrag einfach aufrufen und übernehmen.</p></div>
    <div class="row" style="margin-bottom:10px"><input id="q" placeholder="🔍 Artikel oder Kunde suchen" value="${esc(jobFilter)}" style="flex:3">
      <label class="ib" style="flex:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;gap:4px;cursor:pointer">▦ QR<input type="file" accept="image/*" capture="environment" id="qrIn" hidden></label></div>
    <div id="list">${list.length ? list.map(j => `
      <div class="item" data-id="${j.id}"><div class="t"><b>Artikel ${esc(j.artikel)||"–"}</b>
        <small>${esc(j.kunde)} · ${esc(j.format)||"Format ?"} · ${esc(j.dicke)?esc(j.dicke)+" mm":""} ${j.photos&&j.photos.length?"· 📷"+j.photos.length:""}</small>
        <small>Geändert ${new Date(j.updated).toLocaleDateString("de-DE")}${(j.ruestzeiten||[]).length?" · ⏱️ Ø "+durTxt(avg(j.ruestzeiten.map(r=>r.dur))):""}</small></div><div class="go">›</div></div>`).join("")
      : `<div class="empty">Nichts gefunden.</div>`}</div>
    <button class="btn fox" id="newJob">＋ Neuer Artikel</button>
    <button class="btn" id="gSimBtn">🎬 Neuen Auftrag simulieren</button>`;
  const q = v.querySelector("#q");
  q.oninput = () => { jobFilter = q.value; const pos=q.selectionStart; render(); const n=document.getElementById("q"); n.focus(); n.setSelectionRange(pos,pos); };
  v.querySelectorAll(".item").forEach(el => el.onclick = () => openJob(el.dataset.id));
  v.querySelector("#gSimBtn").onclick = () => { SUB="gsim"; gTab="ruesten"; gDone={}; gRun=null; render(); scrollTo(0,0); };
  v.querySelector("#newJob").onclick = () => {
    const j = {id:uid(), kunde:"", artikel:"", format:"", dicke:"", speed:"", leerhuebe:"", einschub:true, bremsbuerste:false, notiz:"", values:{}, extra:{}, photos:[], history:[], ruestzeiten:[], created:Date.now(), updated:Date.now(), used:Date.now(), _new:true};
    DB.jobs.push(j); SUB = j.id; render(); scrollTo(0,0);
  };
  v.querySelector("#qrIn").onchange = async e => {
    const f = e.target.files[0]; if(!f) return;
    toast("QR-Code wird gelesen …");
    const code = await readQR(f);
    if(!code){ toast("Kein QR-Code erkannt – näher ran und scharf stellen"); return; }
    const art = code.replace(/^FOXSTANZE:/i,"").trim();
    const j = DB.jobs.find(x => x.artikel === art);
    if(j) openJob(j.id);
    else { jobFilter = art; render(); toast(`Artikel ${art} noch nicht angelegt`); }
  };
}
function openJob(id){ SUB = id; const j=DB.jobs.find(x=>x.id===id); if(j){ j.used=Date.now(); save(); } TAB="ruesten"; render(); scrollTo(0,0); }

function fieldHTML(f, val, prev){
  const changed = prev !== undefined && (prev||"") !== (val||"");
  const was = changed ? `<div class="was ${f.full?"full":""}">vorher: ${esc(prev||"leer")}</div>` : "";
  if(f.text) return `<label class="f ${f.full?"full":""} ${changed?"chg":""}"><span>${esc(f.l)}</span><input data-k="${f.k}" value="${esc(val)}"></label>${was}${f.h?`<div class="hint ${f.full?"full":""}">${esc(f.h)}</div>`:""}`;
  return `<div class="${f.full?"full":""}"><label class="f ${changed?"chg":""}"><span>${esc(f.l)}</span><div class="unit"><input data-k="${f.k}" inputmode="decimal" value="${esc(val)}" placeholder="${esc((f.h.match(/Bildschirm: ([^ (]+)/)||[])[1]||"")}"><em>${esc(f.u)}</em></div></label>${was}</div>`;
}

const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
function durTxt(ms){ if(ms < 60000) return "unter 1 min"; const m = Math.round(ms/60000); return m >= 60 ? `${Math.floor(m/60)} h ${m%60} min` : `${m} min`; }
function clockTxt(ms){ const s=Math.floor(ms/1000); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+":":"")+String(m).padStart(h?2:1,"0")+":"+String(x).padStart(2,"0"); }

function viewJob(v, id){
  const j = DB.jobs.find(x => x.id === id);
  if(!j){ SUB=null; return render(); }
  j.history ||= []; j.ruestzeiten ||= [];
  const prevSnap = j.history.length > 1 ? j.history[j.history.length-2] : null;
  const prevVals = prevSnap ? prevSnap.values : null;
  const filled = s => s.fields.filter(f => (j.values[f.k]??"") !== "").length + (j.extra[s.id]||[]).length;
  const changedIn = s => prevVals ? s.fields.filter(f => (prevVals[f.k]||"") !== (j.values[f.k]||"")).length : 0;
  const running = DB.timer && DB.timer.jobId === j.id;
  const rz = j.ruestzeiten;
  v.innerHTML = `
    <button class="back" id="back">‹ Alle Artikel</button>
    <div class="card">
      <div class="grid">
        <label class="f"><span>Artikel-Nr.</span><input id="j_artikel" value="${esc(j.artikel)}" inputmode="numeric"></label>
        <label class="f"><span>Kunde</span><input id="j_kunde" value="${esc(j.kunde)}"></label>
        <label class="f"><span>Format (L x B)</span><input id="j_format" value="${esc(j.format)}" placeholder="1235 x 1268"></label>
        <label class="f"><span>Bogendicke</span><div class="unit"><input id="j_dicke" inputmode="decimal" value="${esc(j.dicke)}"><em>mm</em></div></label>
        <label class="f"><span>Geschwindigkeit</span><div class="unit"><input id="j_speed" inputmode="numeric" value="${esc(j.speed)}"><em>/h</em></div></label>
        <label class="f"><span>Leerhübe</span><input id="j_leerhuebe" inputmode="numeric" value="${esc(j.leerhuebe)}"></label>
        <label class="f full"><span>Bogen pro Bündel</span><input id="j_buendel" inputmode="numeric" value="${esc(j.buendel)}" placeholder="z. B. 52"></label>
      </div>
      ${JOB_TOGGLES.map(t => `<div class="tog"><span>${t.l}</span><label class="sw"><input type="checkbox" id="j_${t.k}" ${j[t.k]?"checked":""}><span></span></label></div>`).join("")}
    </div>
    <div class="card">
      <div class="row"><b style="flex:1">⏱️ Rüstzeit</b><span class="small" style="flex:none">${rz.length?`${rz.length}× gerüstet · Ø ${durTxt(avg(rz.map(r=>r.dur)))} · zuletzt ${durTxt(rz[rz.length-1].dur)}`:"noch nicht gemessen"}</span></div>
      ${running?`<div class="clock" id="jclock">${clockTxt(Date.now()-DB.timer.start)}</div>`:""}
      <button class="btn ${running?"bad":"fox"}" id="timerBtn" ${running?'style="background:var(--bad);color:#fff;border:0"':""}>${running?"■ Rüsten fertig – stoppen":"▶ Rüsten starten"}</button>
      ${DB.timer && !running ? `<div class="small" style="margin-top:6px">Läuft gerade für einen anderen Artikel – Start beendet den alten nicht.</div>`:""}
    </div>
    ${SECTIONS.map(s => `
      <details class="sec" data-s="${s.id}"><summary>${s.icon} ${s.title}<span class="n">${changedIn(s)?`<span style="color:var(--fox)">${changedIn(s)} geändert · </span>`:""}${filled(s)} Werte</span></summary>
        <div class="body">
          <div class="ocrbtns"><label class="btn light sm">📷 Bildschirm fotografieren<input type="file" accept="image/*" capture="environment" data-ocr="${s.id}" hidden></label>
            <label class="btn light sm">🖼️ Aus Galerie<input type="file" accept="image/*" data-ocr="${s.id}" hidden></label></div>
          <div class="grid">${s.fields.map(f => fieldHTML(f, j.values[f.k], prevVals ? prevVals[f.k] : undefined)).join("")}</div>
          <div class="ex">${(j.extra[s.id]||[]).map((e,i) => `<div class="extra"><input placeholder="Bezeichnung" data-ex="${s.id}" data-i="${i}" data-p="n" value="${esc(e.n)}"><input placeholder="Wert" data-ex="${s.id}" data-i="${i}" data-p="v" value="${esc(e.v)}"><button data-del="${s.id}" data-i="${i}">✕</button></div>`).join("")}</div>
          <button class="addx" data-add="${s.id}">＋ Eigenen Wert hinzufügen</button>
        </div></details>`).join("")}
    <h2>Fotos <span>Werkzeug, Zurichtung, Stapel …</span></h2>
    <div class="card"><div class="photos">${(j.photos||[]).map((p,i)=>`<div class="ph"><img src="${p}" data-big="${i}"><button data-pdel="${i}">✕</button></div>`).join("")}
      <label><i>📷</i>Foto<input type="file" accept="image/*" id="photoIn" hidden></label></div></div>
    <h2>Notizen</h2>
    <div class="card"><textarea id="j_notiz" placeholder="Besonderheiten, Probleme, Tipps für das nächste Mal …">${esc(j.notiz)}</textarea></div>
    <h2>🕓 Verlauf <span>${j.history.length} Versionen</span></h2>
    <div class="card">${j.history.length < 2 ? `<div class="small">Sobald du Werte änderst und speicherst, siehst du hier, was sich gegenüber dem letzten Mal geändert hat. Geänderte Felder sind oben orange markiert.</div>` :
      j.history.slice().reverse().slice(0,12).map((h, ri) => {
        const idx = j.history.length-1-ri; const d = diffSnap(j.history[idx-1], h);
        return `<div class="ver"><b>${new Date(h.t).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}${idx===j.history.length-1?" · aktuell":""}</b>
          <div>${idx===0?"Erste Version":d.length?d.slice(0,8).map(x=>`${esc(x.l)}: <s>${esc(x.alt||"leer")}</s> → <b>${esc(x.neu||"leer")}</b>`).join("<br>")+(d.length>8?`<br>+${d.length-8} weitere`:""):"keine Wertänderung"}</div>
          ${idx<j.history.length-1?`<button data-restore="${idx}">↩︎ Diese Version wiederherstellen</button>`:""}</div>`; }).join("")}</div>
    <button class="btn light" id="pdfJob">📄 Rüstblatt als PDF</button>
    <button class="btn light" id="qrJob">▦ QR-Etikett für Werkzeug / Auftrag</button>
    <button class="btn light" id="copyJob">⧉ Als neuen Artikel kopieren</button>
    <button class="btn light" id="shiftFrom">📋 Schicht für diesen Artikel eintragen</button>
    <button class="btn bad" id="delJob">Artikel löschen</button>
    <div class="sticky"><button class="btn" id="saveJob">💾 Speichern</button></div>`;

  const open = JSON.parse(sessionStorage.getItem("open")||"[]");
  v.querySelectorAll("details.sec").forEach(d => { if(open.includes(d.dataset.s)) d.open = true;
    d.ontoggle = () => { const o = [...v.querySelectorAll("details.sec[open]")].map(x=>x.dataset.s); sessionStorage.setItem("open", JSON.stringify(o)); }; });

  const collect = () => {
    ["artikel","kunde","format","dicke","speed","leerhuebe","buendel","notiz"].forEach(k => j[k] = v.querySelector("#j_"+k).value.trim());
    JOB_TOGGLES.forEach(t => j[t.k] = v.querySelector("#j_"+t.k).checked);
    v.querySelectorAll("[data-k]").forEach(i => { const val=i.value.trim(); if(val) j.values[i.dataset.k]=val; else delete j.values[i.dataset.k]; });
    v.querySelectorAll("[data-ex]").forEach(i => { j.extra[i.dataset.ex][+i.dataset.i][i.dataset.p] = i.value; });
  };
  const doSave = (quiet) => {
    collect();
    if(!j.artikel){ toast("Bitte Artikel-Nr. eintragen"); return false; }
    delete j._new; j.updated = Date.now();
    for(const s in j.extra) j.extra[s] = j.extra[s].filter(e => (e.n||"").trim() || (e.v||"").trim());
    const snap = snapshot(j), last = j.history[j.history.length-1];
    if(!last || diffSnap(last, snap).length){ j.history.push(snap); if(j.history.length > 30) j.history.splice(1, 1); }
    if(save() && !quiet) toast("Gespeichert ✓");
    return true;
  };
  j._save = doSave;
  v.querySelector("#back").onclick = () => {
    collect();
    if(j._new && !j.artikel){ DB.jobs = DB.jobs.filter(x=>x!==j); }
    else if(j.artikel){ delete j._new; save(); }
    SUB=null; render(); scrollTo(0,0);
  };
  v.querySelector("#saveJob").onclick = () => { doSave(); render(); };
  v.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { collect(); (j.extra[b.dataset.add] ||= []).push({n:"",v:""}); render(); const d=v.querySelector(`details[data-s="${b.dataset.add}"]`); d.open=true; const ins=d.querySelectorAll(".extra input"); ins[ins.length-2]?.focus(); });
  v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { collect(); j.extra[b.dataset.del].splice(+b.dataset.i,1); render(); });
  v.querySelector("#delJob").onclick = () => confirmBox(`Artikel ${j.artikel||""} wirklich löschen?`, () => { DB.jobs = DB.jobs.filter(x=>x!==j); if(DB.timer&&DB.timer.jobId===j.id) DB.timer=null; save(); SUB=null; render(); toast("Gelöscht"); });
  v.querySelector("#copyJob").onclick = () => { if(!doSave(true)) return; const c = JSON.parse(JSON.stringify(j)); Object.assign(c,{id:uid(), artikel:"", photos:[], history:[], ruestzeiten:[], created:Date.now(), updated:Date.now(), used:Date.now(), _new:true}); DB.jobs.push(c); SUB=c.id; render(); scrollTo(0,0); toast("Kopie – neue Artikel-Nr. eintragen"); };
  v.querySelector("#shiftFrom").onclick = () => { if(!doSave(true)) return; TAB="schicht"; SUB="new:"+j.artikel; render(); scrollTo(0,0); };
  v.querySelector("#pdfJob").onclick = () => { if(!doSave(true)) return; pdfJob(j); };
  v.querySelector("#qrJob").onclick = () => { if(!doSave(true)) return; qrLabel(j); };
  v.querySelector("#timerBtn").onclick = () => {
    collect();
    if(running){ const dur = Date.now()-DB.timer.start; j.ruestzeiten.push({start:DB.timer.start, dur}); DB.timer=null; doSave(true); toast("Rüstzeit: "+durTxt(dur)); }
    else { if(!j.artikel){ toast("Bitte erst Artikel-Nr. eintragen"); return; } DB.timer = {jobId:j.id, start:Date.now()}; doSave(true); }
    render();
  };
  v.querySelectorAll("[data-restore]").forEach(b => b.onclick = () => confirmBox("Diese Version wiederherstellen? Die aktuellen Werte bleiben im Verlauf erhalten.", () => {
    const h = j.history[+b.dataset.restore];
    j.values = Object.assign({}, h.values); Object.assign(j, h.base); j.extra = JSON.parse(JSON.stringify(h.extra||{}));
    JOB_TOGGLES.forEach(t => j[t.k] = h[t.k]);
    const snap = snapshot(j); j.history.push(snap); j.updated=Date.now(); save(); render(); toast("Wiederhergestellt ✓"); }, "Wiederherstellen"));
  v.querySelectorAll("[data-ocr]").forEach(inp => inp.onchange = async e => {
    const f = e.target.files[0]; if(!f) return; collect();
    const sec = SECTIONS.find(s => s.id === inp.dataset.ocr);
    ocrAssign(f, sec, j, () => { doSave(true); sessionStorage.setItem("open", JSON.stringify([sec.id])); render(); toast("Werte übernommen – prüfen und speichern"); });
  });
  v.querySelector("#photoIn").onchange = async e => {
    const f = e.target.files[0]; if(!f) return;
    collect();
    try{ const url = await shrink(f, 900, .72); (j.photos ||= []).push(url); if(doSave(true)) toast("Foto hinzugefügt"); render(); }
    catch(err){ toast("Foto konnte nicht geladen werden"); }
  };
  v.querySelectorAll("[data-pdel]").forEach(b => b.onclick = () => confirmBox("Foto löschen?", () => { collect(); j.photos.splice(+b.dataset.pdel,1); save(); render(); }));
  v.querySelectorAll("[data-big]").forEach(im => im.onclick = () => modal(`<img src="${im.src}" style="width:100%;border-radius:14px"><button class="btn light" data-close>Schließen</button>`));
}

function loadImg(file){
  return new Promise((res, rej) => { const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file); });
}
async function shrink(file, max, q){
  const img = await loadImg(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", q);
}
async function readQR(file){
  try{
    const img = await loadImg(file);
    for(const max of [1000, 1600, 700]){
      const s = Math.min(1, max/Math.max(img.width,img.height));
      const c = document.createElement("canvas"); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
      const g = c.getContext("2d"); g.drawImage(img,0,0,c.width,c.height);
      const d = g.getImageData(0,0,c.width,c.height);
      const r = jsQR(d.data, c.width, c.height, {inversionAttempts:"attemptBoth"});
      if(r && r.data) return r.data;
    }
  }catch(e){}
  return null;
}

/* ===================== Werte vom Bildschirm-Foto (Texterkennung) ===================== */
const NUM_RE = /^[-−–]?\d{1,5}([.,]\d{1,3})?$/;
function cleanNum(t){ return t.replace(/[−–]/g,"-").replace(/[Oo](?=\d)|(?<=\d)[Oo]/g,"0").replace(/\s/g,"").replace(/^[^\d-]+|[^\d]+$/g,""); }
async function ocrAssign(file, sec, j, done){
  if(!NATIVE){ toast("Texterkennung geht nur in der installierten App"); return; }
  const wait = modal(`<h3><span class="spin" style="border-color:rgba(0,0,0,.15);border-top-color:var(--accent)"></span> Zahlen werden erkannt …</h3><p class="small">Das dauert ein, zwei Sekunden.</p>`);
  let img, data, res;
  try{
    img = await shrink(file, 2000, .9);
    res = await capCall("FoxStanze", "ocr", {image: img.split(",")[1]});
  }catch(e){ wait.remove(); toast("Texterkennung fehlgeschlagen: "+(e && e.message || e)); return; }
  wait.remove();
  const hits = [];
  for(const line of res.lines || []){
    const els = line.elements || [];
    // ganze Zeile als Zahl? (z. B. "- 634,0")
    const whole = cleanNum(line.text);
    if(NUM_RE.test(whole) && els.length > 1){ hits.push({t:whole.replace(".",","), x:line.x, y:line.y, w:line.w, h:line.h}); continue; }
    for(const e of els){ const t = cleanNum(e.text); if(NUM_RE.test(t)) hits.push({t:t.replace(".",","), x:e.x, y:e.y, w:e.w, h:e.h}); }
  }
  ocrPicker(img, res.width, res.height, hits, sec, j, done);
}
function ocrPicker(img, W, H, hits, sec, j, done){
  const fields = sec.fields.filter(f => !f.text);
  const vals = {}; fields.forEach(f => vals[f.k] = j.values[f.k] || "");
  const used = {};
  let cur = 0, zoom = 1;
  const el = document.createElement("div"); el.className = "ocr"; document.body.appendChild(el);
  const draw = () => {
    const f = fields[cur];
    el.innerHTML = `
      <div class="top"><small>${sec.icon} ${sec.title} · Feld ${Math.min(cur+1,fields.length)} von ${fields.length} · ${hits.length} Zahlen erkannt</small>
        <h3>${f ? `Tippe auf: <span style="color:var(--fox)">${esc(f.l)}</span>` : "Alle Felder durch ✓"}</h3>
        <div class="vals">${fields.map((x,i)=>`<span data-jump="${i}" class="${i===cur?"cur":vals[x.k]?"ok":""}">${esc(x.l)}: ${esc(vals[x.k]||"–")}</span>`).join("")}</div></div>
      <div class="pic"><div class="inner" style="width:${zoom*100}%"><img src="${img}">
        ${hits.map((h,i)=>`<button class="hit ${used[i]?"used":""}" data-h="${i}" style="left:${(h.x-h.h*.4)/W*100}%;top:${(h.y-h.h*.4)/H*100}%;width:${(h.w+h.h*.8)/W*100}%;height:${h.h*1.8/H*100}%"></button>`).join("")}</div></div>
      <div class="bot"><button data-a="zoom">🔍 ${zoom===1?"2×":"1×"}</button><button data-a="type">⌨️ Tippen</button><button data-a="skip">${f?"Überspringen":"Zurück"}</button><button data-a="cancel">✕</button><button class="go" data-a="ok">✓ Fertig</button></div>`;
    el.querySelectorAll("[data-h]").forEach(b => b.onclick = () => {
      if(!fields[cur]) return;
      const h = hits[+b.dataset.h]; vals[fields[cur].k] = h.t; used[+b.dataset.h] = true; cur++; draw();
    });
    el.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { cur = +b.dataset.jump; draw(); });
    el.querySelector('[data-a="zoom"]').onclick = () => { zoom = zoom===1 ? 2 : 1; draw(); };
    el.querySelector('[data-a="skip"]').onclick = () => { if(fields[cur]) cur++; else cur = Math.max(0, fields.length-1); draw(); };
    el.querySelector('[data-a="type"]').onclick = () => {
      const f = fields[cur] || fields[fields.length-1]; const idx = fields.indexOf(f);
      const m = modal(`<h3>${esc(f.l)}</h3><div class="unit"><input id="tv" inputmode="decimal" value="${esc(vals[f.k])}"><em>${esc(f.u)}</em></div><button class="btn" id="tok">Übernehmen</button><button class="btn light" data-close>Abbrechen</button>`);
      m.style.zIndex = 70; const i = m.querySelector("#tv"); i.focus();
      m.querySelector("#tok").onclick = () => { vals[f.k] = i.value.trim(); m.remove(); cur = idx+1; draw(); };
    };
    el.querySelector('[data-a="cancel"]').onclick = () => el.remove();
    el.querySelector('[data-a="ok"]').onclick = () => {
      fields.forEach(f => { if(vals[f.k]) j.values[f.k] = vals[f.k]; else delete j.values[f.k]; });
      el.remove(); done();
    };
  };
  el.close = () => el.remove();
  draw();
}

/* ===================== SCHICHT ===================== */
const STOER_VORLAGEN = ["Palettierer Stau","Zwischenbogen / Schutzbogen fehlt","Palette fehlt","Greiferrandzerhacker AS geöffnet","Bogenableger Greiferrandzerhacker Sicherheitskreis","Stau","Doppelbogen","Bogen schief / nicht angelegt","Bogenablager voll","Werkzeug nachgerichtet","Ausbrechen hängt","Rüsten","Materialwechsel","Pause / Besprechung"];
const SCHICHTEN = ["Früh","Spät","Nacht"];
function guessShift(){ const h = new Date().getHours(); return h>=6&&h<14 ? "Früh" : h>=14&&h<22 ? "Spät" : "Nacht"; }

function viewSchicht(v){
  if(SUB === "stats") return viewStats(v);
  if(SUB) return viewShift(v, SUB);
  const list = [...DB.shifts].sort((a,b) => (b.datum+b.created).localeCompare(a.datum+a.created));
  const last7 = DB.shifts.filter(s => (Date.now() - new Date(s.datum)) < 7*864e5);
  const sum7 = last7.reduce((a,s)=>a+(num(s.stueck)||0),0);
  const st7 = last7.reduce((a,s)=>a+(s.stoer||[]).reduce((b,x)=>b+(num(x.min)||0),0),0);
  v.innerHTML = `
    <div class="hero gr"><div class="big">📋</div><small>Schichtprotokoll</small><h1>Letzte 7 Tage</h1>
      <div class="stats"><div><b>${fmt(sum7)}</b><span>Bogen</span></div><div><b>${last7.length}</b><span>Schichten</span></div><div><b>${fmt(st7)}</b><span>Min. Störung</span></div></div></div>
    <button class="btn fox" id="newShift">＋ Schicht eintragen</button>
    <button class="btn light" id="stats" style="margin-bottom:6px">📊 Statistik &amp; Störungen</button>
    <h2>Einträge <span>${list.length}</span></h2>
    ${list.length ? list.map(s => {
      const sm = (s.stoer||[]).reduce((b,x)=>b+(num(x.min)||0),0);
      return `<div class="item" data-id="${s.id}" style="border-left-color:var(--green)"><div class="t"><b>${dDE(s.datum)} · ${esc(s.schicht)}</b>
        <small>Artikel ${esc(s.artikel)||"–"} · ${fmt(num(s.stueck))} Bogen${s.ausstoss?" · "+fmt(num(s.ausstoss))+"/h":""}</small>
        ${(s.stoer||[]).length?`<div>${s.stoer.slice(0,3).map(x=>`<span class="tag w">${esc(x.t)}${x.min?" "+esc(x.min)+"′":""}</span>`).join("")}${s.stoer.length>3?`<span class="tag">+${s.stoer.length-3}</span>`:""}</div>`:""}
      </div><div class="go">›</div></div>`; }).join("") : `<div class="empty">Noch keine Schicht eingetragen.</div>`}`;
  v.querySelector("#newShift").onclick = () => { SUB="new:"; render(); scrollTo(0,0); };
  v.querySelector("#stats").onclick = () => { SUB="stats"; render(); scrollTo(0,0); };
  v.querySelectorAll(".item").forEach(el => el.onclick = () => { SUB = el.dataset.id; render(); scrollTo(0,0); });
}


let statDays = 30;
function viewStats(v){
  const list = shiftsIn(statDays);
  const bogen = list.reduce((a,s)=>a+(num(s.stueck)||0),0), stMin = list.reduce((a,s)=>a+(s.stoer||[]).reduce((b,x)=>b+(num(x.min)||0),0),0);
  const aus = list.map(s=>num(s.ausstoss)).filter(Boolean);
  const st = stoerStats(list), maxMin = Math.max(1, ...st.map(x=>x.min));
  // Bogen pro Tag, letzte 14 Tage
  const days = [...Array(14)].map((_,i) => { const d = new Date(); d.setDate(d.getDate()-13+i); const iso = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    return {iso, d, n: DB.shifts.filter(s=>s.datum===iso).reduce((a,s)=>a+(num(s.stueck)||0),0)}; });
  const maxD = Math.max(1, ...days.map(x=>x.n));
  const perShift = SCHICHTEN.map(sc => { const l = list.filter(s=>s.schicht===sc); return {sc, n:l.length, b:l.reduce((a,s)=>a+(num(s.stueck)||0),0)}; });
  const maxS = Math.max(1, ...perShift.map(x=>x.b));
  v.innerHTML = `<button class="back" id="back">‹ Schichten</button>
    <div class="chips">${[[7,"7 Tage"],[30,"30 Tage"],[90,"90 Tage"],[0,"Alles"]].map(([d,l])=>`<button class="chip ${statDays===d?"on":""}" data-d="${d}">${l}</button>`).join("")}</div>
    <div class="hero gr"><div class="big">📊</div><small>${statDays?`Letzte ${statDays} Tage`:"Alle Einträge"}</small><h1>${fmt(bogen)} Bogen</h1>
      <div class="stats"><div><b>${list.length}</b><span>Schichten</span></div><div><b>${aus.length?fmt(avg(aus)):"–"}</b><span>Ø Ausstoß/h</span></div><div><b>${fmt(stMin)}</b><span>Min. Störung</span></div></div></div>
    <h2>Bogen pro Tag <span>letzte 14 Tage</span></h2>
    <div class="card"><div class="cols">${days.map(x=>`<div class="${x.n?"":"z"}" style="height:${x.n/maxD*100}%" title="${x.n}"></div>`).join("")}</div>
      <div class="colsx">${days.map((x,i)=>`<span>${i%2?"":x.d.getDate()+"."}</span>`).join("")}</div>
      <div class="small" style="margin-top:6px">Bester Tag: ${maxD>1?fmt(maxD)+" Bogen":"–"}</div></div>
    <h2>Häufigste Störungen <span>nach Minuten</span></h2>
    <div class="card">${st.length ? st.slice(0,8).map(x=>`<div class="bar"><span class="l">${esc(x.t)}</span><span class="b"><i style="width:${Math.max(3,x.min/maxMin*100)}%"></i></span><span class="v">${fmt(x.min)}′ · ${x.n}×</span></div>`).join("")
      : `<div class="small">Keine Störungen im Zeitraum 👍</div>`}</div>
    <h2>Nach Schicht</h2>
    <div class="card">${perShift.map(x=>`<div class="bar"><span class="l">${x.sc} (${x.n})</span><span class="b"><i style="width:${x.b/maxS*100}%;background:var(--accent)"></i></span><span class="v">${fmt(x.b)}</span></div>`).join("")}</div>
    <button class="btn" id="pdf">📄 Als PDF-Bericht</button>`;
  v.querySelector("#back").onclick = () => { SUB=null; render(); };
  v.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { statDays = +b.dataset.d; render(); });
  v.querySelector("#pdf").onclick = () => pdfShifts(statDays);
}

function viewShift(v, id){
  let s;
  if(id.startsWith("new:")){
    const art = id.slice(4); const job = DB.jobs.find(j=>j.artikel===art);
    s = {id:uid(), datum:today(), schicht:guessShift(), artikel:art, stueck:"", speed:job?job.speed:"", ausstoss:"", stoer:[], notiz:"", created:Date.now(), _new:true};
    DB.shifts.push(s); SUB = s.id;
  } else s = DB.shifts.find(x=>x.id===id);
  if(!s){ SUB=null; return render(); }
  const arts = [...new Set(DB.jobs.map(j=>j.artikel).filter(Boolean))];
  v.innerHTML = `
    <button class="back" id="back">‹ Alle Schichten</button>
    <div class="card">
      <div class="grid">
        <label class="f"><span>Datum</span><input type="date" id="s_datum" value="${esc(s.datum)}"></label>
        <label class="f"><span>Artikel</span><input id="s_artikel" list="arts" value="${esc(s.artikel)}" inputmode="numeric"></label>
      </div>
      <datalist id="arts">${arts.map(a=>`<option value="${esc(a)}">`).join("")}</datalist>
      <div class="chips" id="schichtChips">${SCHICHTEN.map(x=>`<button class="chip ${s.schicht===x?"on":""}" data-sch="${x}">${x}</button>`).join("")}</div>
      <div class="grid">
        <label class="f"><span>Bogen gestanzt</span><input id="s_stueck" inputmode="numeric" value="${esc(s.stueck)}" placeholder="3237"></label>
        <label class="f"><span>Ausstoß</span><div class="unit"><input id="s_ausstoss" inputmode="numeric" value="${esc(s.ausstoss)}" placeholder="3173"><em>/h</em></div></label>
        <label class="f full"><span>Geschwindigkeit eingestellt</span><div class="unit"><input id="s_speed" inputmode="numeric" value="${esc(s.speed)}" placeholder="3300"><em>/h</em></div></label>
      </div>
    </div>
    <h2>Störungen / Meldungen <span>Minuten</span></h2>
    <div class="card">
      <div id="stoerList">${(s.stoer||[]).map((x,i)=>`<div class="stoer"><input data-st="${i}" data-p="t" value="${esc(x.t)}" placeholder="Was war los?"><input class="min" data-st="${i}" data-p="min" value="${esc(x.min)}" inputmode="numeric" placeholder="Min"><button data-sdel="${i}">✕</button></div>`).join("")}</div>
      <div class="small" style="margin:4px 2px 6px">Schnell hinzufügen:</div>
      <div class="chips">${STOER_VORLAGEN.map(t=>`<button class="chip" data-quick="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      <button class="addx" id="addStoer">＋ Eigene Störung</button>
    </div>
    <h2>Notiz</h2>
    <div class="card"><textarea id="s_notiz" placeholder="Übergabe an die nächste Schicht …">${esc(s.notiz)}</textarea></div>
    <button class="btn light" id="shareShift">📤 Übergabe-Text kopieren</button>
    <button class="btn bad" id="delShift">Eintrag löschen</button>
    <div class="sticky"><button class="btn" id="saveShift">💾 Speichern</button></div>`;
  const collect = () => {
    ["datum","artikel","stueck","ausstoss","speed","notiz"].forEach(k => s[k] = v.querySelector("#s_"+k).value.trim());
    v.querySelectorAll("[data-st]").forEach(i => s.stoer[+i.dataset.st][i.dataset.p] = i.value.trim());
  };
  v.querySelectorAll("[data-sch]").forEach(b => b.onclick = () => { collect(); s.schicht = b.dataset.sch; render(); });
  v.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => { collect(); s.stoer.push({t:b.dataset.quick, min:""}); render(); const m=v.querySelectorAll("#stoerList .min"); m[m.length-1]?.focus(); });
  v.querySelector("#addStoer").onclick = () => { collect(); s.stoer.push({t:"",min:""}); render(); const t=v.querySelectorAll('#stoerList [data-p="t"]'); t[t.length-1]?.focus(); };
  v.querySelectorAll("[data-sdel]").forEach(b => b.onclick = () => { collect(); s.stoer.splice(+b.dataset.sdel,1); render(); });
  v.querySelector("#back").onclick = () => { collect(); if(s._new && !s.stueck && !s.stoer.length && !s.notiz) DB.shifts = DB.shifts.filter(x=>x!==s); else { delete s._new; save(); } SUB=null; render(); scrollTo(0,0); };
  v.querySelector("#saveShift").onclick = () => { collect(); s.stoer = s.stoer.filter(x=>x.t||x.min); delete s._new; if(save()) toast("Gespeichert ✓"); SUB=null; render(); scrollTo(0,0); };
  v.querySelector("#delShift").onclick = () => confirmBox("Schicht-Eintrag löschen?", () => { DB.shifts = DB.shifts.filter(x=>x!==s); save(); SUB=null; render(); });
  v.querySelector("#shareShift").onclick = () => {
    collect();
    const sm = s.stoer.reduce((b,x)=>b+(num(x.min)||0),0);
    const txt = `Schichtübergabe ${dDE(s.datum)} (${s.schicht})\nArtikel: ${s.artikel||"–"}\nBogen: ${s.stueck||"–"}${s.ausstoss?` · Ausstoß ${s.ausstoss}/h`:""}${s.speed?` · eingestellt ${s.speed}/h`:""}\n`+
      (s.stoer.length?`Störungen (${sm} Min):\n`+s.stoer.filter(x=>x.t).map(x=>`- ${x.t}${x.min?` (${x.min} Min)`:""}`).join("\n")+"\n":"Keine Störungen\n")+
      (s.notiz?`Notiz: ${s.notiz}\n`:"");
    copy(txt);
  };
}

/* ===================== WISSEN ===================== */
const TOPICS = [
  {id:"ablauf", icon:"🔄", title:"Ablauf durch die Maschine", html:`
    <div class="flow"><span>📥 Anleger</span><i>→</i><span>🔨 Stanztiegel</span><i>→</i><span>🔁 Bogenübergabe</span><i>→</i><span>🪓 Ausbrechstation</span><i>→</i><span>📦 Bogenablager</span><i>→</i><span>➡️ Auslauf</span></div>
    <p>Der Bogen wird im <b>Anleger</b> vom Stapel abgenommen, ausgerichtet und an die Greiferleiste übergeben. Die Greifer ziehen ihn durch die ganze Maschine.</p>
    <p>Im <b>Stanztiegel</b> wird geschnitten und gerillt, in der <b>Ausbrechstation</b> fällt der Abfall (Ausbruch) heraus. Der Greiferrand wird vom <b>Greiferrandzerhacker</b> abgetrennt und zerkleinert. Im <b>Bogenablager</b> werden die fertigen Bogen gestapelt und über den <b>Auslauftransport</b> abgefördert.</p>`},
  {id:"seiten", icon:"↔️", title:"AS / BS und das Ketten-Symbol 🔗", html:`
    <p><b>AS</b> = Antriebsseite, <b>BS</b> = Bedienseite. Viele Werte gibt es doppelt, einmal für jede Seite.</p>
    <p>Ist das grüne <b>Ketten-Symbol 🔗</b> aktiv, sind beide Seiten gekoppelt und bewegen sich gemeinsam – deshalb stehen dann Paare wie <b>634,0</b> und <b>−634,0</b> auf dem Bildschirm (gleicher Abstand zur Mitte, andere Richtung).</p>
    <p>Kette aus = jede Seite einzeln verstellen, z. B. wenn ein Bogen schief läuft.</p>`},
  {id:"stanze", icon:"🔨", title:"Stanze: Spalt und Druck", html:`
    <p>Der <b>Spalt</b> (z. B. −1,34 mm) bestimmt, wie weit Ober- und Untertiegel zusammenfahren. Je kleiner bzw. negativer der Spalt, desto stärker wird zugestellt – der <b>Druck</b> in Tonnen (z. B. 238 t) steigt.</p>
    <ul><li>Schneidet es nicht durch: Spalt in <b>kleinen Schritten</b> verringern, nicht auf einmal.</li><li>Nur eine Seite schneidet schlecht: Kette lösen und nur diese Seite nachstellen.</li><li>Zu viel Druck schadet Messern, Rillen und Schneidplatte – lieber zurichten als nur Druck erhöhen.</li></ul>
    <div class="note">Werte immer an die Betriebsanweisung bei Seyfert halten. Die Tipps hier sind allgemein.</div>`},
  {id:"anleger", icon:"📥", title:"Anleger", html:`
    <p>Hier stehen die <b>Seitenführungen</b>, die <b>Anschläge</b> und der <b>Hinteranschlag</b> (meist ungefähr das Bogenformat, z. B. 1235). Der grüne Lichtkegel auf dem Bildschirm ist der Sensor, der den Bogen erkennt.</p>
    <p>Der Bogen muss gerade und ohne Doppelbogen eingezogen werden – sonst Stau oder Fehlschnitt. <b>Einschub Automatik</b> im Produktionsbild schaltet den automatischen Bogeneinschub ein.</p>`},
  {id:"ausbrech", icon:"🪓", title:"Ausbrechstation", html:`
    <p>Oberes und unteres Ausbrechwerkzeug drücken den Abfall aus dem gestanzten Bogen. Höhe, Seitenführungen und Position müssen zum Werkzeug passen.</p>
    <ul><li>Abfall bleibt hängen: Höhe des Oberteils und Stifte prüfen.</li><li>Nutzen fallen mit raus: zu tief zugestellt oder Haltepunkte (Nicks) am Stanzwerkzeug zu klein.</li></ul>`},
  {id:"ablage", icon:"📦", title:"Bogenablager & Auslauf", html:`
    <p>Seitenführungen und Hinteranschlag richten den Stapel aus. Die <b>Bürstenwalze</b> und die <b>Bremsbürste</b> bremsen den Bogen ab, damit er sauber liegt.</p>
    <p>Meldung <b>„Bogenablager voll“</b>: Stapel abfahren. Im Auslauftransport stellst du Bandgeschwindigkeit, Zeit und Höhe ein.</p>`},
  {id:"stopper", icon:"🚦", title:"Stopperüberwachung", html:`
    <p>Sensoren auf AS und BS prüfen an jeder Station (Bogenablager, Ausbrechstation, Stanztiegel-Auslauf, Bogenübergabe, Frontanschlag), ob der Bogen richtig ankommt. Grüner Punkt = Sensor in Ordnung.</p>
    <p>Die <b>Kontrollpunkte</b> (z. B. 150 und 1085 mm) sind die Abstände zur Bogenvorderkante, an denen geprüft wird. Dazu gibt es <b>Bogenimpuls</b>-Sensoren und die <b>Stauüberwachung</b> AS/BS.</p>
    <div class="note">Überwachungen nie dauerhaft abschalten, um eine Störung zu umgehen.</div>`},
  {id:"status", icon:"🟢", title:"Status-Lampen & Produktion", html:`
    <ul><li><b>Steuerung Ein</b> – Steuerung läuft</li><li><b>Sicherheit OK</b> – Türen/Schutz zu, kein Not-Halt</li><li><b>Hauptmotor Ein</b> – Antrieb läuft</li><li><b>Einschub Ein</b> – Bogen werden eingezogen</li><li><b>Belegt</b> – Maschine ist belegt</li></ul>
    <p>Im Produktionsbild: <b>Gesamt</b> = gestanzte Bogen, <b>Geschwindigkeit</b> = Sollwert (bis 6500/h), <b>Ausstoß</b> = tatsächlich erreicht. <b>Leerhübe</b> = Hübe ohne Bogen, <b>Anstanzen</b> = einzelne Probebogen.</p>
    <p>Mit <b>Korrekturen speichern</b> sicherst du die Werte für den Artikel in der Maschine – in dieser App hast du sie zusätzlich auf dem Handy.</p>`},

  {id:"gcut", icon:"🏭", title:"Eure Maschine: Göpfert G-Cut", html:`
    <p>Göpfert baut seit 2019 genau eine Flachbettstanze: die <b>G-Cut</b>. Dazu passen eure Bildschirme mit max. 6500 Bogen/h, der Meldungsbereich „FDC“ (<i>Flatbed Die Cutter</i>) und der Bogenableger mit Bündeln. Eure Maschine ist also sehr wahrscheinlich eine G-Cut.</p>
    <p><b>Laut Hersteller:</b></p>
    <ul><li>Maschinengeschwindigkeit bis <b>6500 Bogen/h</b></li><li>Greiferrand einstellbar <b>11–18 mm</b>, motorisch</li><li>Schneidlinienhöhe <b>23,8 mm</b></li><li>Stanzdruck <b>450 oder 500 t</b> je nach Größe, Kniehebel-Technik</li>
      <li>Schneidspalt (euer „Spalt“) wird per <b>Servo</b> reproduzierbar eingestellt</li><li>Stanzwerkzeug und Schneid-Gegenplatte werden <b>automatisch geklemmt</b></li>
      <li>Zentralschmierung mit Drucküberwachung</li><li>Max. Bündelhöhe <b>400 mm</b></li>
      <li>Anleger mit schwingender Saugplatte, motorische Seitenführungen, Vorder- und Hinteranschlag</li><li>Bündelableger mit Non-Stop-Gabeln, optional integrierter Greiferrandzerhacker</li></ul>
    <div class="note">Quelle: Göpfert-Webseite zur G-Cut. Die genaue Ausführung bei Seyfert kann abweichen – Typenschild prüfen.</div>`},
  {id:"bs_prod", icon:"🔄", title:"Bildschirm: Produktion", html:`
    <ul><li><b>Jobdaten</b> – Kunde, Artikel, Format, Bogendicke des aktuellen Auftrags</li>
      <li><b>Stückzahlen</b> – <i>Gesamt</i> = gestanzte Bogen, <i>Bündel/Stapel</i> = Bogen pro Bündel (z. B. 52). Mit dem Stift kannst du die Zähler ändern.</li>
      <li><b>Geschwindigkeit</b> – oben der Ist-Wert (z. B. 3682), im Feld der Sollwert (z. B. 3700), Regler 0–6500</li>
      <li><b>Ausstoß (Stck/h)</b> – was tatsächlich rauskommt</li>
      <li><b>Funktionen</b> – Anstanzen, Einschub Automatik, ARF Teachen, Bremsbürste, Leerhübe. Grün = an.</li>
      <li><b>Stanzung</b> – Spalt (mm), Druck (t), Position Tiegel (°)</li>
      <li><b>Korrekturen speichern</b> – speichert deine Korrekturen zum Artikel in der Maschine</li>
      <li>Unten das <b>Anlagenbild</b>: das blaue <b>i</b> zeigt, an welcher Station eine Meldung ansteht.</li></ul>`},
  {id:"bs_korr", icon:"⌖", title:"Bildschirm: Korrektur", html:`
    <p>Hier stellst du die einzelnen Stationen ein. Mit den Punkten unten blätterst du durch die Seiten: <b>Anleger, Austransport, Bogenableger, Ausbrechstation, Stanze, Stopperüberwachung</b>.</p>
    <ul><li><b>△</b> vor einem Wert = Korrekturwert, den du mit Pfeilen oder +/− änderst</li><li><b>=</b> vor einem Wert = fester Sollwert</li>
      <li><b>🔗 grün</b> = AS und BS gekoppelt</li><li><b>⏩| grün</b> = Achse fährt automatisch auf Formatposition</li></ul>
    <p>Genau diese Seiten findest du in Fox Stanze im Rüstblatt wieder.</p>`},
  {id:"bs_masch", icon:"🔧", title:"Bildschirm: Maschine (Mada & Co.)", html:`
    <p>Oben die Reiter:</p>
    <ul><li><b>Soll-/Ist-Werte</b> – Vergleich der Achsen</li><li><b>Mada</b> = <b>Maschinendaten</b>: Grundeinstellungen je Aggregat (Gesamtanlage, Anleger, Stanzaggregat, Ausbrechstation, Bogenableger)</li>
      <li><b>Aufzeichnung</b>, <b>Diagnose</b> – für Fehlersuche</li><li><b>BDE</b> = Betriebsdatenerfassung (Laufzeiten, Stückzahlen, Stillstände)</li>
      <li><b>Wartung</b> – Wartungsintervalle</li><li><b>Benutzer</b>, <b>Sprache</b>, <b>Datum/Uhrzeit</b></li></ul>
    <p><b>Mada › Bogenableger</b> (Werte vom 19.11.):</p>
    <ul><li>Bündel: Min. Bündelhöhe 50 mm, Max. Bündelhöhe 410 mm, Bündelhöhe Abwurf Zwischenmagazin 20 mm</li>
      <li>Fettschmierung: aktiv 120 s, Pause 2400 min, Override 100 %</li><li>Weitere Gruppen: Allgemein (Blasluft Ein Default), Ölschmierung, Finger, Seitenausrichter, Backstop</li></ul>
    <div class="note">Mada-Werte sind Grundeinstellungen der Maschine. Nur ändern, wenn du dazu befugt bist – Änderungen wirken auf alle Aufträge.</div>`},
  {id:"bs_auftrag", icon:"📂", title:"Bildschirm: Auftrag", html:`
    <ul><li>Oben die <b>Auftragsliste</b> (Pos., Kunde, Artikel, Auftrag, Stückzahl). Grün markiert = ausgewählt.</li>
      <li>Darunter die <b>Suche/Filter</b> nach Kunde, Artikel oder Auftrag</li>
      <li>Rechts <b>Ausgewählter Auftrag</b> mit Format, Bogendicke, Bemerkung</li>
      <li>Knöpfe: <b>Positionieren</b> (Maschine fährt auf das Format), <b>Neuer Auftrag</b>, <b>Auftrag bearbeiten</b>, <b>Auftrag als Vorlage</b>, <b>Von Liste löschen</b></li></ul>
    <p>Tipp: Wenn ein Artikel neu ist, mit „Auftrag als Vorlage“ von einem ähnlichen starten – genauso wie „Als neuen Artikel kopieren“ in Fox Stanze.</p>`},
  {id:"bs_meld", icon:"⚠️", title:"Bildschirm: Meldungen", html:`
    <ul><li>Liste mit Zeit und Meldungstext. Rechts die Details: Datum/Zeit, <b>Bereich</b> (z. B. FDC), <b>Nr.</b>, <b>Parameter</b>, <b>Symbol</b> und <b>Schaltplan</b>-Stelle (z. B. FDC|30,1|B30).</li>
      <li>Filter unten: 🔺 Fehler · ⚠️ Warnung · ℹ️ Info · 🛡️ Sicherheit · ⚙️ Maschine, dazu Bereich (Gesamtanlage) und Ebene (Bediener)</li>
      <li><b>Quittieren</b> bestätigt die Meldung, <b>Archiv</b> zeigt alte Meldungen, <b>Hilfe</b> und <b>Schaltplan</b> öffnen Infos zur Meldung</li></ul>
    <div class="note">Für den Elektriker die <b>Nr.</b> und die <b>Schaltplan</b>-Angabe notieren – damit findet er den Sensor sofort. In Fox Stanze kannst du das bei der Störung mit eintragen.</div>`},
  {id:"bs_sich", icon:"🛡️", title:"Bildschirm: Sicherheit", html:`
    <ul><li>3D-Bild der ganzen Anlage mit allen <b>Schutztüren</b> (blaue Tür-Symbole) und <b>Not-Halt</b>-Tastern (gelbe Ringe). Eine offene Tür oder ein gedrückter Not-Halt wird dort angezeigt.</li>
      <li>Oben rechts: Steuerung Ein / Sicherheit OK</li>
      <li><b>Reintegration</b> – Anlagenteile nach dem Öffnen wieder in den Sicherheitskreis aufnehmen</li><li><b>Abläufe stoppen</b> – laufende automatische Abläufe anhalten</li><li><b>Drehen</b> – Ansicht drehen</li></ul>`},
  {id:"sicher", icon:"🛑", title:"Sicherheit", html:`
    <ul><li><b>NOT-HALT</b> (roter Pilz) stoppt sofort alles.</li><li>Nie in die Maschine greifen, solange sie nicht gesichert ist.</li><li>Meldungen wie „Greiferrandzerhacker Antriebsseite geöffnet“ bedeuten: eine Schutzeinrichtung ist offen – erst schließen, dann starten.</li><li>Beim Werkzeugwechsel Maschine sichern, wie im Betrieb vorgeschrieben.</li></ul>`},
];
const QUIZ = [
  {q:"Was macht der „Separator“ (BS1/BS2) am Palettierer?", o:["Er klebt Bogen","Er bricht die Bündel an den Haltepunkten in einzelne Nutzen-Stapel","Er zählt Paletten","Er wickelt Folie"], a:1, e:"Breaker/Separator = Brecher. „Zyklen Brecher 1/2“ stellst du im Auftrag ein."},
  {q:"Wofür sind Zwischenbogen auf der Palette?", o:["Für die Optik","Für Stabilität beim Transport","Zum Zählen","Gegen Feuchtigkeit vom Boden"], a:1, e:"Zwischenbogen zwischen den Lagen halten die Palette zusammen."},
  {q:"Bündelhöhe 138 mm, 10 Lagen – wie hoch ist der Stapel?", o:["138 mm","1380 mm","13,8 mm","1518 mm"], a:1, e:"138 × 10 = 1380 mm, plus Palette (z. B. 150 mm)."},
  {q:"Was bedeutet „Mada“ im Maschinen-Menü?", o:["Material-Datenbank","Maschinendaten – Grundeinstellungen je Aggregat","Manuelle Daten","Maßangaben"], a:1, e:"Mada = Maschinendaten. Nur mit Befugnis ändern."},
  {q:"Welche Farbe hat bei Drucktastern nach EN 60204-1 meist „Zurücksetzen/Quittieren“?", o:["Rot","Gelb","Blau","Grün"], a:2, e:"Blau steht für eine Handlung, die nötig ist – z. B. Reset nach dem Schließen einer Schutztür."},
  {q:"Wie hoch darf ein Bündel laut Mada maximal sein?", o:["100 mm","410 mm","1000 mm","50 mm"], a:1, e:"Min. 50 mm, max. 410 mm (Stand 19.11.)."},
  {q:"Was hilft dem Elektriker bei einer Meldung am meisten?", o:["Uhrzeit","Meldungs-Nr. und Schaltplan-Angabe","Artikelnummer","Kundenname"], a:1, e:"Mit Nr. und Schaltplanstelle findet er den Sensor direkt."},
  {q:"Was bedeutet „AS“?", o:["Ausbrech-Station","Antriebsseite","Anleger-Sensor","Automatik-Start"], a:1, e:"AS = Antriebsseite, BS = Bedienseite."},
  {q:"Warum stehen bei der Seitenführung 634,0 und −634,0?", o:["Messfehler","Beide Seiten sind gekoppelt (🔗) und fahren gleich weit von der Mitte weg","Der Wert ist in Zoll","Die BS ist kaputt"], a:1, e:"Mit aktiver Kette bewegen sich AS und BS gemeinsam – gleicher Abstand, andere Richtung."},
  {q:"Der Bogen ist nicht durchgeschnitten. Was zuerst?", o:["Spalt in kleinen Schritten verringern","Druck sofort stark erhöhen","Geschwindigkeit auf 6500","Stopperüberwachung abschalten"], a:0, e:"Immer in kleinen Schritten zustellen – und prüfen, ob es nur eine Seite betrifft."},
  {q:"Was passiert in der Ausbrechstation?", o:["Der Bogen wird bedruckt","Der Abfall wird aus dem Bogen gedrückt","Die Bogen werden gezählt","Der Bogen wird gerillt"], a:1, e:"Ober- und Unterwerkzeug drücken den Ausbruch heraus."},
  {q:"„Sicherheit OK“ ist aus. Was heißt das meistens?", o:["Alles bestens","Eine Schutzeinrichtung ist offen oder Not-Halt gedrückt","Hauptmotor zu heiß","Auftrag fertig"], a:1, e:"Erst Tür/Schutz schließen bzw. Not-Halt entriegeln und quittieren."},
  {q:"Geschwindigkeit 3300, Ausstoß 3173 Stck/h – was ist der Ausstoß?", o:["Der eingestellte Wert","Die tatsächlich erreichte Leistung","Die Bogendicke","Die Leerhübe"], a:1, e:"Ausstoß = was wirklich rauskommt."},
  {q:"Was sind die Kontrollpunkte in der Stopperüberwachung?", o:["Abstände zur Bogenvorderkante, an denen geprüft wird","Temperaturen","Werkzeugnummern","Pausenzeiten"], a:0, e:"z. B. 150 mm und 1085 mm ab Vorderkante."},
  {q:"Wofür ist der Greiferrandzerhacker?", o:["Er schneidet die Nutzen","Er trennt und zerkleinert den Greiferrand","Er stapelt die Bogen","Er zieht den Bogen ein"], a:1, e:"Der Greiferrand (wo die Greifer festhalten) wird abgetrennt und zerhackt."},
  {q:"Abfall bleibt in der Ausbrechstation hängen. Was prüfst du?", o:["Höhe Oberteil und Ausbrechstifte","Die Uhrzeit","Den Hauptmotor","Den Bogenablager"], a:0, e:"Höhe und Werkzeug der Ausbrechstation passen nicht."},
  {q:"Was macht „Leerhübe“?", o:["Hübe ohne Bogen","Doppelte Geschwindigkeit","Bogen zählen","Not-Halt"], a:0, e:"Die Maschine macht Hübe, ohne Bogen einzuziehen."},
];
let quiz = null;
function viewWissen(v){
  if(SUB === "quiz") return viewQuiz(v);
  if(SUB === "check") return viewCheck(v);
  if(SUB === "pulte") return viewPulte(v);
  if(SUB === "pal") return viewPal(v);
  if(SUB === "palsim") return viewPalSim(v);
  if(SUB === "guide") return viewGuide(v);
  if(SUB === "fehler") return viewFehler(v);
  if(SUB && SUB.startsWith("fehler:")) return viewFehlerEdit(v, SUB.slice(7));
  if(SUB) return viewTopic(v, SUB);
  v.innerHTML = `
    <div class="hero or"><div class="big">📖</div><small>Wissen & Schulung</small><h1>Die Stanze verstehen</h1>
      <p>Für dich und für Azubis – mit eigenen Notizen pro Thema.</p></div>
    <button class="btn" id="startQuiz" style="margin-bottom:12px">🎯 Quiz starten (${QUIZ.length} Fragen)${DB.quizBest?` · Bestwert ${DB.quizBest}/${QUIZ.length}`:""}</button>
    <div class="item" id="goGuide" style="border-left-color:var(--green)"><div class="t"><b>📸 Bedienanleitung mit Fotos</b><small>${GUIDE.reduce((a,g)=>a+g.items.length,0)} Bildschirme Schritt für Schritt – Stanze &amp; Palettierer</small></div><div class="go">›</div></div>
    <div class="item" id="goPal" style="border-left-color:#7b2fd1"><div class="t"><b>🧱 Palettierer Corrpal</b><small>Alle Stationen, Bildschirme, Auftragsfenster und Pult erklärt</small></div><div class="go">›</div></div>
    <div class="item" id="goPulte" style="border-left-color:var(--fox)"><div class="t"><b>🎛️ Bedienpulte &amp; Symbole</b><small>Jeder Knopf an den 3 Pulten erklärt – mit deinen Fotos</small></div><div class="go">›</div></div>
    <div class="item" id="goCheck" style="border-left-color:var(--green)"><div class="t"><b>✅ Rüst-Checkliste</b><small>Schritt für Schritt abhaken – für Azubis · ${DB.checkDone.length}/${DB.checklist.length} erledigt</small></div><div class="go">›</div></div>
    <div class="item" id="goFehler" style="border-left-color:var(--bad)"><div class="t"><b>🛠️ Fehlerbibliothek</b><small>Problem → Ursache → was hilft · ${DB.fehler.length} Einträge</small></div><div class="go">›</div></div>
    <h2>Themen</h2>
    ${TOPICS.map(t=>`<div class="item" data-id="${t.id}" style="border-left-color:var(--accent)"><div class="t"><b>${t.icon} ${t.title}</b>${DB.notes[t.id]?`<small>📝 eigene Notiz</small>`:""}</div><div class="go">›</div></div>`).join("")}`;
  v.querySelectorAll(".item[data-id]").forEach(el => el.onclick = () => { SUB = el.dataset.id; render(); scrollTo(0,0); });
  v.querySelector("#goGuide").onclick = () => { SUB="guide"; guideSel=null; render(); scrollTo(0,0); };
  v.querySelector("#goPal").onclick = () => { SUB="pal"; render(); scrollTo(0,0); };
  v.querySelector("#goPulte").onclick = () => { SUB="pulte"; render(); scrollTo(0,0); };
  v.querySelector("#goCheck").onclick = () => { SUB="check"; render(); scrollTo(0,0); };
  v.querySelector("#goFehler").onclick = () => { SUB="fehler"; render(); scrollTo(0,0); };
  v.querySelector("#startQuiz").onclick = () => { quiz = {i:0, score:0, order:[...QUIZ.keys()].sort(()=>Math.random()-.5), done:false, ans:null}; SUB="quiz"; render(); scrollTo(0,0); };
}

/* ---------- Bedienpulte / Symbol-Lexikon ---------- */
/* Positionen in Prozent des Bildes. sicher: ✔ = eindeutig, ~ = wahrscheinlich, ? = unsicher – bitte vor Ort prüfen */
const S = {
  nothalt:{n:"NOT-HALT", d:"Roter Pilz auf gelbem Grund: stoppt sofort alles. Zum Entriegeln drehen. Danach Sicherheit quittieren.", c:"✔"},
  motor:{n:"Hauptantrieb Aus / Ein", d:"Motor-Symbol. Roter Taster = Aus/Stopp, weißer Leuchttaster = Ein. Leuchtet weiß, wenn der Hauptmotor läuft (Status „Hauptmotor Ein“).", c:"~"},
  motorAus:{n:"Hauptantrieb Aus", d:"Motor-Symbol mit nur rotem Taster: Antrieb stoppen. Leuchtet rot, solange der Antrieb aus ist.", c:"~"},
  tippen:{n:"Tippen / Einrichten", d:"Hand mit Bewegungspfeilen: Maschine bewegt sich nur, solange du drückst (Tippbetrieb, z. B. beim Einrichten).", c:"~"},
  tiegel:{n:"Tiegel 0° / 180°", d:"Wahlschalter für die Tiegelstellung bzw. Drehrichtung des Hauptantriebs: 0° (Tiegel auf) / 180° (Tiegel zu). Die aktuelle Stellung siehst du im Produktionsbild als „Position Tiegel (°)“.", c:"~"},
  tueren:{n:"Schutztüren / Seitenführungen auf–zu", d:"Zwei Felder mit Pfeilen zueinander/auseinander. Wahrscheinlich Schiebetüren bzw. Seitenführungen öffnen/schließen.", c:"?"},
  geblaese:{n:"Gebläse / Luft", d:"Lüfterrad mit Pfeil: Gebläse bzw. Saug-/Blasluft ein (z. B. Anleger-Saugplatte, „Blasluft“ in der Mada).", c:"~"},
  einschub:{n:"Einschub 0 / 1", d:"Bogenstapel mit Band, 0/1: Bogeneinschub aus/ein. Grüne LED = Einschub läuft (Status „Einschub Ein“), rote LED = aus.", c:"✔"},
  haube:{n:"Haube / Rahmen heben–senken", d:"Rahmen mit Pfeilen hoch/runter. Wahrscheinlich Schutzhaube oder Werkzeugrahmen heben/senken.", c:"?"},
  buendelAus:{n:"Bündel ausschieben", d:"Stapel mit Pfeil: fertiges Bündel aus dem Bogenableger schieben.", c:"?"},
  seitenausr:{n:"Seitenausrichter auf / zu", d:"Stapel zwischen zwei Wänden mit Pfeilen: Seitenausrichter im Bogenableger (Mada: „Seitenausrichter“).", c:"~"},
  fingerHoch:{n:"Finger / Gabel heben–senken", d:"Rechen mit Pfeilen hoch/runter: Non-Stop-Finger bzw. Gabel im Bogenableger (Mada: „Finger“).", c:"~"},
  fingerVor:{n:"Finger / Gabel vor–zurück", d:"Rechen mit Pfeilen links/rechts: Finger bzw. Gabel ein- und ausfahren.", c:"~"},
  fingerAus:{n:"Finger / Gabel einfahren", d:"Rechen mit Pfeil nach rechts: Finger in den Stapel einfahren (Non-Stop-Wechsel).", c:"?"},
  zyklus:{n:"Automatik / Zyklus", d:"Zwei Pfeile im Kreis: automatischen Ablauf starten bzw. quittieren.", c:"?"},
  backstop:{n:"Backstop / Niederhalter", d:"T-Symbol mit Pfeilen: wahrscheinlich Backstop (Mada: „Backstop“) bzw. Anschlag hinten.", c:"?"},
  zwmag:{n:"Zwischenmagazin vor–zurück", d:"Zweiter Rechen: wahrscheinlich Zwischenmagazin (Mada: „Bündelhöhe Abwurf Zwischenmagazin“).", c:"?"},
  zwmagAus:{n:"Zwischenmagazin ausfahren", d:"Zweiter Rechen mit Pfeil: Zwischenmagazin abwerfen/ausfahren.", c:"?"},
  werkzeug:{n:"Stanzwerkzeug klemmen / lösen", d:"Werkzeug mit Schloss zu/offen. Die G-Cut klemmt das Stanzwerkzeug automatisch.", c:"~"},
  platte:{n:"Schneidplatte klemmen / lösen", d:"Schloss über einem Balken: Schneid-Gegenplatte klemmen/lösen (bei der G-Cut automatisch).", c:"~"},
  steuerung:{n:"Steuerung / Schaltschrank", d:"Schaltschrank-Symbol, leuchtet weiß: Steuerspannung liegt an (Status „Steuerung Ein“).", c:"~"},
  einaus:{n:"0 / I – Aus / Ein", d:"Roter Taster 0 = Aus, grüner Taster I = Ein, z. B. für die Steuerung bzw. diesen Anlagenteil.", c:"~"},
  quitt:{n:"Sicherheit quittieren", d:"Tür mit Haken, blauer Leuchttaster: nach dem Schließen der Schutztüren den Sicherheitskreis zurücksetzen. Blau heißt nach EN 60204-1 „Handlung nötig“.", c:"~"},
  schluessel:{n:"Schlüsselschalter 0 → I", d:"Schlüssel: Sonderbetriebsart, z. B. Einrichten. Nur für befugte Personen.", c:"~"},
  arm:{n:"Arm / Saugplatte heben–senken", d:"Bewegtes Teil mit Pfeilen hoch/runter. Wahrscheinlich Saugplatte oder Zuführarm.", c:"?"},
  bandHoch:{n:"Band heben–senken", d:"Band mit Pfeilen hoch/runter.", c:"?"},
  bandVor:{n:"Band vor–zurück", d:"Band mit Pfeilen links/rechts.", c:"?"},
  motorPM:{n:"Geschwindigkeit − / +", d:"Motor mit − und +: Geschwindigkeit dieses Teils langsamer/schneller.", c:"~"},
  geblPM:{n:"Gebläse − / +", d:"Lüfter mit − und +: Luftleistung weniger/mehr.", c:"~"},
  rampePM:{n:"Neigung / Höhe − / +", d:"Keil mit − und +: Neigung bzw. Höhe verstellen.", c:"?"},
  abstand:{n:"Abstand / Breite verstellen", d:"Band mit Doppelpfeil: Abstand bzw. Breite verstellen.", c:"?"},
};
const PULTE = [
  {id:"haupt", t:"Hauptpult (unter dem Bildschirm)", img:"img/pult-haupt.jpg", dx:7, dy:3, pts:[
    ["nothalt",7,12],["motor",28.6,9.3],["tippen",52.4,10],["tiegel",76.5,10],["tueren",12,41.3],["geblaese",52.1,42.7],["einschub",72.3,42.7],["haube",93.7,42.7],
    ["buendelAus",17.2,68],["seitenausr",34.7,68],["fingerHoch",52.4,68.7],["fingerVor",69.6,68.7],["fingerAus",86.8,69],["zyklus",21.1,85.7],["backstop",37.1,85.7],["zwmag",66.6,86.7],["zwmagAus",82.3,86.7]]},
  {id:"stanze", t:"Pult an der Stanze", img:"img/pult-stanze.jpg", dx:6.5, dy:6, pts:[
    ["nothalt",13.9,27.8],["motorAus",35.9,25.3],["werkzeug",54.6,25.3],["tiegel",36.5,68],["platte",54.2,67.5],["haube",72.6,67.5]]},
  {id:"drei", t:"Drittes Pult (bitte Ort eintragen)", img:"img/pult-drei.jpg", dx:5.2, dy:3.5, pts:[
    ["nothalt",8.4,16.3],["steuerung",24.4,12.2],["einaus",27.4,40.7],["motor",40.1,12.2],["tippen",55.8,13],["tiegel",72.3,13],["quitt",88.6,12.2],
    ["geblaese",42.2,41.5],["einschub",55.5,41.9],["arm",69.9,41.9],["schluessel",84.4,41.9],
    ["zyklus",17.5,65.4],["motor",29.5,66.3],["geblaese",42.2,66.3],["einschub",54.9,66.3],["bandHoch",67.5,66.3],["bandVor",80.8,65.9],
    ["motorPM",32.2,83.7],["geblPM",42.8,83.7],["rampePM",66.9,83.7],["abstand",77.8,83.7]]},
];
let pultSel = "haupt", symSel = null;
function viewPulte(v){
  DB.symNotes ||= {}; DB.pultNames ||= {};
  const P = PULTE.find(x=>x.id===pultSel);
  v.innerHTML = `<button class="back" id="back">‹ Wissen</button>
    <div class="chips">${PULTE.map(x=>`<button class="chip ${x.id===pultSel?"on":""}" data-p="${x.id}">${esc(DB.pultNames[x.id]||x.t.split(" (")[0])}</button>`).join("")}</div>
    <div class="card" style="padding:8px"><div style="position:relative">
      <img src="${P.img}" style="width:100%;display:block;border-radius:12px">
      ${P.pts.map(([k,x,y],i)=>`<button data-s="${i}" style="position:absolute;left:${x-(P.dx||0)}%;top:${y-(P.dy||0)}%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;border:2px solid #fff;background:${symSel===i?"var(--fox)":S[k].c==="✔"?"#1f9d55":S[k].c==="~"?"#2b6fde":"#7a7f8c"};color:#fff;font-weight:800;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.5)">${i+1}</button>`).join("")}
    </div>
    <div class="small" style="margin:8px 4px 2px">Tippe auf eine Nummer. <span style="color:#1f9d55">●</span> sicher · <span style="color:#2b6fde">●</span> wahrscheinlich · <span style="color:#7a7f8c">●</span> unsicher – bitte prüfen</div></div>
    ${pultSel==="drei"?`<div class="card"><label class="f" style="margin:0"><span>Wo hängt dieses Pult?</span><input id="pname" value="${esc(DB.pultNames.drei||"")}" placeholder="z. B. Anleger Bedienseite"></label></div>`:""}
    <div id="legend">${P.pts.map(([k],i)=>{ const y=S[k], note=DB.symNotes[k]||"";
      return `<div class="card" id="sym${i}" style="${symSel===i?"outline:3px solid var(--fox)":""}"><div class="row"><b style="flex:1">${i+1}. ${esc(y.n)}</b><span class="tag" style="flex:none">${y.c==="✔"?"sicher":y.c==="~"?"wahrscheinlich":"unsicher"}</span></div>
        <div style="font-size:14px;line-height:1.45;margin:6px 0">${esc(y.d)}</div>
        ${note?`<div class="note" style="background:rgba(242,140,40,.13);border-left:4px solid var(--fox);padding:8px 10px;border-radius:10px;font-size:14px"><b>Bei uns:</b> ${esc(note)}</div>`:""}
        <button class="chip" data-n="${k}" style="margin-top:6px">✏️ ${note?"Ändern":"So ist es bei uns"}</button></div>`; }).join("")}</div>
    <p class="small" style="margin:6px 4px">Die Bedeutungen sind aus den Symbolen, den Bildschirmtexten und der Norm EN 60204-1 abgeleitet. Eine Bedienungsanleitung von Göpfert gibt es öffentlich nicht – im Zweifel gilt die Betriebsanweisung. Deine Korrekturen gelten für das Symbol auf allen Pulten.</p>`;
  v.querySelector("#back").onclick = () => { SUB=null; symSel=null; render(); };
  v.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { pultSel=b.dataset.p; symSel=null; render(); });
  v.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { symSel=+b.dataset.s; render(); document.getElementById("sym"+symSel).scrollIntoView({behavior:"smooth", block:"center"}); });
  const pn = v.querySelector("#pname"); if(pn) pn.onchange = () => { DB.pultNames.drei = pn.value.trim(); save(); render(); };
  v.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
    const k = b.dataset.n;
    const m = modal(`<h3>${esc(S[k].n)}</h3><p class="small" style="margin-bottom:8px">Was macht dieser Knopf bei euch wirklich?</p><textarea id="sn">${esc(DB.symNotes[k]||"")}</textarea><button class="btn" id="ok">Speichern</button><button class="btn light" data-close>Abbrechen</button>`);
    m.querySelector("#ok").onclick = () => { const t = m.querySelector("#sn").value.trim(); if(t) DB.symNotes[k]=t; else delete DB.symNotes[k]; save(); m.remove(); render(); toast("Gespeichert ✓"); };
  });
}

/* ---------- Bedienanleitung mit Fotos ---------- */
const GUIDE = [
 {id:"gcut", t:"Stanze Göpfert G-Cut", icon:"🔨", items:[
  {img:"g-produktion2", t:"Produktion – Hauptbild", s:[
    "Links <b>Jobdaten</b>: prüfen, ob Kunde, Artikel, Format und Bogendicke zum Auftragsschein passen.",
    "<b>Stückzahlen</b>: „Gesamt“ zählt die gestanzten Bogen, „Bündel/Stapel“ die Bogen pro Bündel. Mit dem Stift ✏️ kannst du beide Zähler ändern (z. B. Gesamt bei neuem Auftrag auf 0).",
    "<b>Geschwindigkeit</b>: Sollwert ins Feld tippen oder mit − / + verstellen. Die Zahl darüber ist der Ist-Wert, darunter steht der tatsächliche Ausstoß pro Stunde.",
    "<b>Funktionen</b> rechts: Feld antippen schaltet um, <b>grün = an</b>. „Anstanzen“ für Probebogen, „Einschub Automatik“ für den automatischen Einzug, „Bremsbürste“ an der Ablage, „Leerhübe“ = Hübe ohne Bogen.",
    "<b>Stanzung</b>: Spalt, Druck und Tiegelposition nur ablesen – verstellt wird der Spalt im Korrektur-Bild „Stanze“.",
    "Nach dem Einrichten <b>Korrekturen speichern</b> drücken, damit die Werte beim nächsten Mal wieder da sind.",
    "Unten das <b>Anlagenbild</b>: ein blaues ⓘ zeigt die Station mit einer Meldung."]},
  {img:"g-produktion", t:"Produktion – mit Stanzwerten", s:[
    "Gleiches Bild bei einem anderen Artikel: hier mit Druck 238 t und Spalt −1,34.",
    "Die Statusleuchten oben rechts müssen für die Produktion grün sein: Steuerung Ein, Sicherheit OK, Hauptmotor Ein, Einschub Ein."]},
  {img:"g-anleger", t:"Korrektur – Anleger", s:[
    "Über <b>Korrektur</b> links öffnen, mit den Punkten unten durch die Seiten blättern.",
    "Jeder Kasten gehört zu dem Teil, auf das die Linie zeigt. Mit den Pfeiltasten fährst du das Teil, die Zahl zeigt den Wert.",
    "<b>🔗 grün</b> = Antriebs- und Bedienseite sind gekoppelt (z. B. 634,0 / −634,0). Kette antippen löst die Kopplung, dann jede Seite einzeln einstellen.",
    "<b>⏩| grün</b> = fährt automatisch auf das Format.",
    "Der grüne Lichtkegel ist der Bogensensor. Das Lüfter-Symbol schaltet das Gebläse."]},
  {img:"g-stanze", t:"Korrektur – Stanze", s:[
    "<b>Spalt</b> links (AS) und rechts (BS) mit − / + verstellen. Mit 🔗 grün ändern sich beide gleich.",
    "Schneidet es nicht durch: Spalt in kleinen Schritten verringern (negativer = mehr Druck). Die Druckanzeige (z. B. 238 t) steigt dann.",
    "Die beiden Temperaturen sind Messwerte. Der rote Balken rechts zeigt die Tiegelstellung.",
    "<b>ARF</b> ist eine Funktion zum Einlernen (siehe „ARF Teachen“ im Produktionsbild)."]},
  {img:"g-ausbrech", t:"Korrektur – Ausbrechstation", s:[
    "Oben links und Mitte: Seitenführungen (gekoppelt mit 🔗).",
    "Oben Mitte <b>↓ ↑</b>: Höhe des Oberteils – bleibt Abfall hängen, hier nachstellen.",
    "Rechts: Format-/Anschlagposition, unten rechts die Position des Unterteils mit Kopplung."]},
  {img:"g-ablage", t:"Korrektur – Bogenablager", s:[
    "Seitenführungen oben (🔗 gekoppelt) und unten, Hinteranschlag rechts unten.",
    "Oben rechts die <b>Bürstenwalze</b> mit ↻ / ↺ verstellen.",
    "Feld „100“ in der Mitte = Stapelhöhe. Die grünen ⏩|-Tasten fahren die Teile automatisch auf Format."]},
  {img:"g-austransport", t:"Korrektur – Austransport", s:[
    "Linkes Band: Geschwindigkeit mit − / + (z. B. 50), Pfeile fahren das Band vor/zurück.",
    "Rechtes Band: Zeit (z. B. 0,5 s) mit − / +, Höhe mit ↓ ↑ (z. B. 342 oder 555), Kette koppelt es an das linke Band."]},
  {img:"g-stopper", t:"Korrektur – Stopperüberwachung", s:[
    "Für jede Station (Bogenableger, Ausbrechstation, Stanztiegel Auslauf, Bogenübergabe, Frontanschlag) gibt es einen Sensor auf AS und BS.",
    "<b>0|I</b> schaltet die Überwachung, grüner Punkt = Sensor in Ordnung.",
    "Die Felder (150 / 1085) sind die Kontrollpunkte in mm ab Bogenvorderkante.",
    "Unten: Bogenimpulse und Stauüberwachung AS/BS. <b>Überwachungen nicht abschalten, um eine Störung zu umgehen.</b>"]},
  {img:"g-auftrag", t:"Auftrag – Auftragsliste", s:[
    "Oben die Liste der geplanten Aufträge, der grüne ist ausgewählt. Mit den Pfeiltasten rechts die Reihenfolge ändern.",
    "Darunter suchen: Kunde, Artikel oder Auftrag ins Feld tippen, Trichter ✕ löscht den Filter.",
    "Rechts: <b>Positionieren</b> fährt die Maschine aufs Format des Auftrags, <b>Neuer Auftrag</b>, <b>Auftrag bearbeiten</b>, <b>Auftrag als Vorlage</b> (von einem ähnlichen Artikel starten), <b>Von Liste löschen</b>."]},
  {img:"g-a-allgemein", t:"Auftrag bearbeiten › Allgemein", s:[
    "Kunde, Artikel, Auftrag eintragen.",
    "<b>Wellenmaß</b> und <b>Bogenmaß</b> (mm) vom Bogen eintragen – das ist das WPA-Maß auf der Laufkarte. <b>Bogendicke</b> dazu.",
    "<b>Ableger</b> ist die Position im Bogenableger. Beim Artikel 1695 lag sie 25 mm unter dem Wellenmaß (743 → 718) und 20 mm unter dem Bogenmaß (1269 → 1249).",
    "<b>Nutzen längs</b> × <b>Nutzen quer</b> = Nutzen pro Bogen (Laufkarte „Nutzen“). <b>Bündelstückzahl</b> = Bogen pro Bündel im Ableger.",
    "<b>Speichern</b> oder <b>In Liste setzen</b>."]},
  {img:"g-a-arf", t:"Auftrag bearbeiten › ARF", s:[
    "ARF arbeitet mit <b>Druckmarken</b> auf dem Bogen (Lage: z. B. Unten), um den Bogen passgenau zum Druck auszurichten.",
    "<b>Modus</b>: Aus, wenn ohne Druckmarken gestanzt wird. <b>Abstand Vorderkante</b>: wo die Marke sitzt.",
    "<b>ARF Teachen</b> ankreuzen, damit die Maschine die Marke einlernt. <b>Preset</b> „Werte durch Teachen“, darunter die erkannte <b>Druckmarkenfarbe</b>."]},
  {img:"g-a-werkzeuge", t:"Auftrag bearbeiten › Werkzeuge", s:[
    "<b>Stanzdruck (t)</b> als Vorgabe, <b>Maß Klemmung oben/unten</b> (mm) für die Werkzeugklemmung.",
    "Rechts die Skizze: die roten Kreuze sind die <b>Unterstützungsbalken</b>. Die Felder (z. B. −495 / 495, 155, 590) geben ihre Position an – so setzen, dass sie nicht unter Messern oder Ausbruch liegen.",
    "<b>Unterstützungsbalken gekoppelt</b> grün = beide Seiten fahren gleich. ↻ dreht die Ansicht."]},
  {img:"g-a-manuell", t:"Auftrag bearbeiten › Manuell", s:[
    "Feinkorrektur von Hand, wenn Ausbrechen nicht genau passt:",
    "<b>Handverstellung Ausbrechstation</b>: Register AS, Register BS (vor/zurück je Seite) und Seitenverstellung (quer).",
    "<b>Handverstellung Abschlagbrett</b>: genauso fürs Abschlagbrett. Kleine Schritte, danach Probebogen prüfen."]},
  {img:"g-a-bemerkungen", t:"Auftrag bearbeiten › Bemerkungen", s:["<b>Neue Bemerkung</b> für Hinweise zum Artikel, z. B. „Wölbung max. 10 mm“ oder Probleme beim letzten Lauf."]},
  {img:"g-a-historie", t:"Auftrag bearbeiten › Auftragshistorie", s:[
    "Alle Läufe mit Start, Ende, Zeit und Menge.",
    "Statistik: Läufe, Menge gesamt, Menge pro Lauf und <b>Zeit pro 100 Nutzen</b> – gut zum Abschätzen, wie lange der Auftrag dauert."]},
  {img:"g-meldungen", t:"Meldungen", s:[
    "Meldung in der Liste antippen – rechts stehen die Details mit <b>Nr.</b> und <b>Schaltplan</b>-Stelle. Die beiden für den Elektriker notieren.",
    "Unten filtern: Fehler 🔺, Warnung ⚠️, Info ⓘ, Sicherheit 🛡️.",
    "Ursache beheben, dann <b>Quittieren</b>. <b>Archiv</b> zeigt alte Meldungen, <b>Hilfe</b> und <b>Schaltplan</b> geben mehr Infos."]},
  {img:"g-mada", t:"Maschine – Mada (Maschinendaten)", s:[
    "Reiter <b>Mada</b> › links das Aggregat wählen (z. B. Bogenableger) › Gruppen mit ⌃ auf-/zuklappen.",
    "Hier stehen Grundwerte wie Min./Max. Bündelhöhe (50 / 410 mm) und die Fettschmierung (120 s an, 2400 min Pause).",
    "<b>Nur mit Befugnis ändern</b> und dann „Speichern“ – die Werte gelten für alle Aufträge."]},
  {img:"g-sicherheit", t:"Sicherheit", s:[
    "3D-Bild der Anlage: blaue Türsymbole = Schutztüren, gelbe Ringe = Not-Halt-Taster. Eine offene Tür bzw. ein gedrückter Not-Halt wird hier angezeigt.",
    "Tür schließen bzw. Not-Halt entriegeln, dann <b>Reintegration</b> drücken. <b>Abläufe stoppen</b> hält automatische Abläufe an, <b>Drehen</b> dreht die Ansicht."]},
 ]},
 {id:"corrpal", t:"Palettierer Corrpal", icon:"🧱", items:[
  {img:"c-produktion", t:"Produktion", s:[
    "<b>Jobdaten</b>: Kunde, Artikel und <b>Bündelhöhe</b> prüfen.",
    "<b>Stückzähler</b>: Lagen Soll / Ist und Paletten Soll / Ist.",
    "<b>Geschwindigkeit</b> in %: Band, Drehung (Drehtisch), Gabel und Lift – jeweils mit eigener Beschleunigung. Mit − / + verstellen, bei Problemen (Stapel verrutschen) langsamer bzw. sanfter beschleunigen.",
    "Rechts sieht man, wie die Bündel beim Eintransport und Austransport liegen.",
    "<b>Korrekturen speichern</b> sichert die Werte zum Artikel."]},
  {img:"c-korrektur", t:"Korrektur – Anlagenbild", s:[
    "Alle Stationen von BS1 (Brecher) bis CV2 (Austransport). Grün = bereit. Die Farbrahmen sind die Automatik-Bereiche 1–4, oben rechts einzeln startbar.",
    "Oben links <b>Automatik</b> für die ganze Anlage.",
    "Unten: <b>Räumen</b> fährt die Anlage leer, <b>PAL Räumen</b> nur den Palettierer, <b>Kein Schutzbogen</b>, <b>Musterbogen</b> (Muster entnehmen), <b>Reintegration</b> nach Tür offen, <b>Abläufe stoppen</b>.",
    "Tür-, Schloss- und gelbe Ring-Symbole zeigen Schutztüren und Not-Halt. Stationen im Detail: siehe „Palettierer Corrpal“."]},
  {img:"c-auftrag", t:"Auftrag – Liste", s:[
    "Gleiche Liste wie an der Stanze. Rechts der ausgewählte Auftrag mit Bündelhöhe und Bündelbild.",
    "<b>Auftrag bearbeiten</b> öffnet das Auftragsfenster mit 7 Reitern (nächste Seiten)."]},
  {img:"c-a-allgemein", t:"Auftrag › Allgemein", s:[
    "Kunde, Artikel, Auftragsnummer eintragen.",
    "<b>Bündelhöhe</b> (mm) eingeben oder mit dem Taschenrechner berechnen, <b>Lagenanzahl</b> eingeben – die <b>Stapelhöhe</b> rechnet die Maschine (z. B. 138 × 10 = 1380 mm).",
    "„Manuelle Eingabe“ nur ankreuzen, wenn die Werte nicht automatisch berechnet werden sollen."]},
  {img:"c-a-eintransport", t:"Auftrag › Eintransport", s:[
    "Rechts das Bündelmaß (z. B. 998 × 464) und wie viele Bündel nebeneinander kommen – mit + ergänzen.",
    "Links <b>Zyklen Brecher 1</b> und <b>Brecher 2</b>: wie oft gebrochen wird. Bricht es nicht sauber, Zyklen erhöhen.",
    "„Vor Brechen nicht sammeln“ ankreuzen, wenn jedes Bündel einzeln gebrochen werden soll."]},
  {img:"c-a-austransport", t:"Auftrag › Austransport", s:[
    "Links eine <b>Vorlage</b> für das Lagenmuster wählen, rechts siehst du die Lage auf der Palette.",
    "<b>Palettenformat</b> wählen (z. B. Europalette 800 × 1200 × 150) oder mit ✏️ ein eigenes anlegen.",
    "Mit den Tasten rechts Bündel drehen, verschieben oder spiegeln, 🗑 löscht. Das <b>Lagenformat</b> wird angezeigt."]},
  {img:"c-a-optionen", t:"Auftrag › Optionen", s:[
    "<b>Zwischenbogen</b>: in welche Lagen ein Zwischenbogen kommt (Keine / Alle / 1,3,5 / 2,4,6 / eigene), darunter die Größe (keiner / ganz / halb).",
    "<b>Lage wenden</b>: welche Lagen gewendet werden.",
    "<b>Stapel ausrichten</b>: welche Lagen ausgerichtet werden – „Alle“ gibt saubere Paletten.",
    "<b>Schutzbogen</b>: Art des Schutzbogens oben/unten und <b>Schutzbogenmaß</b>. Grün = ausgewählt."]},
  {img:"c-a-simulation", t:"Auftrag › Simulation", s:[
    "Ablauf vorher am Bildschirm testen: ▶ startet, ⏭ geht Schritt für Schritt, ↺ setzt zurück, − / + ändert die Geschwindigkeit.",
    "So siehst du vor dem Start, ob Muster, Wenden und Zwischenbogen passen.",
    "Zum Üben gibt es die Simulation auch in dieser App: 🧱 Palettierer Corrpal › ▶️ Simulation starten."]},
  {img:"c-a-bemerkungen", t:"Auftrag › Bemerkungen", s:[
    "<b>Neue Bemerkung</b> für Hinweise zum Artikel (z. B. „langsamer drehen, Stapel kippen“). Ändern und Löschen rechts.",
    "Tipp: Dieselben Hinweise kannst du auch im Fox-Stanze-Rüstblatt speichern."]},
  {img:"c-a-historie", t:"Auftrag › Auftragshistorie", s:[
    "Alle bisherigen Läufe mit Start, Ende, Zeit und Menge. Rechts die Statistik: Läufe, Menge gesamt, Menge pro Lauf, Zeit pro 100 Lagen.",
    "Unten im Fenster: <b>Berechnen</b>, <b>Speichern</b>, <b>In Liste setzen</b> (Auftrag in die Auftragsliste), <b>Abbrechen</b>."]},
  {img:"c-meldungen", t:"Meldungen", s:[
    "Wie an der Stanze: Meldung antippen, rechts Details mit Nr. und Schaltplan.",
    "Filter für Fehler, Warnung, Info, Sicherheit und Maschine. <b>Reintegration</b> und <b>Quittieren</b> unten."]},
  {img:"c-sollist", t:"Maschine › Soll-/Ist-Werte", s:[
    "Links ein Aggregat wählen (MA = gesamte Maschine, Separator 1 … Dispenser Palletiser 1).",
    "Rechts jede Achse mit Soll, Ist und Status (grün = in Ordnung), z. B. Achse 250 Stapelhöhe.",
    "Unten kann ein Wert mit − / + verstellt werden – nur wenn du dazu befugt bist."]},
  {img:"c-mada", t:"Maschine › Mada", s:[
    "Maschinendaten: <b>Module</b>, <b>Achsen</b>, <b>Tastermodule</b>, <b>Antriebe</b>, <b>Host Info</b>. Mit › öffnen.",
    "Nur für Instandhaltung und befugte Personen."]},
  {img:"c-bde", t:"Maschine › BDE", s:[
    "Betriebsdatenerfassung je Aggregat (Name / Wert), z. B. Laufzeiten und Zähler."]},
  {img:"c-wartung", t:"Maschine › Wartung", s:[
    "<b>Speed Test</b> für die Instandhaltung.",
    "Unten: <b>Bildschirm reinigen</b> sperrt den Touchscreen kurz zum Abwischen, <b>Bildschirm kalibrieren</b> wenn Berührungen falsch erkannt werden."]},
  {img:"c-diagnose", t:"Maschine › Diagnose › Kopplung", s:[
    "Zeigt die Signale zwischen Stanze und Palettierer. Grüner Punkt = Signal aktiv.",
    "<b>Transfersystem</b>: Receive „Release Outfeed“ (Stanze darf ausgeben); Send: Double Stacking, Request Outfeed, Outfeed Manual, Outfeed Running.",
    "<b>PalletInfeed</b>: Pallet Stack In Position / Running; Send: Manual Backward / Forward, Release Infeed Pallet, Request Pallet.",
    "Hängt die Übergabe von der Stanze, hier schauen, welches Signal fehlt. Reiter <b>SPS</b> ist für den Elektriker."]},
  {img:"c-benutzer", t:"Maschine › Benutzer", s:[
    "Anmelden: Benutzer wählen, Passwort, <b>Login</b>. Je nach Gruppe sind mehr Einstellungen frei.",
    "Gruppen: <b>Operator</b> (Bediener), <b>mMaintenance</b> (Mechanik), <b>eMaintenance</b> (Elektrik), <b>IBN</b> (Inbetriebnahme Göpfert), <b>DEV</b> (Entwicklung). Passwörter niemals in dieser App speichern."]},
  {img:"c-sprache", t:"Maschine › Sprache", s:[
    "Deutsch oder Englisch antippen, dann <b>Ok</b>. Gut für Kollegen, die besser Englisch lesen."]},
  {img:"c-datum", t:"Maschine › Datum / Uhrzeit", s:[
    "Mit ▲ ▼ einstellen, <b>Speichern</b>. <b>Zurücksetzen</b> verwirft. Die Uhrzeit ist wichtig für Meldungen und BDE."]},
 ]},

 {id:"stationen", t:"Corrpal Stationsfenster", icon:"🧩", items:[
  {img:"s-bs1-schritte", st:"BS1", t:"BS1 Brecher 1 › Schrittliste", s:[
    "<b>0 Infeed Conveyor Common</b> (1364, SingleInfeed): Bündel fährt von der Stanze in den Brecher.",
    "<b>1 Break</b>: Brecher bricht das Bündel an den Haltepunkten – das Symbol ←┆→ zeigt die Bruchlinie.",
    "<b>2 Outfeed Conveyor Common</b> (1164, ClearConveyor): die Nutzen-Stapel fahren weiter zu AC1.",
    "Oben rechts die <b>Bündelhöhe</b> (hier 138 mm) – kommt aus dem Auftrag."]},
  {img:"s-ac1-korrektur", st:"AC1", t:"AC1 Winkelförderer 1 › Korrektur", s:[
    "Kleine Tabelle: <b>#</b> = Zeile (Stapel 1), darunter zwei Felder – unter <b>X▶</b> (hier 1) und unter <b>+/−</b> (hier 0).",
    "Wahrscheinlich Position bzw. Versatz in Förderrichtung; 0 = keine Korrektur. <i>Bedeutung nicht sicher – bitte an der Maschine prüfen.</i>",
    "AC2 und AC3 haben dieselbe Tabelle."]},
  {img:"s-ac1-steuern", st:"AC1", t:"AC1 Winkelförderer 1 › Steuern", s:[
    "Längsbänder (blau) und Querrollen. <b>← →</b> fährt die Bänder, die <b>schrägen Pfeile</b> das andere Band.",
    "<b>↓ ↑</b> hebt/senkt die Rollen – damit wird umgeschaltet, in welche Richtung der Stapel weiterfährt.",
    "Rechts der Pfeil mit 🔗 = Eingang (gekoppelt an BS1), oben der Pfeil mit 🔗 = Ausgang (gekoppelt an BS2)."]},
  {img:"s-ac1-schritte", st:"AC1", t:"AC1 Winkelförderer 1 › Schrittliste", s:[
    "<b>Infeed Conveyor 1</b> (1574): Stapel fährt ein.",
    "<b>1 Outfeed Conveyor 2</b> (1629, ClearConveyor): Stapel fährt im 90°-Winkel raus (Symbol ↰)."]},
  {img:"s-bs2-korrektur", st:"BS2", t:"BS2 Brecher 2 › Korrektur", s:[
    "Oben (Stapel mit ↕, hier 0): Höhenkorrektur – wahrscheinlich für den orangen Niederhalter oben.",
    "Rechts (hier 4,0, grüner Balken): Korrekturwert für das Brechen. <i>Genaue Bedeutung nicht sicher.</i>",
    "Unten links Tacho (60) = Geschwindigkeit in %, unten rechts ←→ (0) = Versatz quer.",
    "Bricht es nicht sauber: erst Zyklen im Auftrag prüfen, dann hier in kleinen Schritten korrigieren."]},
  {img:"s-bs2-steuern", st:"BS2", t:"BS2 Brecher 2 › Steuern", s:[
    "Links und rechts je <b>↓ ↑</b> (zwei Reihen) mit Wert 420: Niederhalter bzw. Brechbalken heben/senken.",
    "<b>← →</b> mit 🔗: die Bänder fahren, gekoppelt.",
    "Unten <b>↺ ↻</b> mit 360: Brechwelle drehen (Position in Grad).",
    "Oben und unten Pfeil mit 🔗 = Ein- und Ausgang. Handbetrieb nur, wenn niemand in der Anlage ist."]},
  {img:"s-bs2-schritte", st:"BS2", t:"BS2 Brecher 2 › Schrittliste", s:[
    "<b>Infeed Conveyor Common</b> (1250) und <b>1 Outfeed Conveyor Common</b> (1348).",
    "Hier steht <b>kein Break-Schritt</b> – bei diesem Auftrag bricht BS2 also nicht, die Stapel laufen nur durch. Das Symbol ↕ zeigt die Bruchrichtung (quer zu BS1)."]},
  {img:"s-ac2-korrektur", st:"AC2", t:"AC2 Winkelförderer 2 › Korrektur", s:["Gleiche Tabelle wie bei AC1: Zeile 1, X▶ = 1, +/− = 0."]},
  {img:"s-ac2-steuern", st:"AC2", t:"AC2 Winkelförderer 2 › Steuern", s:[
    "<b>← →</b> Bänder, <b>schräge Pfeile</b> zweites Band, <b>↓ ↑</b> Rollen heben/senken.",
    "Unten Pfeil mit 🔗 = Eingang von BS2, links Pfeil mit 🔗 = Ausgang zum Drehtisch TT1."]},
  {img:"s-ac2-schritte", st:"AC2", t:"AC2 Winkelförderer 2 › Schrittliste", s:[
    "<b>Infeed Conveyor 1</b> (1834), <b>1 Outfeed Conveyor 2</b> (−1274, ClearConveyor).",
    "Der negative Wert heißt: das Band fährt in die andere Richtung (Symbol ↰)."]},
  {img:"s-tt1-korrektur", st:"TT1", t:"TT1 Drehtisch › Korrektur", s:[
    "Tabelle mit <b>#</b>, <b>X▶</b>, <b>+/−</b> und <b>↻</b>: Zeile 1 – X▶ 1, +/− 0, Drehung <b>−90</b>.",
    "Im Auswahlfeld (▼) den <b>Drehwinkel</b> wählen, z. B. −90°, 0° oder +90°. So liegen die Stapel richtig fürs Lagenmuster."]},
  {img:"s-tt1-steuern", st:"TT1", t:"TT1 Drehtisch › Steuern", s:[
    "<b>← →</b> Rollen fahren, <b>↓ ↑</b> Drehteller (Mitte) heben/senken, <b>↺ ↻</b> drehen.",
    "Links und rechts Pfeil mit 🔗 = Ein- und Ausgang."]},
  {img:"s-tt1-schritte", st:"TT1", t:"TT1 Drehtisch › Schrittliste", s:[
    "<b>Infeed Conveyor 1</b> (1614): Stapel fährt auf den Tisch.",
    "<b>1 Rotate −90°</b>: Tisch dreht den Stapel um 90°.",
    "<b>2 Outfeed Conveyor 1</b> (1649): Stapel fährt weiter zu CV1."]},
  {img:"s-cv1-steuern", st:"CV1", t:"CV1 Förderband 1 › Steuern", s:[
    "Einfaches Band – deshalb nur die Reiter Steuern und Schrittliste, keine Korrektur.",
    "<b>← →</b> fährt das Band, links und rechts Pfeil mit 🔗 = gekoppelt an TT1 und AC3."]},
  {img:"s-cv1-schritte", st:"CV1", t:"CV1 Förderband 1 › Schrittliste", s:[
    "<b>Infeed Conveyor 1</b> (1389) und <b>1 Outfeed Conveyor 1</b> (1389): Stapel einfahren und geradeaus weiterfördern (Symbol ←)."]},
  {img:"s-ac3-korrektur", st:"AC3", t:"AC3 Winkelförderer 3 › Korrektur", s:["Gleiche Tabelle wie bei AC1: Zeile 1, X▶ = 1, +/− = 0."]},
  {img:"s-pal1-schritte", st:"PAL1", t:"PAL1 Palettierer › Schrittliste", s:[
    "Im Korrektur-Anlagenbild eine Station antippen – es öffnet sich ihr Fenster mit 3 Reitern: <b>Korrektur</b>, <b>Steuern</b>, <b>Schrittliste</b>.",
    "Die Schrittliste zeigt, was die Station bei jeder Lage macht. ▶ = aktueller Schritt. Beim PAL1: <b>0 Add Intermediate Layer</b> (Zwischenlage), <b>1 Infeed Conveyor 1</b> (Lage einfahren, 1464, SingleInfeed), <b>2 Move To Stack</b> (zum Stapel fahren), <b>3 Stack Layer</b> (Lage absetzen, 928 × 998 = Lagenmaß), <b>4 Palletiser Outfeed</b> (Palette raus).",
    "Unten: <b>Daten von Steuerung übernommen</b> grün = Werte kommen vom Auftrag. <b>Lage</b>, <b>Zurücksetzen</b> und <b>Ausführen</b> führen einen Schritt von Hand aus – nur wenn du weißt, was passiert, und nichts im Weg ist.",
    "<b>Positionieren</b> fährt die Station aufs Auftragsformat, <b>Automatik</b> startet sie im Automatikbetrieb, <b>Schließen</b> schließt das Fenster."]},
  {img:"s-pal1-steuern", st:"PAL1", t:"PAL1 Palettierer › Steuern", s:[
    "3D-Bild des Palettierers: oben der Rahmen mit den <b>Gabelzinken</b>, auf denen die Lage kommt, die gelben Seitenanschläge und türkisen Ausrichter, unten der <b>Hubtisch</b> mit der Palette.",
    "Ablauf: Lage fährt auf die Gabel, Anschläge richten sie aus, die Gabel zieht heraus und die Lage fällt auf den Stapel, der Hubtisch senkt um eine Lagenhöhe.",
    "In diesem Reiter kann man Teile von Hand fahren (Handbetrieb). Vorher Bereich prüfen – niemand in der Anlage."]},
  {img:"s-pal1-korrektur", st:"PAL1", t:"PAL1 Palettierer › Korrektur", s:[
    "Oben links: <b>Zwischenlage</b> Keine / Alle / 1,3,5 / 2,4,6 / … (eigene Auswahl). Grün = gewählt.",
    "Links an der Gabel <b>Stapel 1</b> und <b>2</b> (z. B. 928 / 923), unten auf der Palette (998 / 993): Maße der Anschläge für die Lage, mit − / + nachstellen, wenn die Lage nicht sauber liegt.",
    "Rechts oben <b>Lagen Soll / Ist</b> und <b>Paletten Soll / Ist</b>. Darunter Korrekturen für die Ablage (Höhe/Versatz beim Absetzen) und den hinteren Anschlag (|←), meist 0."]},
  {img:"s-dis1-schritte", st:"DIS1", t:"DIS1 Zwischenbogen-Spender › Schrittliste", s:[
    "<b>0 Dispenser Pickup</b> (Sheet): Sauger nehmen einen Bogen vom Stapel.",
    "<b>1 Dispenser Drop</b> (Sheet): Bogen wird abgelegt.",
    "Läuft nur bei den Lagen, die bei Zwischenbogen eingestellt sind."]},
  {img:"s-dis1-steuern", st:"DIS1", t:"DIS1 Zwischenbogen-Spender › Steuern", s:[
    "Saugkreuz mit den grünen Saugern über dem Bogenstapel.",
    "<b>↓ ↑</b> Saugkreuz senken/heben, Sauger-Tasten Vakuum an/aus, <b>← →</b> Wagen fahren (Position z. B. 1767).",
    "Wenn kein Bogen kommt: Stapel leer? Sauger sauber und dicht?"]},
  {img:"s-dis1-korrektur", st:"DIS1", t:"DIS1 Zwischenbogen-Spender › Korrektur", s:[
    "Obere Reihe: in welche Lagen ein Zwischenbogen kommt – Keine / Alle / 1,3,5 / 2,4,6 / … (eigene).",
    "Untere Reihe: Größe – <b>kein Bogen</b> (☒), <b>ganzer Bogen</b>, <b>zwei halbe</b>. Grün = gewählt.",
    "Die Laufkarte sagt z. B. „mit Zwischenlagen“ – dann hier passend wählen."]},
  {img:"s-li1-schritte", st:"LI1", t:"LI1 Lagenwender › Schrittliste", s:[
    "<b>Infeed Conveyor 1</b> (1314, SingleInfeed): Lage fährt in die Trommel.",
    "<b>1 Turn Over</b>: Trommel dreht – die Lage wird gewendet.",
    "<b>2 Outfeed Conveyor 1</b> (ClearConveyor): Lage fährt raus. Wird nicht gewendet, läuft die Lage nur durch.",
    "Oben links die drei Band-Symbole <b>− = +</b>: Bandgeschwindigkeit langsamer / normal / schneller."]},
  {img:"s-li1-steuern", st:"LI1", t:"LI1 Lagenwender › Steuern", s:[
    "Trommel mit zwei Bändern (oben/unten), dazwischen liegt die Lage.",
    "<b>↕</b> Abstand der Bänder (Klemmung, z. B. 2), <b>↺ ↻</b> Trommel drehen, Pfeile auf dem Band = Band vor/zurück.",
    "Die Ketten 🔗 oben und unten koppeln das Band an die Station davor bzw. danach."]},
  {img:"s-li1-korrektur", st:"LI1", t:"LI1 Lagenwender › Korrektur", s:[
    "<b>Lage wenden</b>: Keine / Alle / 1,3,5 / 2,4,6 / … – hier „Keine“.",
    "Wenden z. B. jede zweite Lage, wenn die Bogen eine Wölbung haben – dann wird die Palette gerader.",
    "Rechts oben <b>Lage</b>: aktuelle Lagennummer."]},
  {img:"s-apc1-schritte", st:"APC1", t:"APC1 Lagenbildung › Schrittliste", s:[
    "<b>0 FrontStop</b> (ShieldActive): Anschlag vorne fährt hoch.",
    "<b>1 Infeed Conveyor 1</b> (1761): Stapel fahren ein.",
    "<b>2 SidePusher</b> (998 / 1298): Seitenschieber schieben die Stapel auf das Lagenmaß zusammen.",
    "<b>3 Add Intermediate Layer</b>: Zwischenlage. <b>4 FrontStop</b> (ShieldPassive): Anschlag runter. <b>5 Outfeed Conveyor 1</b> (928, ClearConveyor): fertige Lage fährt weiter."]},
  {img:"s-apc1-steuern", st:"APC1", t:"APC1 Lagenbildung › Steuern", s:[
    "Gelbe <b>Seitenwände</b> links/rechts (z. B. 649 / −649), mit ← → fahren, 🔗 = gekoppelt.",
    "<b>↓ ↑</b> Frontanschlag senken/heben, schräge Pfeile = Band vor/zurück."]},
  {img:"s-apc1-korrektur", st:"APC1", t:"APC1 Lagenbildung › Korrektur", s:[
    "Rechts das <b>Lagenmaß</b>: Breite (z. B. 998) und Länge (1298) mit − / +. <b>0|I</b> schaltet das Ausrichten ein/aus.",
    "Links: Versatz der Lage (z. B. 0) und das Symbol für Stapel ausrichten (grün = an).",
    "Lage zu locker oder Stapel verrutschen: Maß etwas kleiner. Stapel werden gequetscht: etwas größer."]},
  {img:"s-ac3-schritte", st:"AC3", t:"AC3 Winkelförderer › Schrittliste", s:[
    "<b>Infeed Conveyor 1</b> (1409): Stapel fährt ein.",
    "<b>1 Outfeed Conveyor 2</b> (−1334, ClearConveyor): Stapel fährt im 90°-Winkel über das zweite Band raus (Symbol ↲)."]},
  {img:"s-ac3-steuern", st:"AC3", t:"AC3 Winkelförderer › Steuern", s:[
    "Zwei Bänder: Längsriemen und Querrollen. Mit <b>↓ ↑</b> wird umgeschaltet, welches Band oben ist – so ändert sich die Richtung.",
    "← → und schräge Pfeile fahren die Bänder. 🔗 koppelt an die Nachbarstation.",
    "AC1 und AC2 funktionieren genauso."]},
 ]},
];
{ const F=["BS1","AC1","BS2","AC2","TT1","CV1","AC3","APC1","LI1","DIS1","PAL1","DIP1","CV2"], T=["korrektur","steuern","schritte"];
  const tk = it => T.findIndex(t=>it.img.endsWith(t));
  GUIDE[2].items.sort((a,b)=>F.indexOf(a.st)-F.indexOf(b.st) || tk(a)-tk(b)); }
let guideSel = null;
function viewGuide(v){
  if(guideSel){
    const [gi, ii] = guideSel; const G = GUIDE[gi], it = G.items[ii];
    v.innerHTML = `<button class="back" id="back">‹ ${esc(G.t)}</button>
      <div class="small" style="margin:0 4px 6px">${G.icon} ${esc(G.t)} · ${ii+1} von ${G.items.length}</div>
      <h3 style="font-size:20px;margin:0 4px 10px">${esc(it.t)}</h3>
      <div class="card" style="padding:6px"><img src="img/bs/${it.img}.jpg" id="gimg" style="width:100%;display:block;border-radius:12px"><div class="small" style="text-align:center;margin-top:4px">Antippen zum Vergrößern</div></div>
      <div class="card topic"><h3>So bedienst du es</h3><ol style="margin:0 0 0 20px;font-size:15px;line-height:1.5">${it.s.map(x=>`<li style="margin-bottom:6px">${x}</li>`).join("")}</ol>
        ${DB.notes["g_"+it.img]?`<div class="note"><b>Meine Notiz:</b> ${esc(DB.notes["g_"+it.img])}</div>`:""}
        <button class="chip" id="gnote" style="margin-top:4px">✏️ ${DB.notes["g_"+it.img]?"Notiz ändern":"Eigene Notiz"}</button></div>
      <div class="row" style="gap:8px">${ii>0?`<button class="btn light" id="prev">‹ Zurück</button>`:"<span></span>"}${ii<G.items.length-1?`<button class="btn" id="next">Weiter ›</button>`:"<span></span>"}</div>`;
    v.querySelector("#back").onclick = () => { guideSel=null; render(); scrollTo(0,0); };
    const pv=v.querySelector("#prev"); if(pv) pv.onclick = () => { guideSel=[gi,ii-1]; render(); scrollTo(0,0); };
    const nx=v.querySelector("#next"); if(nx) nx.onclick = () => { guideSel=[gi,ii+1]; render(); scrollTo(0,0); };
    v.querySelector("#gimg").onclick = () => zoomImg(`img/bs/${it.img}.jpg`);
    v.querySelector("#gnote").onclick = () => {
      const k = "g_"+it.img;
      const m = modal(`<h3>Notiz: ${esc(it.t)}</h3><textarea id="gn">${esc(DB.notes[k]||"")}</textarea><button class="btn" id="ok">Speichern</button><button class="btn light" data-close>Abbrechen</button>`);
      m.querySelector("#ok").onclick = () => { const t=m.querySelector("#gn").value.trim(); if(t) DB.notes[k]=t; else delete DB.notes[k]; save(); m.remove(); render(); };
    };
    return;
  }
  v.innerHTML = `<button class="back" id="back">‹ Wissen</button>
    <div class="hero gr"><div class="big">📸</div><small>Bedienanleitung</small><h1>Bildschirm für Bildschirm</h1><p>Deine Fotos mit Schritt-für-Schritt-Erklärung. Kundennamen sind unkenntlich gemacht.</p></div>
    ${GUIDE.map((G,gi)=>`<h2>${G.icon} ${esc(G.t)} <span>${G.items.length} Seiten</span></h2>
      ${G.items.map((it,ii)=>`<div class="item" data-g="${gi},${ii}" style="border-left-color:${["var(--accent)","#7b2fd1","var(--fox)"][gi]}"><img src="img/bs/${it.img}.jpg" loading="lazy" style="width:72px;height:50px;object-fit:cover;border-radius:8px;flex:none"><div class="t"><b style="font-size:15px">${esc(it.t)}</b><small>${it.s.length} Schritte${DB.notes["g_"+it.img]?" · 📝":""}</small></div><div class="go">›</div></div>`).join("")}`).join("")}
    <p class="small" style="margin:8px 4px">Die Erklärungen sind aus den Bildschirmen abgeleitet – bei Abweichungen gilt die Betriebsanweisung.</p>`;
  v.querySelector("#back").onclick = () => { SUB=null; render(); scrollTo(0,0); };
  v.querySelectorAll("[data-g]").forEach(el => el.onclick = () => { guideSel = el.dataset.g.split(",").map(Number); render(); scrollTo(0,0); });
}
function zoomImg(src){
  const el = document.createElement("div"); el.className="ocr";
  let z = 1;
  const draw = () => { el.innerHTML = `<div class="pic"><div class="inner" style="width:${z*100}%"><img src="${src}"></div></div>
    <div class="bot"><button data-z="1" class="${z===1?"go":""}">1×</button><button data-z="2" class="${z===2?"go":""}">2×</button><button data-z="3" class="${z===3?"go":""}">3×</button><button data-x>✕ Schließen</button></div>`;
    el.querySelectorAll("[data-z]").forEach(b => b.onclick = () => { z=+b.dataset.z; draw(); });
    el.querySelector("[data-x]").onclick = () => el.remove(); };
  document.body.appendChild(el); draw();
}

/* ---------- Palettierer Corrpal ---------- */
const PAL_ST = [
  {k:"BS1", n:"Separator 1 – Brecher 1", z:1, b:[84.5,47.9,14.1,23.1], d:"Hier kommt das Bündel von der Stanze an. Der Brecher bricht die gestanzten Bogen an den Haltepunkten (Nicks) auseinander, damit aus dem Bündel einzelne Nutzen-Stapel werden. Im Auftrag: „Zyklen Brecher 1“ = wie oft gebrochen wird."},
  {k:"AC1", n:"Angle Conveyor 1 – Winkelförderer 1", z:1, b:[69,47,15.5,23.9], d:"Fördert die Stapel um 90° weiter (Richtungswechsel)."},
  {k:"BS2", n:"Separator 2 – Brecher 2", z:1, b:[69.7,28.2,13.4,18.8], d:"Zweiter Brecher, bricht in die andere Richtung. Im Auftrag: „Zyklen Brecher 2“."},
  {k:"AC2", n:"Angle Conveyor 2 – Winkelförderer 2", z:1, b:[70.4,0.9,14.1,27.4], d:"Nächster 90°-Richtungswechsel."},
  {k:"TT1", n:"Turntable 1 – Drehtisch", z:2, b:[48.6,1.7,21.8,22.2], d:"Dreht Stapel, damit sie für das Lagenmuster richtig liegen. Geschwindigkeit im Produktionsbild: „Drehung“."},
  {k:"CV1", n:"Conveyor Enhanced 1 – Förderband 1", z:2, b:[33.1,4.3,15.5,17.9], d:"Transportband zwischen Drehtisch und Lagenbildung. Geschwindigkeit: „Band“."},
  {k:"AC3", n:"Angle Conveyor 3 – Winkelförderer 3", z:2, b:[16.2,4.3,16.9,18.8], d:"Dritter Richtungswechsel vor dem Lagenbilden."},
  {k:"DIS1", n:"Dispenser Tie Sheet 1 – Zwischenbogen-Spender", z:3, b:[2.8,4.3,13,17.9], d:"Legt Zwischen- bzw. Schutzbogen ein. Zwischenbogen zwischen den Lagen machen die Palette stabiler für den Transport. Einstellung im Auftrag unter Optionen."},
  {k:"APC1", n:"Align Pattering Conveyor 1 – Lagenbildung", z:2, b:[17.6,23.9,16.2,20.5], d:"Schiebt die Stapel zum Lagenmuster zusammen und richtet sie aus (Symbol ▶◀). Option „Stapel ausrichten“."},
  {k:"LI1", n:"Layer Inverter 1 – Lagenwender", z:2, b:[19,44.4,15.5,18.8], d:"Kann eine ganze Lage wenden. Option „Lage wenden“ (Keine / Alle / 1,3,5 / 2,4,6)."},
  {k:"PAL1", n:"Palletiser 1 – Palettierer", z:2, b:[19.7,63.2,16.2,35.9], d:"Setzt die Lagen mit Gabel und Lift auf die Palette, bis die Lagenanzahl erreicht ist. Geschwindigkeiten: „Gabel“ und „Lift“. Die Stapelhöhe ist bei den Soll-/Ist-Werten Achse 250."},
  {k:"DIP1", n:"Dispenser Palletiser 1 – Paletten-Magazin", z:4, b:[0.7,39.3,19,59.8], d:"Hält leere Paletten bereit und gibt sie an den Palettierer ab."},
  {k:"CV2", n:"Conveyor Enhanced 2 – Austransport", z:2, b:[35.9,83.8,21.8,15.4], d:"Fördert die volle Palette aus der Anlage."},
];
const ZONE_C = {1:"#3aa655", 2:"#3d7fd9", 3:"#a23fc4", 4:"#e08a1e"};
let palSel = null;
const PAL_PULT = [["palLampe",18.1,21.5],["steuerung",28.9,13.6],["nothalt",9,46.5],["einaus",24.7,52.2],["palEinschub",63.3,42],["schluessel",91.6,53.3]];
S.palLampe = {n:"Leuchtmelder „NOT-HALT betätigt“", d:"Leuchtet rot, wenn irgendwo an der Anlage ein Not-Halt gedrückt ist. Den gedrückten Taster suchen (Bildschirm Sicherheit/Korrektur zeigt ihn), entriegeln, dann quittieren.", c:"✔"};
S.palEinschub = {n:"Einschub / Automatik 0 / 1", d:"Gleiches Symbol wie am Anleger der Stanze: Zuführung aus/ein. Grüne LED = läuft (Status „Automatik Ein“).", c:"~"};
function viewPal(v){
  const st = palSel!=null ? PAL_ST[palSel] : null;
  v.innerHTML = `<button class="back" id="back">‹ Wissen</button>
    <div class="hero" style="background:linear-gradient(135deg,#7b2fd1,#3b3fc0)"><div class="big">🧱</div><small>Corrpal · Member of the Göpfert Group</small><h1>Palettierer</h1><p>Steht hinter der Stanze: bricht die Bündel, bildet Lagen und stapelt sie auf Paletten.</p></div>
    <h2>📸 Bildschirme mit Fotos <span>${GUIDE[1].items.length} Seiten</span></h2>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px">${GUIDE[1].items.map((it,ii)=>`<button data-pg="${ii}" style="flex:none;width:132px;border:0;background:var(--card);border-radius:14px;padding:6px;text-align:left;color:var(--text)"><img src="img/bs/${it.img}.jpg" style="width:120px;height:80px;object-fit:cover;border-radius:10px;display:block"><span style="display:block;font-size:12px;font-weight:700;margin-top:4px;line-height:1.25">${esc(it.t)}</span></button>`).join("")}</div>
    <button class="btn fox" id="palSim">▶️ Simulation starten</button>
    <button class="btn light" id="palSt">🧩 Stationsfenster erklärt (${GUIDE[2].items.length} Fotos)</button>
    <button class="btn" id="palGuide" style="margin-bottom:6px">📸 Alle Corrpal-Bildschirme Schritt für Schritt</button>
    <h2>Anlage <span>Tippe auf eine Station</span></h2>
    <div class="card" style="padding:10px"><div style="position:relative;width:100%;padding-top:82%">
      ${PAL_ST.map((x,i)=>`<button data-st="${i}" style="position:absolute;left:${x.b[0]}%;top:${x.b[1]}%;width:${x.b[2]}%;height:${x.b[3]}%;border:3px solid ${ZONE_C[x.z]};border-radius:8px;background:${palSel===i?"rgba(242,140,40,.45)":"rgba(140,210,160,.28)"};color:var(--text);font-weight:800;font-size:11px;padding:0">${x.k}</button>`).join("")}
    </div>
    <div class="small" style="margin-top:6px">Weg des Materials: BS1 → AC1 → BS2 → AC2 → TT1 → CV1 → AC3 → APC1 → LI1 → PAL1 → CV2. Rahmenfarben = Automatik-Bereiche 1–4 (oben rechts am Bildschirm).</div></div>
    ${st?`<div class="card" id="stInfo" style="outline:3px solid var(--fox)"><b>${st.k} · ${esc(st.n)}</b><div style="font-size:14px;line-height:1.45;margin-top:6px">${esc(st.d)}</div><div class="small" style="margin-top:6px">Automatik-Bereich ${st.z}</div>
      ${GUIDE[2].items.some(it=>it.st===st.k)?`<div style="display:flex;gap:8px;overflow-x:auto;margin-top:8px">${GUIDE[2].items.map((it,ii)=>it.st===st.k?`<button data-sg="${ii}" style="flex:none;width:110px;border:0;background:var(--chip);border-radius:12px;padding:5px;color:var(--text);text-align:left"><img src="img/bs/${it.img}.jpg" style="width:100px;height:68px;object-fit:cover;border-radius:8px;display:block"><span style="font-size:11px;font-weight:700">${esc(it.t.split("› ")[1])}</span></button>`:"").join("")}</div>`:`<div class="small" style="margin-top:6px">Für diese Station gibt es noch keine Fotos.</div>`}</div>`:""}
    <div class="card topic"><h3>🔄 Produktion</h3><ul>
      <li><b>Jobdaten</b>: Kunde, Artikel, <b>Bündelhöhe (mm)</b></li>
      <li><b>Stückzähler</b>: Lagen Soll/Ist, Paletten Soll/Ist</li>
      <li><b>Geschwindigkeit</b> in % mit Beschleunigung: <b>Band</b>, <b>Drehung</b> (Drehtisch), <b>Gabel</b> und <b>Lift</b> (Palettierer)</li>
      <li>Rechts: Bündelbild für <b>Eintransport</b> und <b>Austransport</b></li></ul>
      <h3>⌖ Korrektur (Anlagenbild)</h3><ul>
      <li>Alle Stationen mit Kürzel, grün = bereit. Türsymbole = Schutztüren, gelbe Ringe = Not-Halt, Schloss = verriegelte Tür.</li>
      <li>Oben links <b>Automatik</b>, oben rechts die Bereiche <b>1–4</b> einzeln</li>
      <li>Unten: <b>Räumen</b> (Anlage leerfahren), <b>Kein Schutzbogen</b>, <b>PAL Räumen</b> (Palettierer leeren), <b>Musterbogen</b>, <b>Reintegration</b>, <b>Abläufe stoppen</b></li></ul>
      <h3>📂 Auftrag bearbeiten</h3><ul>
      <li><b>Allgemein</b>: Bündelhöhe, Lagenanzahl → Stapelhöhe wird berechnet (z. B. 138 mm × 10 = 1380 mm), „Manuelle Eingabe“</li>
      <li><b>Eintransport</b>: Bündelmaße (z. B. 998 × 464), Zyklen Brecher 1 und 2, „Vor Brechen nicht sammeln“</li>
      <li><b>Austransport</b>: Lagenmuster aus Vorlagen, Palettenformat (Europalette 800 × 1200 × 150), Lagenformat</li>
      <li><b>Optionen</b>: Zwischenbogen, Lage wenden, Stapel ausrichten, Schutzbogen + Schutzbogenmaß. Auswahl: Keine / Alle / 1,3,5 / 2,4,6 / eigene</li>
      <li><b>Simulation</b>: Ablauf vorher am Bildschirm durchspielen ▶</li><li><b>Bemerkungen</b> und <b>Auftragshistorie</b> (Läufe, Menge, Zeit pro 100 Lagen)</li>
      <li>Unten: <b>Berechnen</b>, <b>Speichern</b>, <b>In Liste setzen</b></li></ul>
      <h3>🔧 Maschine</h3><ul>
      <li><b>Soll-/Ist-Werte</b> je Aggregat, z. B. Achse 250 Stapelhöhe</li><li><b>Mada</b>: Module, Achsen, Tastermodule, Antriebe, Host Info</li>
      <li><b>BDE</b> je Aggregat, <b>Wartung</b>: Speed Test, Bildschirm reinigen/kalibrieren</li>
      <li><b>Diagnose › Kopplung</b>: Signale zwischen Stanze und Palettierer (Transfersystem: Release Outfeed, Request Outfeed …; PalletInfeed: Pallet Stack Running …). Grün = Signal aktiv. Hilft, wenn die Übergabe von der Stanze hängt.</li>
      <li><b>Benutzer</b>: Operator (Bediener), mMaintenance/eMaintenance (Mechanik/Elektrik), IBN (Inbetriebnahme Göpfert), DEV (Entwicklung)</li></ul>
      <div class="note">Die Stationsnamen stehen so in der Maschine (Mada/BDE). Die deutschen Erklärungen habe ich daraus abgeleitet – bei Abweichungen gilt die Betriebsanweisung.</div></div>
    <h2>Pult am Palettierer</h2>
    <div class="card" style="padding:8px"><div style="position:relative"><img src="img/pult-corrpal.jpg" style="width:100%;display:block;border-radius:12px">
      ${PAL_PULT.map(([k,x,y],i)=>`<button data-ps="${k}" style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;border:2px solid #fff;background:${S[k].c==="✔"?"#1f9d55":S[k].c==="~"?"#2b6fde":"#7a7f8c"};color:#fff;font-weight:800;font-size:13px">${i+1}</button>`).join("")}</div></div>
    ${PAL_PULT.map(([k],i)=>`<div class="card"><b>${i+1}. ${esc(S[k].n)}</b><div style="font-size:14px;line-height:1.45;margin-top:5px">${esc(S[k].d)}</div>${DB.symNotes&&DB.symNotes[k]?`<div class="small" style="margin-top:5px;color:var(--fox);font-weight:600">Bei uns: ${esc(DB.symNotes[k])}</div>`:""}</div>`).join("")}`;
  v.querySelector("#back").onclick = () => { SUB=null; palSel=null; render(); };
  v.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => { SUB="guide"; guideSel=[1,+b.dataset.pg]; render(); scrollTo(0,0); });
  v.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => { SUB="guide"; guideSel=[2,+b.dataset.sg]; render(); scrollTo(0,0); });
  v.querySelector("#palSt").onclick = () => { SUB="guide"; guideSel=[2,0]; render(); scrollTo(0,0); };
  v.querySelector("#palSim").onclick = () => { SUB="palsim"; render(); scrollTo(0,0); };
  v.querySelector("#palGuide").onclick = () => { SUB="guide"; guideSel=[1,0]; render(); scrollTo(0,0); };
  v.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { palSel=+b.dataset.st; render(); document.getElementById("stInfo").scrollIntoView({behavior:"smooth", block:"center"}); });
}

/* ---------- Stanze-Simulation: neuer Auftrag ---------- */
let GJ = {kunde:"", artikel:"", format:"", dicke:"", speed:"3300", menge:"5000", bpb:"", anst:true,
  welle:"", bogen:"", nl:"", nq:"", zb:"", zl:"", stueck:"", stkStpl:"", stplPal:"4", palL:"1200", palB:"800", palH:"1700", dreh:false, zw:"alle", abdeck:true};
let gTab = "ruesten", gDone = {}, gRun = null;
const fmtParse = f => { const m = String(f||"").replace(/,/g,".").match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i); return m ? [parseFloat(m[1]), parseFloat(m[2])] : null; };
const mm = n => fmt(n, n%1?1:0);
function gSimilar(){
  const d = num(GJ.dicke); if(!d) return null;
  return DB.jobs.filter(j => j.artikel && j.artikel!==GJ.artikel && num(j.dicke)!=null && (j.values.st_spalt_as || j.values.st_druck))
    .sort((a,b) => Math.abs(num(a.dicke)-d) - Math.abs(num(b.dicke)-d))[0] || null;
}
function gChecks(){
  const out = [], F = fmtParse(GJ.format), d = num(GJ.dicke), sp = num(GJ.speed), bpb = num(GJ.bpb), me = num(GJ.menge);
  if(!F) out.push(["warn","Format als „Länge x Breite“ eintragen, z. B. 1235 x 1268."]);
  else { if(Math.min(...F) < 500) out.push(["bad",`Format ${GJ.format}: kleiner als ca. 500 mm – unter dem Mindestformat der G-Cut.`]);
         if(Math.max(...F) > 2100) out.push(["bad",`Format ${GJ.format}: größer als 2100 mm – über dem Maximalformat der G-Cut.`]); }
  if(sp && sp > 6500) out.push(["bad",`Geschwindigkeit ${fmt(sp)}/h: Maximum der G-Cut ist 6500/h.`]);
  if(bpb && d){ const h = bpb*d; out.push([h>=50&&h<=410?"ok":"bad",`Bündelhöhe ${mm(h)} mm (${fmt(bpb)} × ${GJ.dicke} mm) – erlaubt 50–410 mm.`]); }
  if(sp && me) out.push(["ok",`Laufzeit ohne Störungen: ca. ${durTxt(me/sp*3600e3)} für ${fmt(me)} Bogen.`]);
  if(bpb && me) out.push(["ok",`${fmt(Math.ceil(me/bpb))} Bündel${me%bpb?` (letztes mit ${fmt(me%bpb)} Bogen)`:""}.`]);
  const W = num(GJ.welle), Bg = num(GJ.bogen), zb = num(GJ.zb), zl = num(GJ.zl), nl = num(GJ.nl), nq = num(GJ.nq);
  if(nl && nq && num(GJ.stueck)) out.push(["ok",`${nl*nq} Nutzen pro Bogen → ${fmt(Math.ceil(num(GJ.stueck)/(nl*nq)))} Bogen für ${fmt(num(GJ.stueck))} Stück.`]);
  if(W && Bg && zb && zl){
    const fit = Math.max(Math.floor(W/zb)*Math.floor(Bg/zl), Math.floor(W/zl)*Math.floor(Bg/zb));
    if(nl && nq) out.push([fit>=nl*nq?"ok":"bad",`Zuschnitt ${zb} × ${zl} passt ${fit}× in den Bogen ${W} × ${Bg} – eingetragen sind ${nl*nq} Nutzen.`]);
  }
  const P = gPalCalc();
  if(P){ out.push([P.fits?"ok":"bad", `Palette: ${P.cols} × ${P.rows} Stapel${P.rot?" (gedreht)":""}, Lagenformat ${fmt(P.lw)} × ${fmt(P.lb)} mm auf ${fmt(P.L)} × ${fmt(P.B)} mm${P.fits?"":" – steht über!"}.`]);
    if(P.h) out.push([P.h<=P.Hmax?"ok":"bad", `Palettenhöhe ca. ${fmt(P.h)} mm (Stapel ${fmt(P.stackH)} mm + Palette 150 mm) – erlaubt ${fmt(P.Hmax)} mm.`]);
    if(P.lagenRest) out.push(["warn", `Stk/Stpl ${P.stk} ist kein Vielfaches der Bündelstückzahl ${P.bpb} – letzte Lage hat ${P.lagenRest} Stück.`]);
    if(P.perPal && num(GJ.stueck)) out.push(["ok", `${fmt(P.perPal)} Stück pro Palette → ${fmt(Math.ceil(num(GJ.stueck)/P.perPal))} Paletten.`]); }
  const ex = DB.jobs.find(j => j.artikel && j.artikel===GJ.artikel);
  if(ex) out.push(["ok",`Artikel ${GJ.artikel} gibt es schon in Fox Stanze – Werte vom letzten Mal stehen bei den Schritten.`]);
  return out;
}
function gSteps(){
  const F = fmtParse(GJ.format), L = F?F[0]:null, B = F?F[1]:null;
  const ex = DB.jobs.find(j => j.artikel && j.artikel===GJ.artikel), sim = ex || gSimilar(), V = sim ? sim.values : {};
  const src = sim ? (ex ? `vom letzten Mal (Artikel ${sim.artikel})` : `von Artikel ${sim.artikel} (ähnliche Dicke ${sim.dicke} mm)`) : "";
  const rw = (t) => `<span class="tag" style="background:rgba(242,140,40,.15);color:var(--fox)">${t}</span>`;
  const val = (k, f) => V[k] ? `<b>${esc(V[k])}</b> ${src?`<span class="small">${src}</span>`:""}` : (f || "–");
  return [
    {img:"g-auftrag", t:"Auftrag anlegen", s:[`Auftrag › <b>Neuer Auftrag</b> (oder ähnlichen Artikel wählen › <b>Auftrag als Vorlage</b>).`,
      `Eintragen: Kunde <b>${esc(GJ.kunde||"…")}</b>, Artikel <b>${esc(GJ.artikel||"…")}</b>, Bogendicke <b>${esc(GJ.dicke||"…")} mm</b>.`,
      `Wellenmaß <b>${esc(GJ.welle||"…")}</b> → Ableger ${num(GJ.welle)?`Richtwert <b>${fmt(num(GJ.welle)-25)}</b> ${rw("− 25")}`:"…"}, Bogenmaß <b>${esc(GJ.bogen||"…")}</b> → Ableger ${num(GJ.bogen)?`Richtwert <b>${fmt(num(GJ.bogen)-20)}</b> ${rw("− 20")}`:"…"}`,
      `Nutzen längs <b>${esc(GJ.nl||"…")}</b>, quer <b>${esc(GJ.nq||"…")}</b>, Bündelstückzahl <b>${esc(GJ.bpb||"…")}</b>.`,
      "Reiter ARF (Druckmarken), Werkzeuge (Unterstützungsbalken), dann <b>Speichern</b>."]},
    {img:"g-auftrag", t:"Positionieren", s:["Auftrag in der Liste antippen (grün), dann <b>Positionieren</b>.", "Die Maschine fährt alle motorischen Achsen aufs Format. Warten, bis alles steht."]},
    {img:"g-anleger", t:"Anleger prüfen", s:[
      `Seitenführung AS/BS: ${ex&&V.anl_seitenf_as?val("anl_seitenf_as"):B?`Richtwert <b>±${mm(B/2)}</b> mm ${rw("halbe Breite")}`:"–"}`,
      `Hinteranschlag: ${ex&&V.anl_hinteranschlag?val("anl_hinteranschlag"):L?`Richtwert <b>${mm(L)}</b> mm ${rw("= Länge")}`:"–"}`,
      "Bogenstapel einlegen, Anschläge und Seitenführung am Stapel kontrollieren."]},
    {img:"g-stanze", t:"Stanze: Werkzeug, Spalt, Druck", s:["Stanz- und Ausbrechwerkzeug wechseln (Pult an der Stanze: Werkzeug klemmen/lösen).",
      `Spalt: Startwert ${val("st_spalt_as","aus der Maschine übernehmen")}`, `Druck: ${val("st_druck","–")} t`,
      "Lieber etwas offener anfangen und beim Anstanzen in kleinen Schritten zustellen."]},
    {img:"g-ausbrech", t:"Ausbrechstation", s:[`Seitenführungen: ${val("ab_seitenf_as","passend zum Werkzeug")}`, `Höhe Oberteil: ${val("ab_hoehe","–")}`, "Ausbrechstifte prüfen."]},
    {img:"g-ablage", t:"Bogenablager", s:[
      `Seitenführung: ${ex&&V.bl_seitenf_as?val("bl_seitenf_as"):B?`Richtwert <b>±${mm(B/2-8)}</b> mm ${rw("halbe Breite − 8")}`:"–"}`,
      `Hinteranschlag: ${ex&&V.bl_hinten?val("bl_hinten"):L?`Richtwert <b>${mm(L-30)}</b> mm ${rw("Länge − 30")}`:"–"}`,
      `Bogen pro Bündel: <b>${esc(GJ.bpb||"…")}</b>`]},
    {img:"g-austransport", t:"Austransport", s:[`Band: ${val("au_band","–")}, Zeit: ${val("au_takt","–")}, Höhe: ${val("au_hoehe","–")}`]},
    {img:"g-stopper", t:"Stopperüberwachung", s:["Alle Sensoren grün? Kontrollpunkte zum neuen Format passend?", `Kontrollpunkte: ${val("sp_kp1","–")} / ${val("sp_kp2","–")}`]},
    {img:"g-produktion2", t:"Anstanzen & Produktion", s:["Schutztüren zu – „Sicherheit OK“ grün.", "<b>Anstanzen</b> an: Probebogen prüfen (durchgeschnitten, Rillen, Ausbruch komplett).",
      `Geschwindigkeit <b>${esc(GJ.speed||"…")}</b>/h einstellen, Einschub Automatik an.`, "<b>Korrekturen speichern</b> – und das Rüstblatt in Fox Stanze."]},
  ];
}
function viewGSim(v){
  gStopAnim();
  const tabs = [["ruesten","1. Rüsten"],["prod","2. Stanzen"],["pal","3. Palette"]];
  const checks = gChecks();
  v.innerHTML = `<button class="back" id="back">‹ Alle Artikel</button>
    <div class="hero"><div class="big">🎬</div><small>Göpfert G-Cut</small><h1>Neuen Auftrag simulieren</h1><p>Daten eingeben, Schritt für Schritt rüsten und die Produktion durchspielen.</p></div>
    <div class="card"><div class="row" style="margin-bottom:8px"><select id="gFrom"><option value="">Werte aus Artikel übernehmen …</option>${DB.jobs.filter(j=>j.artikel).map(j=>`<option value="${j.id}">Artikel ${esc(j.artikel)}</option>`).join("")}</select></div>
      <div class="grid">
        <label class="f"><span>Artikel</span><input data-g="artikel" value="${esc(GJ.artikel)}" inputmode="numeric"></label>
        <label class="f"><span>Kunde</span><input data-g="kunde" value="${esc(GJ.kunde)}"></label>
        <label class="f"><span>Format (L x B)</span><input data-g="format" value="${esc(GJ.format)}" placeholder="1235 x 1268"></label>
        <label class="f"><span>Bogendicke</span><div class="unit"><input data-g="dicke" inputmode="decimal" value="${esc(GJ.dicke)}" placeholder="1,2"><em>mm</em></div></label>
        <label class="f"><span>Geschwindigkeit</span><div class="unit"><input data-g="speed" inputmode="numeric" value="${esc(GJ.speed)}"><em>/h</em></div></label>
        <label class="f"><span>Menge (Bogen)</span><input data-g="menge" inputmode="numeric" value="${esc(GJ.menge)}"></label>
        <label class="f full"><span>Bündelstückzahl (Bogen pro Bündel)</span><input data-g="bpb" inputmode="numeric" value="${esc(GJ.bpb)}" placeholder="75"></label>
      </div>
      <details class="sec" style="margin:4px 0 0;background:var(--bg)" ${GJ._lk?"open":""} id="lkBox"><summary>📄 Von der Laufkarte</summary><div class="body"><div class="grid">
        <label class="f"><span>Wellenmaß</span><div class="unit"><input data-g="welle" inputmode="numeric" value="${esc(GJ.welle)}" placeholder="743"><em>mm</em></div></label>
        <label class="f"><span>Bogenmaß</span><div class="unit"><input data-g="bogen" inputmode="numeric" value="${esc(GJ.bogen)}" placeholder="1269"><em>mm</em></div></label>
        <label class="f"><span>Nutzen längs</span><input data-g="nl" inputmode="numeric" value="${esc(GJ.nl)}" placeholder="2"></label>
        <label class="f"><span>Nutzen quer</span><input data-g="nq" inputmode="numeric" value="${esc(GJ.nq)}" placeholder="4"></label>
        <label class="f"><span>Zuschnitt ZB</span><div class="unit"><input data-g="zb" inputmode="numeric" value="${esc(GJ.zb)}" placeholder="529"><em>mm</em></div></label>
        <label class="f"><span>Zuschnitt ZL</span><div class="unit"><input data-g="zl" inputmode="numeric" value="${esc(GJ.zl)}" placeholder="389"><em>mm</em></div></label>
        <label class="f full"><span>Fertigmenge (Stück Zuschnitte)</span><input data-g="stueck" inputmode="numeric" value="${esc(GJ.stueck)}" placeholder="10000"></label>
        <label class="f"><span>Stk/Stpl</span><input data-g="stkStpl" inputmode="numeric" value="${esc(GJ.stkStpl)}" placeholder="590"></label>
        <label class="f"><span>Stpl/Pal</span><input data-g="stplPal" inputmode="numeric" value="${esc(GJ.stplPal)}" placeholder="4"></label>
        <label class="f"><span>Palette Länge</span><div class="unit"><input data-g="palL" inputmode="numeric" value="${esc(GJ.palL)}"><em>mm</em></div></label>
        <label class="f"><span>Palette Breite</span><div class="unit"><input data-g="palB" inputmode="numeric" value="${esc(GJ.palB)}"><em>mm</em></div></label>
        <label class="f full"><span>Max. Höhe mit Palette</span><div class="unit"><input data-g="palH" inputmode="numeric" value="${esc(GJ.palH)}"><em>mm</em></div></label>
      </div><div class="small">Wenn Fertigmenge und Nutzen da sind, rechnet die App die Bogen-Menge selbst aus.</div></div></details></div>
    <h2>Prüfung</h2>
    <div class="card">${checks.length?checks.map(([k,t])=>`<div style="display:flex;gap:8px;margin:5px 0;font-size:14px;line-height:1.4"><span>${k==="ok"?"✅":k==="bad"?"⛔":"⚠️"}</span><span>${esc(t)}</span></div>`).join(""):`<div class="small">Daten eintragen …</div>`}</div>
    <div class="chips">${tabs.map(([k,l])=>`<button class="chip ${gTab===k?"on":""}" data-gt="${k}">${l}</button>`).join("")}</div>
    <div id="gBody"></div>
    <button class="btn light" id="gSave">💾 Als Rüstblatt in Fox Stanze anlegen</button>
    <p class="small" style="margin:8px 4px">Richtwerte (orange) sind aus Artikel 6040 abgeleitet (Seitenführung = halbe Breite, Hinteranschlag = Länge) – immer an der Maschine kontrollieren.</p>`;
  const body = v.querySelector("#gBody");
  if(gTab==="ruesten"){
    const st = gSteps(); const n = st.filter((_,i)=>gDone[i]).length;
    body.innerHTML = `<div class="card"><div class="prog"><i style="width:${n/st.length*100}%"></i></div><div class="small">${n} von ${st.length} Schritten erledigt</div></div>`
      + st.map((x,i)=>`<div class="card" style="${gDone[i]?"opacity:.6":""}"><div class="row" style="align-items:flex-start;gap:10px">
        <img src="img/bs/${x.img}.jpg" data-zi="${x.img}" style="flex:none;width:96px;height:66px;object-fit:cover;border-radius:10px">
        <div style="flex:1"><b>${i+1}. ${esc(x.t)}</b><ul style="margin:5px 0 0 18px;font-size:14px;line-height:1.45">${x.s.map(y=>`<li>${y}</li>`).join("")}</ul></div></div>
        <button class="chip ${gDone[i]?"on":""}" data-gd="${i}" style="margin-top:8px">${gDone[i]?"✓ Erledigt":"Erledigt abhaken"}</button></div>`).join("")
      + `<button class="btn fox" id="toProd">▶️ Weiter zur Produktion</button>`;
    body.querySelectorAll("[data-zi]").forEach(im => im.onclick = () => zoomImg(`img/bs/${im.dataset.zi}.jpg`));
    body.querySelectorAll("[data-gd]").forEach(b => b.onclick = () => { gDone[b.dataset.gd] = !gDone[b.dataset.gd]; render(); });
    body.querySelector("#toProd").onclick = () => { gTab="prod"; render(); };
  } else if(gTab==="pal") gPalView(body); else gProd(body);
  v.querySelector("#back").onclick = () => { gStopAnim(); SUB=null; render(); scrollTo(0,0); };
  v.querySelectorAll("[data-gt]").forEach(b => b.onclick = () => { gTab=b.dataset.gt; render(); });
  v.querySelectorAll("[data-g]").forEach(i => i.onchange = () => { GJ[i.dataset.g] = i.value.trim(); GJ._lk = !!v.querySelector("#lkBox").open;
    if(!GJ.format && num(GJ.welle) && num(GJ.bogen)) GJ.format = `${GJ.welle} x ${GJ.bogen}`;
    const nu = (num(GJ.nl)||0)*(num(GJ.nq)||0); if(num(GJ.stueck) && nu) GJ.menge = String(Math.ceil(num(GJ.stueck)/nu));
    gRun=null; gPal=null; render(); });
  v.querySelector("#gFrom").onchange = e => { const j = DB.jobs.find(x=>x.id===e.target.value); if(!j) return;
    Object.assign(GJ, {artikel:j.artikel, kunde:j.kunde||"", format:j.format||"", dicke:j.dicke||"", speed:j.speed||GJ.speed, bpb:j.buendel||""}); gRun=null; render(); };
  v.querySelector("#gSave").onclick = () => {
    if(!GJ.artikel){ toast("Bitte Artikel eintragen"); return; }
    const ex = DB.jobs.find(j=>j.artikel===GJ.artikel);
    if(ex){ openJob(ex.id); toast("Artikel gibt es schon – Rüstblatt geöffnet"); return; }
    const j = {id:uid(), kunde:GJ.kunde, artikel:GJ.artikel, format:GJ.format, dicke:GJ.dicke, speed:GJ.speed, leerhuebe:"", buendel:GJ.bpb, einschub:true, bremsbuerste:false,
      notiz:"Aus der Simulation angelegt – Werte an der Maschine eintragen.", values:gSaveVals(), extra:{}, photos:[], history:[], ruestzeiten:[], created:Date.now(), updated:Date.now(), used:Date.now()};
    j.history.push(snapshot(j)); DB.jobs.push(j); save(); openJob(j.id); toast("Rüstblatt angelegt ✓");
  };
}

/* ---------- Palettier-Simulation aus der Laufkarte ---------- */
function gPalCalc(){
  const zb = num(GJ.zb), zl = num(GJ.zl), n = num(GJ.stplPal)||0; if(!zb || !zl || !n) return null;
  const L = num(GJ.palL)||1200, B = num(GJ.palB)||800, Hmax = num(GJ.palH)||1700;
  const opts = [];
  for(let c=1;c<=n;c++) if(n%c===0) for(const rot of [false,true]){
    const r = n/c, w = rot?zl:zb, b = rot?zb:zl;
    opts.push({cols:c, rows:r, rot, w, b, lw:c*w, lb:r*b, fits:c*w<=L && r*b<=B});
  }
  const pick = opts.filter(o=>o.rot===GJ.dreh).sort((a,b)=>(b.fits-a.fits) || (Math.max(a.lw-L,a.lb-B)-Math.max(b.lw-L,b.lb-B)))[0];
  const stk = num(GJ.stkStpl)||0, bpb = num(GJ.bpb)||0, d = num(GJ.dicke)||0;
  const lagen = stk && bpb ? Math.ceil(stk/bpb) : 0;
  const stackH = stk && d ? stk*d : 0;
  return Object.assign({}, pick, {L, B, Hmax, n, stk, bpb, lagen: lagen||1, lagenRest: stk&&bpb&&stk%bpb ? stk%bpb : 0,
    stackH, h: stackH ? stackH+150 : 0, perPal: stk ? stk*n : 0});
}
let gPal = null, gPalTimer = null;
function gPalStop(){ clearTimeout(gPalTimer); gPalTimer = null; }
function gPalView(body){
  const P = gPalCalc();
  if(!P){ body.innerHTML = `<div class="card"><div class="small">Bitte unter „📄 Von der Laufkarte“ mindestens Zuschnitt ZB × ZL und Stpl/Pal eintragen – am besten auch Stk/Stpl, Bündelstückzahl und Bogendicke.</div></div>`; return; }
  gPal ||= {i:0, tempo:3};
  const steps = [];
  steps.push({t:`Leere Palette ${fmt(P.L)} × ${fmt(P.B)} mm steht im Palettierer.`, lag:0, st:0});
  for(let L=1; L<=P.lagen; L++){
    for(let k=1;k<=P.n;k++) steps.push({t:`Lage ${L} von ${P.lagen}: Stapel ${k} von ${P.n} wird gesetzt${P.bpb?` (${L===P.lagen&&P.lagenRest?P.lagenRest:P.bpb} Stück)`:""}.`, lag:L, st:k});
    if(L<P.lagen && simHit(GJ.zw, L)) steps.push({t:`Zwischenlage auf Lage ${L}.`, lag:L, st:P.n, zw:L});
  }
  if(GJ.abdeck) steps.push({t:"Abdeckbogen oben drauf.", lag:P.lagen, st:P.n, top:1});
  steps.push({t:`Palette fertig: ${fmt(P.perPal||0)} Stück, ca. ${fmt(P.h||0)} mm hoch – Umreifung und Austransport.`, lag:P.lagen, st:P.n, top:GJ.abdeck, done:1});
  gPal.i = Math.min(gPal.i, steps.length-1);
  body.innerHTML = `<div class="card">
      <div class="grid">
        <label class="f"><span>Zwischenlagen</span><select id="gpZw">${SIM_OPTS.map(([o,l])=>`<option value="${o}" ${GJ.zw===o?"selected":""}>${l}</option>`).join("")}</select></label>
        <div class="tog"><span>Abdeckbogen</span><label class="sw"><input type="checkbox" id="gpAb" ${GJ.abdeck?"checked":""}><span></span></label></div>
        <div class="tog full"><span>Stapel um 90° gedreht</span><label class="sw"><input type="checkbox" id="gpRot" ${GJ.dreh?"checked":""}><span></span></label></div>
      </div></div>
    <div class="card" id="gpBox" style="padding:10px">
      <div class="small" style="font-weight:700;margin-bottom:4px">Draufsicht – Palettierbild ${P.cols} × ${P.rows}${P.rot?" gedreht":""}</div>
      <div id="gpTop"></div>
      <div class="small" style="font-weight:700;margin:10px 0 4px">Seitenansicht</div>
      <div id="gpSide"></div>
      <div class="prog"><i id="gpProg"></i></div>
      <div class="small" id="gpCnt"></div>
      <div id="gpTxt" style="font-size:15px;line-height:1.4;min-height:42px;margin:6px 2px"></div>
      <div class="row" style="gap:6px">
        <button class="btn light sm" id="gpMinus" style="flex:none;width:44px">−</button><div class="small" style="text-align:center">Tempo ${gPal.tempo}/5</div>
        <button class="btn light sm" id="gpPlus" style="flex:none;width:44px">+</button>
        <button class="btn sm" id="gpPlay" style="flex:none;width:52px">▶</button>
        <button class="btn light sm" id="gpStep" style="flex:none;width:52px">⏭</button>
        <button class="btn light sm" id="gpReset" style="flex:none;width:52px">↺</button></div>
    </div>
    <button class="btn" id="gpCorr">🧱 Im Corrpal-Anlagenbild ansehen</button>`;
  const $ = id => document.getElementById(id);
  const draw = () => {
    if(!$("gpBox")){ gPalStop(); return; }
    const x = steps[gPal.i];
    // Draufsicht (SVG im Maßstab)
    const S = 300/Math.max(P.L, P.lw, 1), W = Math.max(P.L, P.lw)*S, H = Math.max(P.B, P.lb)*S;
    const ox = (W - P.lw*S)/2, oy = (H - P.lb*S)/2, px = (W-P.L*S)/2, py = (H-P.B*S)/2;
    let r = `<rect x="${px}" y="${py}" width="${P.L*S}" height="${P.B*S}" fill="#c89a5c" stroke="#8a6431" stroke-width="2" rx="3"/>`;
    for(let k=0;k<P.n;k++){ const c = k%P.cols, ro = Math.floor(k/P.cols);
      const on = x.lag>0 && (k < x.st || x.lag>1);
      const cur = x.lag>0 && k===x.st-1 && !x.zw && !x.top && !x.done;
      r += `<rect x="${ox+c*P.w*S+1}" y="${oy+ro*P.b*S+1}" width="${P.w*S-2}" height="${P.b*S-2}" fill="${on?(cur?"#f2a54a":"#f1dcae"):"none"}" stroke="${on?"#9c7a3f":"#9aa6bd"}" stroke-dasharray="${on?"":"4 3"}" rx="2"/>`;
      r += `<text x="${ox+(c+.5)*P.w*S}" y="${oy+(ro+.5)*P.b*S+4}" text-anchor="middle" font-size="11" fill="#6b5428">${fmt(P.w)}×${fmt(P.b)}</text>`; }
    if((x.zw || x.top) && !x.done) r += `<rect x="${ox}" y="${oy}" width="${P.lw*S}" height="${P.lb*S}" fill="${x.top?"rgba(43,111,222,.25)":"rgba(123,47,209,.22)"}"/>`;
    if(x.done) [.3,.7].forEach(f => { r += `<line x1="${px+P.L*S*f}" y1="${py-4}" x2="${px+P.L*S*f}" y2="${py+P.B*S+4}" stroke="#16213f" stroke-width="3"/>`; r += `<line x1="${px-4}" y1="${py+P.B*S*f}" x2="${px+P.L*S+4}" y2="${py+P.B*S*f}" stroke="#16213f" stroke-width="3"/>`; });
    if(!P.fits) r += `<rect x="${ox}" y="${oy}" width="${P.lw*S}" height="${P.lb*S}" fill="none" stroke="#d23b3b" stroke-width="2" stroke-dasharray="6 4"/>`;
    $("gpTop").innerHTML = `<svg viewBox="-6 -6 ${W+12} ${H+12}" style="width:100%;max-height:230px;display:block;margin:auto">${r}</svg>`;
    // Seitenansicht
    const maxH = P.Hmax, sh = 190/maxH, lagH = P.stackH ? P.stackH/P.lagen : 1400/P.lagen;
    const SW = 300, pw = P.L*SW/Math.max(P.L, P.lw);
    let sv = `<line x1="0" y1="${200-maxH*sh}" x2="${SW}" y2="${200-maxH*sh}" stroke="#d23b3b" stroke-dasharray="5 4"/><text x="${SW}" y="${200-maxH*sh-3}" text-anchor="end" font-size="10" fill="#d23b3b">max ${fmt(maxH)} mm</text>`;
    sv += `<rect x="${(SW-pw)/2}" y="${200-150*sh}" width="${pw}" height="${150*sh}" fill="#a0703c"/>`;
    let y = 200-150*sh;
    const full = x.lag>0 ? (x.st>=P.n || x.zw || x.top || x.done ? x.lag : x.lag-1) : 0;
    const lw = P.lw*SW/Math.max(P.L, P.lw);
    for(let L=1; L<=full + (x.lag>full?1:0); L++){
      const part = L>full ? x.st/P.n : 1;
      y -= lagH*sh;
      sv += `<rect x="${(SW-lw)/2}" y="${y}" width="${lw*part}" height="${Math.max(1,lagH*sh-1)}" fill="${L>full?"#f2a54a":"#f1dcae"}" stroke="#b99a62" stroke-width=".6"/>`;
      if(lagH*sh > 9) sv += `<text x="${SW/2}" y="${y+lagH*sh/2+3.5}" text-anchor="middle" font-size="9" fill="#6b5428">${L}</text>`;
      const zwShown = simHit(GJ.zw, L) && L<P.lagen && (L<x.lag || (x.zw===L) || (L===x.lag && (x.top||x.done)));
      if(zwShown){ y -= 2; sv += `<rect x="${(SW-lw)/2}" y="${y}" width="${lw}" height="2" fill="#7b2fd1"/>`; }
    }
    if(x.top){ y -= 3; sv += `<rect x="${(SW-lw)/2}" y="${y}" width="${lw}" height="3" fill="#2b6fde"/>`; }
    if(x.done) [.3,.7].forEach(f => sv += `<line x1="${(SW-lw)/2+lw*f}" y1="${y}" x2="${(SW-lw)/2+lw*f}" y2="${200}" stroke="#16213f" stroke-width="2"/>`);
    $("gpSide").innerHTML = `<svg viewBox="0 ${Math.min(0,y-10)} ${SW} ${200-Math.min(0,y-10)}" style="width:100%;max-height:230px;display:block">${sv}</svg>`;
    $("gpProg").style.width = ((gPal.i+1)/steps.length*100)+"%";
    $("gpCnt").textContent = `Schritt ${gPal.i+1} von ${steps.length} · Lage ${x.lag}/${P.lagen}`;
    $("gpTxt").textContent = x.t;
    $("gpPlay").textContent = gPalTimer ? "⏸" : "▶";
  };
  const tick = () => { if(!$("gpBox")){ gPalStop(); return; }
    if(gPal.i >= steps.length-1){ gPalStop(); draw(); toast("Palette fertig ✓"); return; }
    gPal.i++; draw(); gPalTimer = setTimeout(tick, [1300,900,550,300,120][gPal.tempo-1]); };
  $("gpPlay").onclick = () => { if(gPalTimer){ gPalStop(); draw(); } else { if(gPal.i>=steps.length-1) gPal.i=0; gPalTimer = setTimeout(tick, 50); draw(); } };
  $("gpStep").onclick = () => { gPalStop(); if(gPal.i<steps.length-1) gPal.i++; draw(); };
  $("gpReset").onclick = () => { gPalStop(); gPal.i=0; draw(); };
  $("gpMinus").onclick = () => { gPal.tempo=Math.max(1,gPal.tempo-1); gPalStop(); render(); };
  $("gpPlus").onclick = () => { gPal.tempo=Math.min(5,gPal.tempo+1); gPalStop(); render(); };
  $("gpZw").onchange = e => { GJ.zw = e.target.value; gPalStop(); gPal.i=0; render(); };
  $("gpAb").onchange = e => { GJ.abdeck = e.target.checked; gPalStop(); gPal.i=0; render(); };
  $("gpRot").onchange = e => { GJ.dreh = e.target.checked; gPalStop(); gPal.i=0; render(); };
  $("gpCorr").onclick = () => { gPalStop(); Object.assign(SIMP, {lagen:Math.min(20,P.lagen), buendel:Math.min(6,P.n), zw:GJ.zw, schutz:GJ.abdeck}); TAB="wissen"; SUB="palsim"; render(); scrollTo(0,0); };
  draw();
}
function gSaveVals(){
  const P = gPalCalc(), V = {};
  if(P){ if(P.stackH) V.pal_buendelh = fmt(P.bpb*(num(GJ.dicke)||0),0); V.pal_lagen = String(P.lagen);
    V.pal_palette = `${fmt(P.L)} x ${fmt(P.B)}, max. ${fmt(P.Hmax)} mm hoch`; V.pal_lagenformat = `${fmt(P.lw)} x ${fmt(P.lb)}, ${P.cols} x ${P.rows}${P.rot?" gedreht":""}`;
    V.pal_zwbogen = (SIM_OPTS.find(o=>o[0]===GJ.zw)||[])[1]||""; V.pal_schutzbogen = GJ.abdeck?"Abdeckbogen":""; }
  return V;
}
/* Seitenansicht mit Animation */
let gAnim = null;
function gStopAnim(){ if(gAnim){ cancelAnimationFrame(gAnim.raf); gAnim.raf = null; gAnim.on = false; } }
function gProd(body){
  const sp = num(GJ.speed)||3300, me = num(GJ.menge)||1000, bpb = num(GJ.bpb)||50, d = num(GJ.dicke)||1.5;
  gRun ||= {done:0, phase:0, tempo:3, anst:GJ.anst, waiting:false};
  body.innerHTML = `<div class="card" id="gBox" style="padding:10px">
    <div style="position:relative;height:190px;background:linear-gradient(#eef3fb,#dfe7f4);border-radius:12px;overflow:hidden">
      <div style="position:absolute;left:1%;bottom:22px;width:16%;text-align:center;font-size:10px;font-weight:700">ANLEGER<div id="gFeed" style="margin:2px auto 0;width:80%;background:#d8b77a;border:1px solid #9c7a3f;border-radius:2px"></div></div>
      <div style="position:absolute;left:22%;top:8px;width:16%;text-align:center;font-size:10px;font-weight:700">STANZE</div>
      <div id="gTop" style="position:absolute;left:22%;top:24px;width:16%;height:46px;background:#5d6b88;border-radius:4px;transition:top .12s"></div>
      <div style="position:absolute;left:22%;bottom:22px;width:16%;height:40px;background:#5d6b88;border-radius:4px"></div>
      <div style="position:absolute;left:43%;top:8px;width:14%;text-align:center;font-size:10px;font-weight:700">AUSBRECHEN</div>
      <div id="gStrip" style="position:absolute;left:46%;top:40px;width:8%;height:30px;background:#7a8aa6;border-radius:3px;transition:top .12s"></div>
      <div style="position:absolute;left:62%;bottom:22px;width:15%;text-align:center;font-size:10px;font-weight:700">ABLAGE<div id="gStack" style="margin:2px auto 0;width:80%;background:#f1dcae;border:1px solid #b99a62;border-radius:2px;height:0"></div></div>
      <div style="position:absolute;left:79%;bottom:22px;width:20%;text-align:center;font-size:9px;font-weight:700">AUS-TRANSPORT<div id="gOut" style="height:24px;position:relative"></div></div>
      <div style="position:absolute;left:0;right:0;bottom:16px;height:6px;background:#9aa6bd"></div>
      <div id="gSheet" style="position:absolute;bottom:64px;width:12%;height:5px;background:#c98a2b;border-radius:2px"></div>
    </div>
    <div class="stats" style="margin-top:10px">${[["gCnt","Bogen"],["gBnd","Bündel"],["gTime","Maschinenzeit"]].map(([i,l])=>`<div style="background:var(--chip);color:var(--text)"><b id="${i}">0</b><span>${l}</span></div>`).join("")}</div>
    <div class="prog"><i id="gProg"></i></div>
    <div id="gMsg" style="font-size:15px;line-height:1.4;min-height:42px;margin:6px 2px"></div>
    <div id="gAsk"></div>
    <div class="row" style="gap:6px">
      <button class="btn light sm" id="gMinus" style="flex:none;width:44px">−</button><div class="small" style="text-align:center" id="gTempo"></div>
      <button class="btn light sm" id="gPlus" style="flex:none;width:44px">+</button>
      <button class="btn sm" id="gPlay" style="flex:none;width:52px">▶</button>
      <button class="btn light sm" id="gEnd" style="flex:none;width:52px">⏭</button>
      <button class="btn light sm" id="gReset" style="flex:none;width:52px">↺</button></div>
    <div class="tog"><span>Mit Anstanzen beginnen</span><label class="sw"><input type="checkbox" id="gAnst" ${GJ.anst?"checked":""}><span></span></label></div></div>`;
  const R = gRun, $ = id => document.getElementById(id);
  const draw = () => {
    const t = R.phase, x = 3 + t*72;
    $("gSheet").style.left = x+"%"; $("gSheet").style.opacity = R.done>=me ? 0 : 1;
    const press = t>0.24 && t<0.36; $("gTop").style.top = press ? "60px" : "24px";
    const strip = t>0.52 && t<0.62; $("gStrip").style.top = strip ? "62px" : "40px";
    const inB = R.done % bpb; $("gStack").style.height = Math.min(90, inB/bpb*90)+"px";
    $("gFeed").style.height = Math.max(4, 90*(1-R.done/me))+"px";
    const bund = Math.floor(R.done/bpb);
    $("gOut").innerHTML = [...Array(Math.min(4,bund))].map((_,i)=>`<div style="position:absolute;bottom:0;left:${8+i*22}%;width:18%;height:18px;background:#e2c48f;border:1px solid #b99a62;border-radius:2px"></div>`).join("");
    $("gCnt").textContent = fmt(R.done); $("gBnd").textContent = fmt(bund);
    $("gTime").textContent = durTxt(R.done/sp*3600e3);
    $("gProg").style.width = Math.min(100, R.done/me*100)+"%";
    $("gTempo").textContent = ["1 Bogen/Takt","5","25","100","500"][R.tempo-1].replace(/^(\d+)$/,"$1 Bogen/Takt");
    $("gPlay").textContent = gAnim && gAnim.on ? "⏸" : "▶";
    let msg = "";
    if(R.done>=me) msg = `✅ Auftrag fertig: ${fmt(me)} Bogen in ${fmt(Math.ceil(me/bpb))} Bündeln, Maschinenzeit ca. ${durTxt(me/sp*3600e3)}.`;
    else if(t<0.24) msg = "Anleger: Saugplatte holt den Bogen, Greifer übernehmen ihn.";
    else if(t<0.4) msg = `Stanze: Tiegel schließt – schneiden und rillen${GJ.dicke?` (${GJ.dicke} mm)`:""}.`;
    else if(t<0.66) msg = "Ausbrechstation: Abfall wird herausgedrückt, Greiferrand wird abgehackt.";
    else msg = `Bogenablager: Bogen kommt aufs Bündel (${inB}/${bpb}).`;
    $("gMsg").textContent = msg;
  };
  const ask = () => {
    R.waiting = true; gStopAnim();
    $("gAsk").innerHTML = `<div class="note" style="background:rgba(242,140,40,.13);border-left:4px solid var(--fox);padding:10px;border-radius:10px;font-size:14px;margin-bottom:8px"><b>Anstanzen – Probebogen prüfen:</b> durchgeschnitten? Rillen sauber? Ausbruch komplett? Bogen gerade?</div>
      <div class="row" style="gap:6px"><button class="btn sm" id="gOk">✓ Passt – Produktion</button><button class="btn light sm" id="gFix">🛠️ Nicht gut</button></div>`;
    $("gOk").onclick = () => { R.waiting=false; R.anst=false; $("gAsk").innerHTML=""; start(); };
    $("gFix").onclick = () => { SUB="fehler"; TAB="wissen"; fehlerB="Stanze"; gStopAnim(); render(); scrollTo(0,0); };
  };
  const step = (ts) => {
    if(!$("gBox")){ gStopAnim(); return; }
    const dt = Math.min(100, ts - (gAnim.last||ts)); gAnim.last = ts;
    R.phase += dt / (R.anst ? 1800 : [900,700,500,350,250][R.tempo-1]);
    if(R.phase >= 1){
      R.phase = 0;
      R.done = Math.min(me, R.done + (R.anst ? 1 : [1,5,25,100,500][R.tempo-1]));
      if(R.anst && R.done>=1){ draw(); ask(); return; }
      if(R.done >= me){ draw(); gStopAnim(); draw(); toast("Simulation fertig ✓"); return; }
    }
    draw(); gAnim.raf = requestAnimationFrame(step);
  };
  const start = () => { if(R.done>=me) Object.assign(R,{done:0,phase:0,anst:GJ.anst}); gAnim = {on:true, last:0}; gAnim.raf = requestAnimationFrame(step); draw(); };
  $("gPlay").onclick = () => { if(R.waiting) return; if(gAnim && gAnim.on){ gStopAnim(); draw(); } else start(); };
  $("gReset").onclick = () => { gStopAnim(); Object.assign(R,{done:0,phase:0,anst:GJ.anst,waiting:false}); $("gAsk").innerHTML=""; draw(); };
  $("gEnd").onclick = () => { gStopAnim(); R.anst=false; R.waiting=false; $("gAsk").innerHTML=""; R.done = me; R.phase=0; draw(); };
  $("gMinus").onclick = () => { R.tempo = Math.max(1, R.tempo-1); draw(); };
  $("gPlus").onclick = () => { R.tempo = Math.min(5, R.tempo+1); draw(); };
  $("gAnst").onchange = e => { GJ.anst = e.target.checked; R.anst = GJ.anst && R.done===0; };
  draw();
}

/* ---------- Corrpal-Simulation ---------- */
const SIM_OPTS = [["keine","Keine"],["alle","Alle"],["135","1,3,5"],["246","2,4,6"]];
const simHit = (o, n) => o==="alle" || (o==="135" && n%2===1) || (o==="246" && n%2===0);
const simMap = t => { t = String(t||"").toLowerCase(); return t.includes("alle")?"alle":t.includes("1,3")||t.includes("135")?"135":t.includes("2,4")||t.includes("246")?"246":"keine"; };
let SIMP = {lagen:4, buendel:2, b1:1, b2:1, zw:"alle", wenden:"keine", ausr:"alle", schutz:true, speed:3};
let SIM = null, simTimer = null;
function simBuild(){
  const P = SIMP, st = [];
  const add = (k, t, ex) => st.push(Object.assign({k, t}, ex||{}));
  add("DIP1", "Paletten-Magazin gibt eine leere Palette an den Palettierer.", {pal:"leer"});
  for(let L=1; L<=P.lagen; L++){
    for(let b=1; b<=P.buendel; b++){
      const tag = `Lage ${L}, Bündel ${b}/${P.buendel}`;
      add("BS1", `${tag}: Bündel kommt von der Stanze in Brecher 1.`);
      for(let c=1;c<=P.b1;c++) add("BS1", `${tag}: Brecher 1 bricht (Zyklus ${c}/${P.b1}) – die Nutzen trennen sich an den Haltepunkten.`, {brk:1});
      add("AC1", `${tag}: Winkelförderer 1 – Richtungswechsel 90°.`);
      for(let c=1;c<=P.b2;c++) add("BS2", `${tag}: Brecher 2 bricht in die andere Richtung (Zyklus ${c}/${P.b2}).`, {brk:1});
      add("AC2", `${tag}: Winkelförderer 2.`);
      add("TT1", `${tag}: Drehtisch dreht die Stapel fürs Lagenmuster.`, {rot:1});
      add("CV1", `${tag}: Förderband 1.`);
      add("AC3", `${tag}: Winkelförderer 3.`);
      add("APC1", `${tag}: Infeed Conveyor – wird in der Lagenbildung gesammelt (FrontStop oben).`, {coll:b});
    }
    if(simHit(P.ausr, L)) add("APC1", `Lage ${L}: SidePusher schiebt die Stapel aufs Lagenmaß zusammen (Stapel ausrichten).`, {coll:P.buendel});
    if(simHit(P.wenden, L)) add("LI1", `Lage ${L}: Lagenwender – Infeed, Turn Over (Trommel dreht), Outfeed.`, {flip:1});
    else add("LI1", `Lage ${L}: läuft durch den Lagenwender (nicht gewendet).`);
    add("PAL1", `Lage ${L}: Infeed auf die Gabel → Move To Stack → Stack Layer: Gabel zieht raus, Lage liegt auf der Palette.`, {layer:{n:L, flip:simHit(P.wenden,L)}});
    if(L < P.lagen && simHit(P.zw, L)) add("DIS1", `Dispenser Pickup → Drop: Zwischenbogen wird auf Lage ${L} gelegt.`, {zw:L});
  }
  if(P.schutz) add("DIS1", "Schutzbogen wird oben auf den Stapel gelegt.", {top:1});
  add("CV2", `Palette fertig: ${P.lagen} Lagen – Austransport fördert sie aus der Anlage.`, {out:1});
  return st;
}
function simState(upto){
  const r = {layers:[], zw:[], top:false, out:false, coll:0};
  for(let i=0;i<=upto;i++){ const x = SIM.steps[i];
    if(x.pal) Object.assign(r, {layers:[], zw:[], top:false, out:false});
    if(x.layer){ r.layers.push(x.layer); r.coll = 0; }
    if(x.coll) r.coll = x.coll;
    if(x.zw) r.zw.push(x.zw);
    if(x.top) r.top = true;
    if(x.out) r.out = true; }
  return r;
}
function simCenter(k){ const b = PAL_ST.find(x=>x.k===k).b; return [b[0]+b[2]/2, b[1]+b[3]/2]; }
function simDraw(){
  const box = document.getElementById("simBox"); if(!box){ simStop(); return; }
  const x = SIM.steps[SIM.i], [cx, cy] = simCenter(x.k), stt = simState(SIM.i);
  box.querySelectorAll("[data-sk]").forEach(el => { const on = el.dataset.sk === x.k; el.style.background = on ? "rgba(242,140,40,.55)" : "rgba(140,210,160,.28)"; el.style.transform = on ? "scale(1.06)" : ""; });
  const tok = document.getElementById("simTok");
  tok.style.left = cx+"%"; tok.style.top = cy+"%";
  tok.style.transform = `translate(-50%,-50%) rotate(${x.rot?90:0}deg) scaleY(${x.flip?-1:1})`;
  tok.style.opacity = (x.pal || x.k==="DIS1" || x.k==="PAL1" || x.out) ? 0 : 1;
  tok.innerHTML = x.brk ? "▦" : "▬";
  document.getElementById("simTxt").innerHTML = `<b>${esc(PAL_ST.find(p=>p.k===x.k).k)}</b> · ${esc(x.t)}`;
  document.getElementById("simProg").style.width = ((SIM.i+1)/SIM.steps.length*100)+"%";
  document.getElementById("simCnt").textContent = `Schritt ${SIM.i+1} von ${SIM.steps.length} · Lagen ${stt.layers.length}/${SIMP.lagen}`;
  // Seitenansicht Palette
  let h = `<div style="height:14px;background:#a0703c;border-radius:3px;margin-top:2px"></div>`;
  let stack = "";
  stt.layers.forEach((l,i) => {
    stack = `<div style="height:20px;margin-top:2px;background:${l.flip?"#e2c48f":"#f1dcae"};border:1px solid #b99a62;border-radius:3px;font-size:10px;text-align:center;color:#6b5428;line-height:18px">Lage ${l.n}${l.flip?" ↻":""}</div>` + stack;
    if(stt.zw.includes(l.n)) stack = `<div style="height:3px;margin-top:2px;background:#7b2fd1;border-radius:2px"></div>` + stack;
  });
  if(stt.top) stack = `<div style="height:4px;background:#2b6fde;border-radius:2px"></div>` + stack;
  document.getElementById("simPal").innerHTML = `<div style="transition:transform .6s;transform:translateX(${stt.out?"140%":"0"})">${stack}${h}</div>`;
  document.getElementById("simColl").textContent = stt.coll ? `In Lagenbildung: ${stt.coll}/${SIMP.buendel} Bündel` : "";
  document.getElementById("simPlay").textContent = simTimer ? "⏸" : "▶";
}
function simStop(){ clearTimeout(simTimer); simTimer = null; }
function simTick(){
  if(!document.getElementById("simBox")){ simStop(); return; }
  if(SIM.i >= SIM.steps.length-1){ simStop(); simDraw(); toast("Simulation fertig ✓"); return; }
  SIM.i++; simDraw();
  simTimer = setTimeout(simTick, [1600,1100,750,450,220][SIMP.speed-1]);
}
function viewPalSim(v){
  simStop();
  SIM = {steps: simBuild(), i: 0};
  const sel = (k) => `<select data-sp="${k}">${SIM_OPTS.map(([o,l])=>`<option value="${o}" ${SIMP[k]===o?"selected":""}>${l}</option>`).join("")}</select>`;
  v.innerHTML = `<button class="back" id="back">‹ Palettierer</button>
    <div class="hero" style="background:linear-gradient(135deg,#7b2fd1,#3b3fc0)"><div class="big">▶️</div><small>Wie „Auftrag › Simulation“ an der Maschine</small><h1>Simulation Palettierer</h1><p>Werte einstellen, ▶ drücken und zuschauen, wie die Palette entsteht.</p></div>
    <div class="card"><div class="row" style="margin-bottom:8px"><select id="simJob"><option value="">Werte aus Artikel übernehmen …</option>${DB.jobs.filter(j=>j.artikel).map(j=>`<option value="${j.id}">Artikel ${esc(j.artikel)}</option>`).join("")}</select></div>
      <div class="grid">
        <label class="f"><span>Lagen</span><input data-sp="lagen" inputmode="numeric" value="${SIMP.lagen}"></label>
        <label class="f"><span>Bündel pro Lage</span><input data-sp="buendel" inputmode="numeric" value="${SIMP.buendel}"></label>
        <label class="f"><span>Zyklen Brecher 1</span><input data-sp="b1" inputmode="numeric" value="${SIMP.b1}"></label>
        <label class="f"><span>Zyklen Brecher 2</span><input data-sp="b2" inputmode="numeric" value="${SIMP.b2}"></label>
        <label class="f"><span>Zwischenbogen</span>${sel("zw")}</label>
        <label class="f"><span>Lage wenden</span>${sel("wenden")}</label>
        <label class="f"><span>Stapel ausrichten</span>${sel("ausr")}</label>
        <div class="tog"><span>Schutzbogen oben</span><label class="sw"><input type="checkbox" data-sp="schutz" ${SIMP.schutz?"checked":""}><span></span></label></div>
      </div></div>
    <div class="card" id="simBox" style="padding:10px">
      <div style="position:relative;width:100%;padding-top:82%">
        ${PAL_ST.map(x=>`<div data-sk="${x.k}" style="position:absolute;left:${x.b[0]}%;top:${x.b[1]}%;width:${x.b[2]}%;height:${x.b[3]}%;border:3px solid ${ZONE_C[x.z]};border-radius:8px;font-weight:800;font-size:11px;display:flex;align-items:flex-start;justify-content:center;padding-top:3px;transition:background .3s,transform .3s">${x.k}</div>`).join("")}
        <div id="simTok" style="position:absolute;font-size:30px;color:#c98a2b;text-shadow:0 1px 3px rgba(0,0,0,.4);transition:left .45s ease,top .45s ease,transform .45s,opacity .3s;pointer-events:none">▬</div>
        <div style="position:absolute;left:40%;top:30%;width:26%;"><div class="small" style="text-align:center;font-weight:700">Palette</div><div id="simPal" style="overflow:hidden"></div><div id="simColl" class="small" style="text-align:center;margin-top:4px"></div></div>
      </div>
      <div class="prog"><i id="simProg"></i></div>
      <div class="small" id="simCnt"></div>
      <div id="simTxt" style="font-size:15px;line-height:1.4;min-height:44px;margin:6px 2px"></div>
      <div class="row" style="gap:6px">
        <button class="btn light sm" id="simMinus" style="flex:none;width:44px">−</button>
        <div class="small" style="text-align:center">Tempo ${SIMP.speed}/5</div>
        <button class="btn light sm" id="simPlus" style="flex:none;width:44px">+</button>
        <button class="btn sm" id="simPlay" style="flex:none;width:52px">▶</button>
        <button class="btn light sm" id="simStep" style="flex:none;width:52px">⏭</button>
        <button class="btn light sm" id="simReset" style="flex:none;width:52px">↺</button>
      </div>
      <div class="small" style="margin-top:8px"><span style="color:#7b2fd1">━</span> Zwischenbogen · <span style="color:#2b6fde">━</span> Schutzbogen · ↻ gewendete Lage</div>
    </div>
    <p class="small" style="margin:6px 4px">Vereinfachte Darstellung zum Verstehen des Ablaufs – keine echten Maschinenzeiten.</p>`;
  v.querySelector("#back").onclick = () => { simStop(); SUB="pal"; render(); scrollTo(0,0); };
  const restart = () => { simStop(); render(); };
  v.querySelectorAll("[data-sp]").forEach(i => i.onchange = () => {
    const k = i.dataset.sp;
    if(i.type==="checkbox") SIMP[k] = i.checked;
    else if(i.tagName==="SELECT") SIMP[k] = i.value;
    else SIMP[k] = Math.max(1, Math.min(k==="lagen"?20:k==="buendel"?6:5, parseInt(i.value)||1));
    restart();
  });
  v.querySelector("#simJob").onchange = e => {
    const j = DB.jobs.find(x=>x.id===e.target.value); if(!j) return; const V = j.values;
    if(num(V.pal_lagen)) SIMP.lagen = Math.min(20, num(V.pal_lagen));
    if(num(V.pal_brecher1)) SIMP.b1 = Math.min(5, num(V.pal_brecher1));
    if(num(V.pal_brecher2)) SIMP.b2 = Math.min(5, num(V.pal_brecher2));
    if(V.pal_zwbogen) SIMP.zw = simMap(V.pal_zwbogen);
    if(V.pal_wenden) SIMP.wenden = simMap(V.pal_wenden);
    if(V.pal_ausrichten) SIMP.ausr = simMap(V.pal_ausrichten);
    toast(`Werte von Artikel ${j.artikel} übernommen`); restart();
  };
  v.querySelector("#simPlay").onclick = () => { if(simTimer){ simStop(); simDraw(); } else { if(SIM.i >= SIM.steps.length-1) SIM.i = 0; simTimer = setTimeout(simTick, 50); simDraw(); } };
  v.querySelector("#simStep").onclick = () => { simStop(); if(SIM.i < SIM.steps.length-1) SIM.i++; simDraw(); };
  v.querySelector("#simReset").onclick = () => { simStop(); SIM.i = 0; simDraw(); };
  v.querySelector("#simMinus").onclick = () => { SIMP.speed = Math.max(1, SIMP.speed-1); const run = !!simTimer; render(); };
  v.querySelector("#simPlus").onclick = () => { SIMP.speed = Math.min(5, SIMP.speed+1); render(); };
  simDraw();
}

/* ---------- Rüst-Checkliste ---------- */
const CHECK_DEFAULT = ["Auftrag, Artikel und Material prüfen","Rüstblatt in Fox Stanze öffnen und Rüst-Stoppuhr starten","Maschine sichern wie in der Betriebsanweisung vorgeschrieben",
  "Altes Stanz- und Ausbrechwerkzeug ausbauen","Neues Stanzwerkzeug einsetzen und spannen","Schneidplatte prüfen","Ausbrechwerkzeug oben und unten einsetzen",
  "Anleger einstellen: Seitenführungen, Anschläge, Hinteranschlag","Ausbrechstation einstellen: Höhe, Seitenführungen, Position","Bogenablager und Auslauftransport einstellen",
  "Spalt und Druck vom letzten Mal einstellen","Stopperüberwachung: Kontrollpunkte prüfen","Schutzeinrichtungen schließen – „Sicherheit OK“ muss grün sein",
  "Probebogen anstanzen: durchgeschnitten? Rillen sauber? Ausbruch komplett?","Bei Bedarf zurichten und Spalt in kleinen Schritten nachstellen",
  "In der Maschine „Korrekturen speichern“","Rüstblatt in Fox Stanze speichern, Stoppuhr stoppen","Produktion starten, erste Bogen kontrollieren"].map((t,i)=>({id:"c"+i, t}));
let checkEdit = false;
function viewCheck(v){
  const L = DB.checklist, done = new Set(DB.checkDone);
  const pct = L.length ? Math.round([...done].filter(id=>L.some(x=>x.id===id)).length/L.length*100) : 0;
  v.innerHTML = `<button class="back" id="back">‹ Wissen</button>
    <div class="card"><div class="row"><b style="flex:1;font-size:18px">✅ Rüst-Checkliste</b><button class="chip ${checkEdit?"on":""}" id="edit" style="flex:none">${checkEdit?"Fertig":"✏️ Bearbeiten"}</button></div>
      <div class="prog"><i style="width:${pct}%"></i></div><div class="small">${pct}% erledigt${pct===100?" – Maschine bereit! 🎉":""}</div></div>
    <div class="card">${L.map((x,i)=>`<div class="chk ${done.has(x.id)?"done":""}" data-c="${x.id}"><span class="box">${done.has(x.id)?"✓":i+1}</span>
      ${checkEdit?`<input data-ct="${x.id}" value="${esc(x.t)}" style="flex:1;padding:7px 9px;font-size:15px"><span class="ed"><button data-up="${i}">↑</button><button data-cdel="${i}">✕</button></span>`:`<span class="tx">${esc(x.t)}</span>`}</div>`).join("")}
      ${checkEdit?`<button class="addx" id="addC" style="margin-top:10px">＋ Schritt hinzufügen</button>`:""}</div>
    ${checkEdit?`<button class="btn light" id="resetDef">Standard-Liste wiederherstellen</button>`:`<button class="btn" id="reset">↺ Neu beginnen (nächstes Rüsten)</button>`}
    <p class="small" style="margin:10px 4px">Allgemeine Vorlage – pass die Schritte an eure Betriebsanweisung an.</p>`;
  const collectC = () => v.querySelectorAll("[data-ct]").forEach(i => { const x = L.find(y=>y.id===i.dataset.ct); if(x) x.t = i.value; });
  v.querySelector("#back").onclick = () => { collectC(); checkEdit=false; DB.checklist = L.filter(x=>x.t.trim()); save(); SUB=null; render(); };
  v.querySelector("#edit").onclick = () => { collectC(); checkEdit=!checkEdit; DB.checklist = L.filter(x=>x.t.trim()); save(); render(); };
  if(!checkEdit) v.querySelectorAll("[data-c]").forEach(el => el.onclick = () => { const id=el.dataset.c; DB.checkDone = done.has(id) ? DB.checkDone.filter(x=>x!==id) : [...DB.checkDone, id]; save(); render(); });
  v.querySelectorAll("[data-up]").forEach(b => b.onclick = e => { e.stopPropagation(); collectC(); const i=+b.dataset.up; if(i>0){ [L[i-1],L[i]]=[L[i],L[i-1]]; save(); render(); } });
  v.querySelectorAll("[data-cdel]").forEach(b => b.onclick = e => { e.stopPropagation(); collectC(); L.splice(+b.dataset.cdel,1); save(); render(); });
  const add = v.querySelector("#addC"); if(add) add.onclick = () => { collectC(); L.push({id:uid(), t:""}); save(); render(); const ins=v.querySelectorAll("[data-ct]"); ins[ins.length-1].focus(); };
  const r = v.querySelector("#reset"); if(r) r.onclick = () => { DB.checkDone=[]; save(); render(); };
  const rd = v.querySelector("#resetDef"); if(rd) rd.onclick = () => confirmBox("Eigene Änderungen verwerfen und Standard-Liste laden?", () => { DB.checklist = CHECK_DEFAULT.map(x=>({...x})); DB.checkDone=[]; save(); render(); }, "Ja, Standard laden");
}

/* ---------- Fehlerbibliothek ---------- */
const BEREICHE = ["Anleger","Stanze","Ausbrechstation","Bogenablager","Auslauf","Überwachung","Material","Sonstiges"];
const FEHLER_DEFAULT = [
  {b:"Stanze", p:"Schneidet nicht durch", u:"Zu wenig Zustellung, stumpfe oder niedrige Messer, Zurichtung fehlt", l:"Spalt in kleinen Schritten verringern. Betrifft es nur eine Stelle: dort zurichten statt den Druck überall zu erhöhen."},
  {b:"Stanze", p:"Nur eine Seite schneidet schlecht", u:"Spalt AS/BS ungleich, Werkzeug liegt schief", l:"Kette 🔗 lösen und nur die betroffene Seite nachstellen. Werkzeugsitz prüfen."},
  {b:"Stanze", p:"Rillen platzen / reißen", u:"Zu viel Druck, Rillkanal zu eng, Material zu trocken", l:"Spalt etwas öffnen, Rillmatrize prüfen, Materialfeuchte prüfen."},
  {b:"Stanze", p:"Nutzen hängen nicht mehr zusammen", u:"Haltepunkte (Nicks) zu klein oder ausgebrochen", l:"Haltepunkte am Werkzeug prüfen, ggf. Werkzeugbau informieren."},
  {b:"Ausbrechstation", p:"Abfall bleibt hängen", u:"Oberteil zu hoch, Ausbrechstifte fehlen oder sitzen falsch", l:"Höhe Oberteil verringern, Stifte und Unterteil-Position prüfen."},
  {b:"Ausbrechstation", p:"Nutzen fallen mit raus", u:"Zu tief zugestellt, Haltepunkte zu schwach", l:"Höhe Oberteil etwas zurücknehmen, Haltepunkte prüfen."},
  {b:"Anleger", p:"Doppelbogen", u:"Bogen kleben zusammen, Trennung/Gebläse falsch eingestellt", l:"Stapel auflockern, Gebläse und Anschläge prüfen."},
  {b:"Anleger", p:"Bogen läuft schief ein", u:"Seitenführung AS/BS ungleich, verzogenes Material", l:"Seitenführungen prüfen, ggf. Kette lösen und einzeln nachstellen."},
  {b:"Bogenablager", p:"Stapel wird unsauber", u:"Seitenführungen zu weit, Bremsbürste zu schwach", l:"Seitenführungen und Hinteranschlag nachstellen, Bürstenwalze anpassen."},
  {b:"Überwachung", p:"Meldung „Greiferrandzerhacker Antriebsseite geöffnet“", u:"Schutz am Greiferrandzerhacker nicht geschlossen", l:"Schutz schließen, Meldung quittieren. Nie überbrücken."},
  {b:"Überwachung", p:"Stauüberwachung löst aus", u:"Bogen staut an einer Station", l:"Maschine sichern, Bogen entfernen, Ursache suchen (Format, Stopper-Kontrollpunkte, Ausbruch)."},
].map((x,i)=>Object.assign({id:"f"+i, std:true}, x));
let fehlerQ = "", fehlerB = "";
function viewFehler(v){
  const q = fehlerQ.toLowerCase();
  const list = DB.fehler.filter(f => (!fehlerB || f.b===fehlerB) && (f.p+" "+f.u+" "+f.l+" "+f.b).toLowerCase().includes(q));
  v.innerHTML = `<button class="back" id="back">‹ Wissen</button>
    <div class="hero" style="background:linear-gradient(135deg,#c2363b,#8f1f3a)"><div class="big">🛠️</div><small>Fehlerbibliothek</small><h1>Was hilft wann?</h1><p>Eigene Erfahrung festhalten – für dich und die Kollegen von morgen.</p></div>
    <input id="fq" placeholder="🔍 Problem suchen, z. B. Rillen" value="${esc(fehlerQ)}" style="margin-bottom:9px">
    <div class="chips"><button class="chip ${!fehlerB?"on":""}" data-b="">Alle</button>${BEREICHE.filter(b=>DB.fehler.some(f=>f.b===b)).map(b=>`<button class="chip ${fehlerB===b?"on":""}" data-b="${b}">${b}</button>`).join("")}</div>
    ${list.length ? list.map(f=>`<div class="fe" data-f="${f.id}"><b>${esc(f.p)}</b><small>${esc(f.b)}${f.std?" · Vorlage":" · eigener Eintrag"}</small>
      ${f.u?`<div class="lo"><span class="small">Ursache:</span> ${esc(f.u)}</div>`:""}<div class="lo"><b style="display:inline;font-size:14px">Hilft:</b> ${esc(f.l)}</div></div>`).join("") : `<div class="empty">Nichts gefunden – leg den Fehler neu an.</div>`}
    <button class="btn fox" id="newF">＋ Neuer Eintrag</button>`;
  const fq = v.querySelector("#fq"); fq.oninput = () => { fehlerQ = fq.value; const p=fq.selectionStart; render(); const n=document.getElementById("fq"); n.focus(); n.setSelectionRange(p,p); };
  v.querySelector("#back").onclick = () => { SUB=null; render(); };
  v.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { fehlerB = b.dataset.b; render(); });
  v.querySelectorAll("[data-f]").forEach(el => el.onclick = () => { SUB="fehler:"+el.dataset.f; render(); scrollTo(0,0); });
  v.querySelector("#newF").onclick = () => { SUB="fehler:new"; render(); scrollTo(0,0); };
}
function viewFehlerEdit(v, id){
  const f = id==="new" ? {id:uid(), b:fehlerB||"Stanze", p:"", u:"", l:""} : DB.fehler.find(x=>x.id===id);
  if(!f){ SUB="fehler"; return render(); }
  v.innerHTML = `<button class="back" id="back">‹ Fehlerbibliothek</button>
    <div class="card">
      <label class="f"><span>Bereich</span><select id="fb">${BEREICHE.map(b=>`<option ${b===f.b?"selected":""}>${b}</option>`).join("")}</select></label>
      <label class="f"><span>Problem</span><input id="fp" value="${esc(f.p)}" placeholder="z. B. Rillen platzen"></label>
      <label class="f"><span>Ursache</span><textarea id="fu" placeholder="Was steckt meistens dahinter?">${esc(f.u)}</textarea></label>
      <label class="f"><span>Was hilft</span><textarea id="fl" placeholder="Was hast du gemacht, damit es wieder läuft?">${esc(f.l)}</textarea></label>
    </div>
    <button class="btn" id="saveF">💾 Speichern</button>
    ${id!=="new"?`<button class="btn bad" id="delF">Eintrag löschen</button>`:""}`;
  v.querySelector("#back").onclick = () => { SUB="fehler"; render(); };
  v.querySelector("#saveF").onclick = () => {
    const p = v.querySelector("#fp").value.trim(); if(!p){ toast("Bitte Problem eintragen"); return; }
    Object.assign(f, {b:v.querySelector("#fb").value, p, u:v.querySelector("#fu").value.trim(), l:v.querySelector("#fl").value.trim(), std:false});
    if(id==="new") DB.fehler.unshift(f); save(); toast("Gespeichert ✓"); SUB="fehler"; render();
  };
  const d = v.querySelector("#delF"); if(d) d.onclick = () => confirmBox("Eintrag löschen?", () => { DB.fehler = DB.fehler.filter(x=>x!==f); save(); SUB="fehler"; render(); });
}
function seedExtras(){
  if(!DB.seededPal){
    DB.seededPal = true;
    const j6 = DB.jobs.find(j=>j.artikel==="6026");
    if(j6 && !j6.values.pal_buendelh) j6.values.pal_buendelh = "130";
  }
  if(!DB.seeded6026){
    DB.seeded6026 = true;
    if(!DB.jobs.some(j=>j.artikel==="6026")) DB.jobs.push({id:uid(), kunde:"Seyfert", artikel:"6026", format:"630 x 1610", dicke:"2,4", speed:"3700", leerhuebe:"0", buendel:"52", einschub:true, bremsbuerste:true,
      notiz:"Werte von den Fotos vom 19.11.2026: Ist 3682/h, Ausstoß 3700/h, 25.437 Bogen gesamt.",
      values:{st_spalt_as:"-1,19", st_druck:"195", st_tiegel:"194,0", au_band:"50", au_takt:"0,5", au_hoehe:"342", pal_buendelh:"130"},
      extra:{}, photos:[], history:[], ruestzeiten:[], created:Date.now(), updated:Date.now(), used:Date.now()-1000});
  }
  if(!Array.isArray(DB.fehler)) DB.fehler = FEHLER_DEFAULT.map(x=>({...x}));
  if(!Array.isArray(DB.checklist)) DB.checklist = CHECK_DEFAULT.map(x=>({...x}));
  if(!Array.isArray(DB.checkDone)) DB.checkDone = [];
  DB.jobs.forEach(j => { j.history ||= []; j.ruestzeiten ||= []; if(!j.history.length) j.history.push(snapshot(j)); });
}

function viewTopic(v, id){
  const t = TOPICS.find(x=>x.id===id);
  v.innerHTML = `<button class="back" id="back">‹ Themen</button>
    <div class="card topic"><h3>${t.icon} ${t.title}</h3>${t.html}</div>
    <h2>Meine Notiz <span>z. B. was bei uns anders ist</span></h2>
    <div class="card"><textarea id="note" placeholder="Eigene Tipps, Erfahrungen, Hinweise für Azubis …">${esc(DB.notes[id]||"")}</textarea>
    <button class="btn sm" id="saveNote" style="margin-top:8px">Notiz speichern</button></div>`;
  v.querySelector("#back").onclick = () => { SUB=null; render(); };
  v.querySelector("#saveNote").onclick = () => { const n=v.querySelector("#note").value.trim(); if(n) DB.notes[id]=n; else delete DB.notes[id]; save(); toast("Notiz gespeichert"); };
}
function viewQuiz(v){
  if(quiz.done){
    const p = quiz.score;
    v.innerHTML = `<div class="hero ${p>=QUIZ.length*.75?"gr":"or"}"><div class="big">🏆</div><small>Ergebnis</small><h1>${p} von ${QUIZ.length} richtig</h1><p>${p===QUIZ.length?"Perfekt – Meister der Stanze!":p>=QUIZ.length*.75?"Sehr gut!":p>=QUIZ.length/2?"Gut, schau dir die Themen nochmal an.":"Lies die Themen durch und versuch es nochmal."}</p></div>
      <button class="btn" id="again">Nochmal</button><button class="btn light" id="back">Zurück zu Wissen</button>`;
    v.querySelector("#again").onclick = () => { quiz = {i:0, score:0, order:[...QUIZ.keys()].sort(()=>Math.random()-.5), done:false, ans:null}; render(); };
    v.querySelector("#back").onclick = () => { SUB=null; render(); };
    return;
  }
  const Q = QUIZ[quiz.order[quiz.i]];
  v.innerHTML = `<button class="back" id="back">‹ Abbrechen</button>
    <div class="card"><div class="small">Frage ${quiz.i+1} von ${QUIZ.length} · ${quiz.score} richtig</div>
    <h3 style="font-size:19px;margin:8px 0 12px">${esc(Q.q)}</h3>
    ${Q.o.map((o,i)=>`<button class="qopt ${quiz.ans!=null?(i===Q.a?"r":i===quiz.ans?"f":""):""}" data-o="${i}" ${quiz.ans!=null?"disabled":""}>${esc(o)}</button>`).join("")}
    ${quiz.ans!=null?`<div class="qexp"><b>${quiz.ans===Q.a?"✅ Richtig!":"❌ Nicht ganz."}</b> ${esc(Q.e)}</div><button class="btn" id="next">${quiz.i+1<QUIZ.length?"Weiter":"Ergebnis"}</button>`:""}</div>`;
  v.querySelector("#back").onclick = () => { SUB=null; render(); };
  v.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { quiz.ans = +b.dataset.o; if(quiz.ans===Q.a) quiz.score++; render(); });
  const n = v.querySelector("#next"); if(n) n.onclick = () => { quiz.i++; quiz.ans=null; if(quiz.i>=QUIZ.length){ quiz.done=true; if(quiz.score>DB.quizBest){DB.quizBest=quiz.score; save();} } render(); };
}

/* ===================== RECHNER ===================== */
const calc = {soll:"", ist:"", aus:"", nutzen:"", bogen:"", stapelH:"", dicke:"", bpb:"", bdicke:"", bges:"", pbh:"", plag:"", pph:"150"};
function viewRechner(v){
  v.innerHTML = `
    <div class="hero"><div class="big">🧮</div><small>Rechner</small><h1>Schnell gerechnet</h1><p>Restzeit, Nutzen und Stapel.</p></div>
    <h2>⏱️ Restzeit bis Auftrag fertig</h2>
    <div class="card"><div class="grid">
      <label class="f"><span>Soll-Menge (Bogen)</span><input data-c="soll" inputmode="numeric" value="${esc(calc.soll)}"></label>
      <label class="f"><span>Schon gestanzt</span><input data-c="ist" inputmode="numeric" value="${esc(calc.ist)}" placeholder="3237"></label>
      <label class="f full"><span>Ausstoß</span><div class="unit"><input data-c="aus" inputmode="numeric" value="${esc(calc.aus)}" placeholder="3173"><em>/h</em></div></label>
    </div><div id="r1"></div>
    <div id="rem" style="margin-top:10px"></div></div>
    <h2>📦 Stück aus Bogen</h2>
    <div class="card"><div class="grid">
      <label class="f"><span>Nutzen pro Bogen</span><input data-c="nutzen" inputmode="numeric" value="${esc(calc.nutzen)}"></label>
      <label class="f"><span>Bogen</span><input data-c="bogen" inputmode="numeric" value="${esc(calc.bogen)}"></label>
    </div><div id="r2"></div></div>
    <h2>🧱 Bündel</h2>
    <div class="card"><div class="grid">
      <label class="f"><span>Bogen pro Bündel</span><input data-c="bpb" inputmode="numeric" value="${esc(calc.bpb)}" placeholder="52"></label>
      <label class="f"><span>Bogendicke</span><div class="unit"><input data-c="bdicke" inputmode="decimal" value="${esc(calc.bdicke)}" placeholder="2,4"><em>mm</em></div></label>
      <label class="f full"><span>Bogen gesamt (Auftrag)</span><input data-c="bges" inputmode="numeric" value="${esc(calc.bges)}"></label>
    </div><div id="r4"></div><div class="small">Grenzen laut Mada Bogenableger: 50–410 mm. Wellpappe federt – nur Richtwert.</div></div>
    <h2>🧱 Palette (Corrpal)</h2>
    <div class="card"><div class="grid">
      <label class="f"><span>Bündelhöhe</span><div class="unit"><input data-c="pbh" inputmode="decimal" value="${esc(calc.pbh)}" placeholder="138"><em>mm</em></div></label>
      <label class="f"><span>Lagen</span><input data-c="plag" inputmode="numeric" value="${esc(calc.plag)}" placeholder="10"></label>
      <label class="f full"><span>Palettenhöhe</span><div class="unit"><input data-c="pph" inputmode="decimal" value="${esc(calc.pph)}" placeholder="150"><em>mm</em></div></label>
    </div><div id="r5"></div></div>
    <h2>📏 Bogen im Stapel</h2>
    <div class="card"><div class="grid">
      <label class="f"><span>Stapelhöhe</span><div class="unit"><input data-c="stapelH" inputmode="decimal" value="${esc(calc.stapelH)}"><em>mm</em></div></label>
      <label class="f"><span>Bogendicke</span><div class="unit"><input data-c="dicke" inputmode="decimal" value="${esc(calc.dicke)}" placeholder="1,2"><em>mm</em></div></label>
    </div><div id="r3"></div><div class="small">Grober Richtwert – Wellpappe federt, lieber nachzählen.</div></div>`;
  const upd = () => {
    const soll=num(calc.soll), ist=num(calc.ist)||0, aus=num(calc.aus);
    const rest = soll!=null ? Math.max(0, soll-ist) : null;
    let r1 = `<div class="small">Soll-Menge und Ausstoß eintragen.</div>`;
    if(rest!=null && aus){ const h = rest/aus; const fin = new Date(Date.now()+h*3600e3);
      r1 = `<div class="res ctime">${Math.floor(h)} h ${Math.round((h%1)*60)} min</div><div class="small">Noch ${fmt(rest)} Bogen · fertig ca. ${fin.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} Uhr${fin.toDateString()!==new Date().toDateString()?" ("+fin.toLocaleDateString("de-DE",{weekday:"short"})+")":""} – ohne Störungen</div>`; }
    v.querySelector("#r1").innerHTML = r1;
    const rem = v.querySelector("#rem");
    const active = DB.remind && DB.remind.at > Date.now();
    if(rest && aus){
      rem.innerHTML = `<div class="small" style="margin-bottom:6px">🔔 Erinnern vor Auftragsende:</div><div class="chips" style="margin:0">${[5,10,15,30].map(m=>`<button class="chip" data-rm="${m}">${m} min vorher</button>`).join("")}</div>`
        + (active?`<div class="small" style="margin-top:8px">Aktiv: ${new Date(DB.remind.at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} Uhr · <a href="#" id="rmOff" style="color:var(--bad)">löschen</a></div>`:"");
    } else rem.innerHTML = active ? `<div class="small">🔔 Erinnerung um ${new Date(DB.remind.at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} Uhr · <a href="#" id="rmOff" style="color:var(--bad)">löschen</a></div>` : "";
    rem.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => setReminder(Date.now() + rest/aus*3600e3 - (+b.dataset.rm)*60000, +b.dataset.rm, rest));
    const off = rem.querySelector("#rmOff"); if(off) off.onclick = e => { e.preventDefault(); cancelReminder().then(upd); };
    const n=num(calc.nutzen), b=num(calc.bogen);
    v.querySelector("#r2").innerHTML = n&&b ? `<div class="res">${fmt(n*b)} Stück</div>` : `<div class="small">Nutzen und Bogen eintragen.</div>`;
    const sh=num(calc.stapelH), d=num(calc.dicke);
    const bpb=num(calc.bpb), bd=num(calc.bdicke), bg=num(calc.bges);
    let r4 = `<div class="small">Bogen pro Bündel und Dicke eintragen.</div>`;
    if(bpb && bd){ const h = bpb*bd; const ok = h>=50 && h<=410;
      r4 = `<div class="res">≈ ${fmt(h,0)} mm hoch</div><div class="small" style="color:${ok?"var(--ok)":"var(--bad)"};font-weight:600">${ok?"✓ passt in 50–410 mm":h<50?"⚠ unter 50 mm Mindesthöhe":"⚠ über 410 mm Maximalhöhe"}</div>`
        + (bg ? `<div class="small" style="margin-top:4px">${fmt(Math.ceil(bg/bpb))} Bündel${bg%bpb?` (letztes mit ${fmt(bg%bpb)} Bogen)`:""}</div>` : ""); }
    v.querySelector("#r4").innerHTML = r4;
    const pbh=num(calc.pbh), plag=num(calc.plag), pph=num(calc.pph)||0;
    v.querySelector("#r5").innerHTML = pbh && plag ? `<div class="res">${fmt(pbh*plag)} mm Stapel</div><div class="small">mit Palette ≈ ${fmt(pbh*plag+pph)} mm hoch${bpb?` · ≈ ${fmt(plag*bpb)} Bogen je Bündelspur`:""}</div>` : `<div class="small">Bündelhöhe und Lagen eintragen.</div>`;
    v.querySelector("#r3").innerHTML = sh&&d ? `<div class="res">≈ ${fmt(Math.floor(sh/d))} Bogen</div>` : "";
  };
  v.querySelectorAll("[data-c]").forEach(i => i.oninput = () => { calc[i.dataset.c] = i.value; upd(); });
  upd();
}

/* ===================== Erinnerung ===================== */
async function setReminder(at, minBefore, rest){
  if(!NATIVE){ toast("Erinnerungen gehen nur in der installierten App"); return; }
  if(at < Date.now() + 30000){ toast("Das ist schon zu knapp – Auftrag ist fast fertig"); return; }
  try{
    const p = await capCall("LocalNotifications","requestPermissions");
    if(p && p.display && p.display !== "granted"){ toast("Bitte Benachrichtigungen für Fox Stanze erlauben"); return; }
    await capCall("LocalNotifications","cancel",{notifications:[{id:4711}]}).catch(()=>{});
    await capCall("LocalNotifications","schedule",{notifications:[{id:4711, title:"🦊 Auftrag gleich fertig", body:`Noch ca. ${minBefore} Minuten – nächsten Auftrag vorbereiten.`, schedule:{at:new Date(at).toISOString(), allowWhileIdle:true}}]});
    DB.remind = {at}; save(); render();
    toast("Erinnerung um " + new Date(at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}) + " Uhr");
  }catch(e){ toast("Erinnerung fehlgeschlagen: " + (e && e.message || e)); }
}
async function cancelReminder(){ try{ await capCall("LocalNotifications","cancel",{notifications:[{id:4711}]}); }catch(e){} DB.remind=null; save(); toast("Erinnerung gelöscht"); }

/* ===================== Rüst-Stoppuhr (oben) ===================== */
let timerInt = null;
function drawTimer(){
  const box = document.getElementById("timerbar");
  const t = DB.timer; const j = t && DB.jobs.find(x=>x.id===t.jobId);
  if(t && !j){ DB.timer = null; save(); }
  if(!t || !j){ box.innerHTML = ""; clearInterval(timerInt); timerInt=null; return; }
  const inJob = TAB==="ruesten" && SUB===j.id;
  box.innerHTML = inJob ? "" : `<div class="timerbar"><span>⏱️ Rüsten Artikel ${esc(j.artikel)}</span><b id="tbClock">${clockTxt(Date.now()-t.start)}</b><button id="tbOpen">Öffnen</button></div>`;
  const o = document.getElementById("tbOpen"); if(o) o.onclick = () => openJob(j.id);
  if(!timerInt) timerInt = setInterval(() => {
    if(!DB.timer){ clearInterval(timerInt); timerInt=null; return; }
    const txt = clockTxt(Date.now()-DB.timer.start);
    const a = document.getElementById("tbClock"), b = document.getElementById("jclock");
    if(a) a.textContent = txt; if(b) b.textContent = txt;
  }, 1000);
}

/* ===================== Dialoge, Sichern, Theme ===================== */
function modal(html){
  const m = document.createElement("div"); m.className="modal"; m.innerHTML = `<div class="sheet">${html}</div>`;
  m.onclick = e => { if(e.target===m || e.target.closest("[data-close]")) m.remove(); };
  document.body.appendChild(m); return m;
}
function confirmBox(text, yes, label){
  const danger = !label;
  const m = modal(`<h3>${esc(text)}</h3><button class="btn" id="yes" style="${danger?"background:var(--bad);":""}color:#fff;border:0">${esc(label||"Ja, löschen")}</button><button class="btn light" data-close>Abbrechen</button>`);
  m.querySelector("#yes").onclick = () => { m.remove(); yes(); };
  return m;
}
async function copy(txt){
  try{ await navigator.clipboard.writeText(txt); toast("Kopiert – z. B. in WhatsApp einfügen"); }
  catch(e){ modal(`<h3>Text</h3><textarea style="min-height:200px">${esc(txt)}</textarea><button class="btn light" data-close>Schließen</button>`); }
}
/* Datei teilen/speichern: data = Text oder base64 (binary=true) */
async function shareFile(name, data, mime, binary){
  if(NATIVE){
    try{
      const opt = {path:name, data, directory:"CACHE"}; if(!binary) opt.encoding = "utf8";
      const r = await capCall("Filesystem","writeFile",opt);
      await capCall("Share","share",{title:name, url:r.uri, dialogTitle:"Speichern oder senden"});
      return;
    }catch(e){ if(/cancel/i.test(String(e && (e.message||e)))) return; toast("Teilen fehlgeschlagen"); return; }
  }
  try{
    const blob = binary ? new Blob([Uint8Array.from(atob(data), c=>c.charCodeAt(0))],{type:mime}) : new Blob([data],{type:mime});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); toast("Datei heruntergeladen");
  }catch(e){ if(!binary) copy(data); }
}
function exportData(){ shareFile("fox-stanze-sicherung-" + today() + ".json", JSON.stringify(DB), "application/json"); }
function importData(text){
  try{
    const d = JSON.parse(text);
    if(!d || !Array.isArray(d.jobs)) throw 0;
    confirmBox(`Sicherung mit ${d.jobs.length} Artikeln und ${(d.shifts||[]).length} Schichten einspielen? Aktuelle Daten werden ersetzt.`, () => {
      DB = Object.assign({jobs:[],shifts:[],notes:{},quizBest:0,theme:"auto",seeded:true,fehler:null,checklist:null,checkDone:[],timer:null,remind:null}, d);
      seedExtras(); save(); applyTheme(); SUB=null; render(); toast("Sicherung eingespielt ✓"); }, "Ja, einspielen");
  }catch(e){ toast("Das ist keine gültige Fox-Stanze-Sicherung"); }
}
document.getElementById("btnMenu").onclick = () => {
  const m = modal(`<h3>Export &amp; Sicherung</h3>
    <button class="btn" id="pdfS">📄 Schichtbericht als PDF</button>
    <button class="btn light" id="csvS">📊 Schichten als Tabelle (Excel/CSV)</button>
    <button class="btn light" id="csvJ">📊 Rüstblätter als Tabelle (Excel/CSV)</button>
    <h3 style="margin-top:18px">Daten sichern</h3>
    <p class="small" style="margin-bottom:6px">Alles bleibt nur auf deinem Handy. Mach ab und zu eine Sicherung, z. B. vor einem Handywechsel.</p>
    <button class="btn light" id="exp">📤 Sicherung erstellen / teilen</button>
    <label class="btn light" style="text-align:center">📥 Sicherung einspielen<input type="file" accept=".json,application/json,text/plain" id="imp" hidden></label>
    <button class="btn light" id="paste">📋 Sicherung aus Zwischenablage</button>
    <p class="small" style="margin-top:12px;text-align:center">Fox Stanze · Build ${window.APP_BUILD||"dev"} · ${DB.jobs.length} Artikel · ${DB.shifts.length} Schichten</p>
    <button class="btn light" data-close>Schließen</button>`);
  m.querySelector("#pdfS").onclick = () => { m.remove(); pickPeriod(days => pdfShifts(days)); };
  m.querySelector("#csvS").onclick = () => { m.remove(); csvShifts(); };
  m.querySelector("#csvJ").onclick = () => { m.remove(); csvJobs(); };
  m.querySelector("#exp").onclick = () => { m.remove(); exportData(); };
  m.querySelector("#imp").onchange = e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ m.remove(); importData(r.result); }; r.readAsText(f); };
  m.querySelector("#paste").onclick = async () => { try{ const t = await navigator.clipboard.readText(); m.remove(); importData(t); }catch(e){ toast("Zwischenablage nicht lesbar"); } };
};
function pickPeriod(cb){
  const m = modal(`<h3>Zeitraum</h3>${[[7,"Letzte 7 Tage"],[30,"Letzte 30 Tage"],[0,"Alles"]].map(([d,l])=>`<button class="btn light" data-d="${d}">${l}</button>`).join("")}<button class="btn light" data-close>Abbrechen</button>`);
  m.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { m.remove(); cb(+b.dataset.d); });
}

/* ===================== CSV ===================== */
const csvCell = v => { const t = String(v ?? ""); return /[;"\n]/.test(t) ? '"'+t.replace(/"/g,'""')+'"' : t; };
const csv = rows => "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
function csvShifts(){
  const rows = [["Datum","Schicht","Artikel","Bogen","Ausstoß/h","Geschwindigkeit/h","Störminuten","Störungen","Notiz"]];
  [...DB.shifts].sort((a,b)=>a.datum.localeCompare(b.datum)).forEach(s => rows.push([dDE(s.datum), s.schicht, s.artikel, s.stueck, s.ausstoss, s.speed,
    (s.stoer||[]).reduce((b,x)=>b+(num(x.min)||0),0), (s.stoer||[]).map(x=>x.t+(x.min?` (${x.min} Min)`:"")).join(", "), s.notiz]));
  shareFile("fox-stanze-schichten-"+today()+".csv", csv(rows), "text/csv");
}
function csvJobs(){
  const rows = [["Artikel","Kunde","Format","Bogendicke","Geschwindigkeit","Leerhübe","Einschub Automatik","Bremsbürste",...ALL_FIELDS.map(f=>f.sec+" – "+f.l+(f.u?` (${f.u})`:"")),"Eigene Werte","Ø Rüstzeit (min)","Notiz","Geändert"]];
  DB.jobs.forEach(j => rows.push([j.artikel,j.kunde,j.format,j.dicke,j.speed,j.leerhuebe,j.einschub?"an":"aus",j.bremsbuerste?"an":"aus",...ALL_FIELDS.map(f=>j.values[f.k]||""),
    Object.entries(j.extra||{}).flatMap(([s,a])=>a.map(e=>`${e.n}: ${e.v}`)).join(", "),
    (j.ruestzeiten||[]).length?Math.round(avg(j.ruestzeiten.map(r=>r.dur))/60000):"", j.notiz, new Date(j.updated).toLocaleDateString("de-DE")]));
  shareFile("fox-stanze-ruestblaetter-"+today()+".csv", csv(rows), "text/csv");
}

/* ===================== PDF ===================== */
const pdfTxt = t => String(t ?? "").replace(/[−–]/g,"-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g,"").trim();
function newPdf(title, sub){
  const doc = new jspdf.jsPDF({unit:"mm", format:"a4"});
  doc.setFillColor(43,111,222); doc.rect(0,0,210,24,"F");
  doc.setFillColor(242,140,40); doc.rect(0,24,210,1.6,"F");
  doc.setTextColor(255); doc.setFont("helvetica","bold"); doc.setFontSize(17); doc.text(pdfTxt(title), 14, 12);
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text(pdfTxt(sub), 14, 19);
  doc.text("Fox Stanze", 196, 12, {align:"right"});
  doc.setTextColor(22,33,63);
  return {doc, y:34};
}
function pdfNeed(P, h){ if(P.y + h > 284){ P.doc.addPage(); P.y = 16; } }
function pdfHead(P, t){ pdfNeed(P, 14); P.doc.setFont("helvetica","bold"); P.doc.setFontSize(12); P.doc.setTextColor(43,111,222); P.doc.text(pdfTxt(t), 14, P.y); P.doc.setDrawColor(221,232,248); P.doc.line(14, P.y+1.8, 196, P.y+1.8); P.y += 8; P.doc.setTextColor(22,33,63); }
function pdfPairs(P, pairs){ /* zwei Spalten */
  P.doc.setFontSize(10);
  for(let i=0;i<pairs.length;i+=2){
    pdfNeed(P, 6.5);
    [pairs[i], pairs[i+1]].forEach((pr, c) => { if(!pr) return; const x = 14 + c*92;
      P.doc.setFont("helvetica","normal"); P.doc.setTextColor(93,107,136); P.doc.text(pdfTxt(pr[0]), x, P.y);
      P.doc.setFont("helvetica","bold"); P.doc.setTextColor(22,33,63); P.doc.text(pdfTxt(pr[1]), x+86, P.y, {align:"right"}); });
    P.y += 6.2;
  }
  P.y += 2;
}
function pdfPara(P, t){ P.doc.setFont("helvetica","normal"); P.doc.setFontSize(10); const lines = P.doc.splitTextToSize(pdfTxt(t), 182); lines.forEach(l => { pdfNeed(P,5.5); P.doc.text(l, 14, P.y); P.y += 5.2; }); P.y += 2; }
function qrSvg(text){ const q = qrcode(0, "M"); q.addData(text); q.make(); return q; }
function pdfQR(doc, text, x, y, size){
  const q = qrSvg(text), n = q.getModuleCount(), m = size/n;
  doc.setFillColor(0,0,0);
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) doc.rect(x+c*m, y+r*m, m+0.02, m+0.02, "F");
}
async function pdfOut(doc, name){ const b64 = doc.output("datauristring").split(",")[1]; await shareFile(name, b64, "application/pdf", true); }

function pdfJob(j){
  const P = newPdf(`Rüstblatt Artikel ${j.artikel}`, `${j.kunde||""}  ·  Stand ${new Date(j.updated).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"})}`);
  pdfQR(P.doc, "FOXSTANZE:"+j.artikel, 170, 30, 26);
  P.doc.setFontSize(7); P.doc.setTextColor(93,107,136); P.doc.text("in Fox Stanze scannen", 183, 59, {align:"center"}); P.doc.setTextColor(22,33,63);
  pdfHead(P, "Auftrag");
  P.doc.setFontSize(10);
  [["Format", j.format],["Bogen pro Bündel", j.buendel],["Bogendicke", j.dicke?j.dicke+" mm":""],["Geschwindigkeit", j.speed?j.speed+" /h":""],["Leerhübe", j.leerhuebe],["Einschub Automatik", j.einschub?"an":"aus"],["Bremsbürste", j.bremsbuerste?"an":"aus"]]
    .forEach(([l,v]) => { P.doc.setFont("helvetica","normal"); P.doc.setTextColor(93,107,136); P.doc.text(pdfTxt(l), 14, P.y); P.doc.setFont("helvetica","bold"); P.doc.setTextColor(22,33,63); P.doc.text(pdfTxt(v||"-"), 70, P.y); P.y += 6; });
  P.y = Math.max(P.y, 64) + 2;
  const rz = j.ruestzeiten||[];
  if(rz.length) pdfPara(P, `Rüstzeit: ${rz.length}x gemessen, Durchschnitt ${durTxt(avg(rz.map(r=>r.dur)))}, zuletzt ${durTxt(rz[rz.length-1].dur)}`);
  for(const s of SECTIONS){
    const pairs = s.fields.filter(f => j.values[f.k]).map(f => [f.l, j.values[f.k] + (f.u && !f.text ? " "+f.u : "")]);
    (j.extra[s.id]||[]).forEach(e => pairs.push([e.n||"Eigener Wert", e.v]));
    if(!pairs.length) continue;
    pdfHead(P, s.title); pdfPairs(P, pairs);
  }
  if(j.notiz){ pdfHead(P, "Notizen"); pdfPara(P, j.notiz); }
  if((j.photos||[]).length){
    pdfHead(P, "Fotos");
    let x = 14;
    for(const ph of j.photos){
      const pr = P.doc.getImageProperties(ph); const w = 58, h = Math.min(80, w*pr.height/pr.width);
      if(x + w > 200){ x = 14; P.y += 84; }
      pdfNeed(P, h+4); P.doc.addImage(ph, "JPEG", x, P.y, w, h); x += w + 4;
    }
  }
  pdfOut(P.doc, `Ruestblatt-${j.artikel}.pdf`);
}
function shiftsIn(days){ const from = days ? Date.now() - days*864e5 : 0; return DB.shifts.filter(s => new Date(s.datum+"T12:00").getTime() >= from - 864e5/2); }
function stoerStats(list){
  const m = {};
  list.forEach(s => (s.stoer||[]).forEach(x => { const k = (x.t||"Ohne Text").trim(); (m[k] ||= {t:k, min:0, n:0}); m[k].min += num(x.min)||0; m[k].n++; }));
  return Object.values(m).sort((a,b) => b.min - a.min || b.n - a.n);
}
function pdfShifts(days){
  const list = shiftsIn(days).sort((a,b)=>a.datum.localeCompare(b.datum) || SCHICHTEN.indexOf(a.schicht)-SCHICHTEN.indexOf(b.schicht));
  const P = newPdf("Schichtbericht", (days?`Letzte ${days} Tage`:"Alle Einträge") + `  ·  erstellt ${new Date().toLocaleDateString("de-DE")}`);
  const bogen = list.reduce((a,s)=>a+(num(s.stueck)||0),0), stMin = list.reduce((a,s)=>a+(s.stoer||[]).reduce((b,x)=>b+(num(x.min)||0),0),0);
  const aus = list.map(s=>num(s.ausstoss)).filter(Boolean);
  pdfHead(P, "Übersicht");
  pdfPairs(P, [["Schichten", String(list.length)],["Bogen gesamt", fmt(bogen)],["Störungen gesamt", fmt(stMin)+" Min"],["Durchschnitt Ausstoß", aus.length?fmt(avg(aus))+" /h":"-"]]);
  const st = stoerStats(list);
  if(st.length){ pdfHead(P, "Häufigste Störungen"); pdfPairs(P, st.slice(0,10).map(x => [x.t, `${x.n}x · ${fmt(x.min)} Min`])); }
  pdfHead(P, "Einträge");
  const cols = [14, 36, 52, 74, 96, 118];
  P.doc.setFontSize(9); P.doc.setFont("helvetica","bold"); P.doc.setTextColor(93,107,136);
  ["Datum","Schicht","Artikel","Bogen","Ausstoß","Störungen / Notiz"].forEach((h,i)=>P.doc.text(h, cols[i], P.y)); P.y += 5.5;
  P.doc.setTextColor(22,33,63);
  list.forEach(s => {
    const info = pdfTxt([(s.stoer||[]).filter(x=>x.t).map(x=>x.t+(x.min?` ${x.min}'`:"")).join(", "), s.notiz].filter(Boolean).join(" - "));
    const lines = P.doc.splitTextToSize(info || "-", 78);
    pdfNeed(P, 5 + lines.length*4.4);
    P.doc.setFont("helvetica","normal");
    [dDE(s.datum), s.schicht, s.artikel||"-", s.stueck?fmt(num(s.stueck)):"-", s.ausstoss?fmt(num(s.ausstoss)):"-"].forEach((t,i)=>P.doc.text(pdfTxt(t), cols[i], P.y));
    lines.forEach((l,i) => P.doc.text(l, cols[5], P.y + i*4.4));
    P.y += Math.max(5.5, lines.length*4.4 + 1.2);
    P.doc.setDrawColor(235,240,248); P.doc.line(14, P.y-3.2, 196, P.y-3.2);
  });
  if(!list.length) pdfPara(P, "Keine Einträge im Zeitraum.");
  pdfOut(P.doc, `Schichtbericht-${today()}.pdf`);
}
function qrLabel(j){
  const q = qrSvg("FOXSTANZE:"+j.artikel);
  const m = modal(`<h3>QR-Etikett Artikel ${esc(j.artikel)}</h3>
    <div class="qrbox">${q.createSvgTag({cellSize:6, margin:2, scalable:true})}<div style="font-weight:800;font-size:20px;margin-top:6px">Artikel ${esc(j.artikel)}</div><div style="font-size:13px">${esc(j.kunde)}</div></div>
    <p class="small" style="margin:10px 2px">Aufs Werkzeug oder den Auftragsschein kleben. In der Liste auf „▦ QR“ tippen und fotografieren – das Rüstblatt geht direkt auf.</p>
    <button class="btn" id="lblPdf">📄 Etiketten-PDF (8 Stück)</button><button class="btn light" data-close>Schließen</button>`);
  m.querySelector("#lblPdf").onclick = () => {
    const doc = new jspdf.jsPDF({unit:"mm", format:"a4"});
    for(let i=0;i<8;i++){ const x = 14 + (i%2)*95, y = 14 + Math.floor(i/2)*68;
      doc.setDrawColor(200); doc.setLineDashPattern([1.5,1.5],0); doc.rect(x, y, 87, 62);
      pdfQR(doc, "FOXSTANZE:"+j.artikel, x+5, y+8, 46);
      doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.text(pdfTxt("Artikel"), x+56, y+22); doc.setFontSize(22); doc.text(pdfTxt(j.artikel), x+56, y+32);
      doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text(doc.splitTextToSize(pdfTxt(j.kunde||""), 28), x+56, y+40);
      doc.setFontSize(7); doc.setTextColor(120); doc.text("Fox Stanze", x+56, y+56); doc.setTextColor(0); }
    pdfOut(doc, `QR-Etiketten-${j.artikel}.pdf`);
  };
}
function applyTheme(){
  const dark = DB.theme==="dark" || (DB.theme==="auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.getElementById("btnTheme").textContent = dark ? "☀️" : "🌙";
}
document.getElementById("btnTheme").onclick = () => {
  const dark = document.documentElement.getAttribute("data-theme")==="dark";
  DB.theme = dark ? "light" : "dark"; save(); applyTheme();
};

/* Android-Zurück-Taste */
function onBack(){
  const m = document.querySelector(".modal"); if(m){ m.remove(); return; }
  const o = document.querySelector(".ocr"); if(o){ o.remove(); return; }
  const b = document.querySelector(".back"); if(b){ b.click(); return; }
  if(TAB!=="ruesten"){ TAB="ruesten"; SUB=null; render(); return; }
  capCall("App","exitApp").catch(()=>{});
}
if(NATIVE && CAP.nativeCallback){ try{ CAP.nativeCallback("App","addListener",{eventName:"backButton"}, () => onBack()); }catch(e){} }

seed(); seedExtras(); save(); applyTheme(); render();
