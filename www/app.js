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
  {id:"auslauf", icon:"➡️", title:"Auslauftransport", fields:[
    {k:"au_band", l:"Bandgeschwindigkeit", u:"", h:"Bildschirm: 50"},
    {k:"au_takt", l:"Zeit", u:"s", h:"Bildschirm: 0,5"},
    {k:"au_hoehe", l:"Höhe", u:"mm", h:"Bildschirm: 555"},
  ]},
  {id:"stopper", icon:"🚦", title:"Stopperüberwachung", fields:[
    {k:"sp_kp1", l:"Kontrollpunkt 1", u:"mm", h:"Abstand zur Bogenvorderkante · Bildschirm: 150"},
    {k:"sp_kp2", l:"Kontrollpunkt 2", u:"mm", h:"Bildschirm: 1085"},
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
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === TAB));
  const v = document.getElementById("view");
  ({ruesten:viewRuesten, schicht:viewSchicht, wissen:viewWissen, rechner:viewRechner})[TAB](v);
  drawTimer();
}

/* ===================== RÜSTEN ===================== */
let jobFilter = "";
const ALL_FIELDS = SECTIONS.flatMap(s => s.fields.map(f => Object.assign({sec:s.title}, f)));
const JOB_BASE = [["artikel","Artikel"],["kunde","Kunde"],["format","Format"],["dicke","Bogendicke"],["speed","Geschwindigkeit"],["leerhuebe","Leerhübe"]];
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
    <button class="btn fox" id="newJob">＋ Neuer Artikel</button>`;
  const q = v.querySelector("#q");
  q.oninput = () => { jobFilter = q.value; const pos=q.selectionStart; render(); const n=document.getElementById("q"); n.focus(); n.setSelectionRange(pos,pos); };
  v.querySelectorAll(".item").forEach(el => el.onclick = () => openJob(el.dataset.id));
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
    ["artikel","kunde","format","dicke","speed","leerhuebe","notiz"].forEach(k => j[k] = v.querySelector("#j_"+k).value.trim());
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
const STOER_VORLAGEN = ["Greiferrandzerhacker AS geöffnet","Stau","Doppelbogen","Bogen schief / nicht angelegt","Bogenablager voll","Werkzeug nachgerichtet","Ausbrechen hängt","Rüsten","Materialwechsel","Pause / Besprechung"];
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
  {id:"sicher", icon:"🛑", title:"Sicherheit", html:`
    <ul><li><b>NOT-HALT</b> (roter Pilz) stoppt sofort alles.</li><li>Nie in die Maschine greifen, solange sie nicht gesichert ist.</li><li>Meldungen wie „Greiferrandzerhacker Antriebsseite geöffnet“ bedeuten: eine Schutzeinrichtung ist offen – erst schließen, dann starten.</li><li>Beim Werkzeugwechsel Maschine sichern, wie im Betrieb vorgeschrieben.</li></ul>`},
];
const QUIZ = [
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
  if(SUB === "fehler") return viewFehler(v);
  if(SUB && SUB.startsWith("fehler:")) return viewFehlerEdit(v, SUB.slice(7));
  if(SUB) return viewTopic(v, SUB);
  v.innerHTML = `
    <div class="hero or"><div class="big">📖</div><small>Wissen & Schulung</small><h1>Die Stanze verstehen</h1>
      <p>Für dich und für Azubis – mit eigenen Notizen pro Thema.</p></div>
    <button class="btn" id="startQuiz" style="margin-bottom:12px">🎯 Quiz starten (${QUIZ.length} Fragen)${DB.quizBest?` · Bestwert ${DB.quizBest}/${QUIZ.length}`:""}</button>
    <div class="item" id="goCheck" style="border-left-color:var(--green)"><div class="t"><b>✅ Rüst-Checkliste</b><small>Schritt für Schritt abhaken – für Azubis · ${DB.checkDone.length}/${DB.checklist.length} erledigt</small></div><div class="go">›</div></div>
    <div class="item" id="goFehler" style="border-left-color:var(--bad)"><div class="t"><b>🛠️ Fehlerbibliothek</b><small>Problem → Ursache → was hilft · ${DB.fehler.length} Einträge</small></div><div class="go">›</div></div>
    <h2>Themen</h2>
    ${TOPICS.map(t=>`<div class="item" data-id="${t.id}" style="border-left-color:var(--accent)"><div class="t"><b>${t.icon} ${t.title}</b>${DB.notes[t.id]?`<small>📝 eigene Notiz</small>`:""}</div><div class="go">›</div></div>`).join("")}`;
  v.querySelectorAll(".item[data-id]").forEach(el => el.onclick = () => { SUB = el.dataset.id; render(); scrollTo(0,0); });
  v.querySelector("#goCheck").onclick = () => { SUB="check"; render(); scrollTo(0,0); };
  v.querySelector("#goFehler").onclick = () => { SUB="fehler"; render(); scrollTo(0,0); };
  v.querySelector("#startQuiz").onclick = () => { quiz = {i:0, score:0, order:[...QUIZ.keys()].sort(()=>Math.random()-.5), done:false, ans:null}; SUB="quiz"; render(); scrollTo(0,0); };
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
    v.innerHTML = `<div class="hero ${p>=8?"gr":"or"}"><div class="big">🏆</div><small>Ergebnis</small><h1>${p} von ${QUIZ.length} richtig</h1><p>${p===QUIZ.length?"Perfekt – Meister der Stanze!":p>=8?"Sehr gut!":p>=5?"Gut, schau dir die Themen nochmal an.":"Lies die Themen durch und versuch es nochmal."}</p></div>
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
const calc = {soll:"", ist:"", aus:"", nutzen:"", bogen:"", stapelH:"", dicke:""};
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
  [["Format", j.format],["Bogendicke", j.dicke?j.dicke+" mm":""],["Geschwindigkeit", j.speed?j.speed+" /h":""],["Leerhübe", j.leerhuebe],["Einschub Automatik", j.einschub?"an":"aus"],["Bremsbürste", j.bremsbuerste?"an":"aus"]]
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
