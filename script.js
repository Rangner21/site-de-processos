const STORAGE_KEY = "flowmind_notes_v1";
const UI_KEY = "flowmind_ui_v1";

const suggestionRules = [
  { keyword:"atraso", suggestions:["Automação parcial","Padronização","Aprovação digital","Redução de etapas","Fluxo automatizado"] },
  { keyword:"retrabalho", suggestions:["Checklist operacional","Padronização","Validação automática","Centralização","Simplificação"] },
  { keyword:"duplicidade", suggestions:["Unificação de fluxo","Centralização","Integração de processos"] },
  { keyword:"erro manual", suggestions:["Automação","Validação inteligente","Conferência automática"] },
  { keyword:"aprovação", suggestions:["Aprovação remota","Fluxo digital","Assinatura eletrônica"] },
  { keyword:"aprovacao", suggestions:["Aprovação remota","Fluxo digital","Assinatura eletrônica"] },
  { keyword:"planilha", suggestions:["Integração automática","Banco centralizado","Automação de preenchimento"] }
];

const tagMap = {
  compras:"#compras", estoque:"#estoque", financeiro:"#financeiro", logistica:"#logistica",
  logística:"#logistica", manual:"#manual", erro:"#erro", retrabalho:"#retrabalho",
  processo:"#processo", atraso:"#gargalo", aprovação:"#aprovacao", aprovacao:"#aprovacao"
};

let state = {
  notes: [],
  filter: "all",
  search: "",
  selectedTag: null,
  draggedId: null
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const feed = $("#feed");
const searchInput = $("#searchInput");
const modal = $("#noteModal");

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()); }
function now(){ return new Date().toISOString(); }
function formatDate(iso){
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
}
function normalize(txt){
  return (txt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
  localStorage.setItem(UI_KEY, JSON.stringify({filter:state.filter, selectedTag:state.selectedTag}));
}
function load(){
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  const ui = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
  state.filter = ui.filter || "all";
  state.selectedTag = ui.selectedTag || null;
  if(saved && Array.isArray(saved)){ state.notes = saved; return; }
  state.notes = [
    {
      id:uid(), title:"Aprovação de compras",
      process:"A aprovação depende do gerente presencialmente.",
      bottleneck:"Quando ele está externo o processo atrasa.",
      improvementIdea:"",
      favorite:true, archived:false, createdAt:now(), updatedAt:now()
    },
    {
      id:uid(), title:"Controle de estoque",
      process:"Os lançamentos são feitos manualmente em planilhas.",
      bottleneck:"Existe retrabalho e erro manual frequente.",
      improvementIdea:"Criar integração automática.",
      favorite:false, archived:false, createdAt:now(), updatedAt:now()
    }
  ];
  save();
}

function getText(note){
  return `${note.title} ${note.process} ${note.bottleneck} ${note.improvementIdea}`;
}
function generateSuggestions(note){
  if((note.improvementIdea || "").trim()) return [];
  const text = normalize(getText(note));
  const set = new Set();
  suggestionRules.forEach(rule => {
    if(text.includes(normalize(rule.keyword))) rule.suggestions.forEach(s => set.add(s));
  });
  return [...set].slice(0,6);
}
function generateTags(note){
  const text = normalize(getText(note));
  const tags = new Set();
  Object.entries(tagMap).forEach(([k,v]) => {
    if(text.includes(normalize(k))) tags.add(v);
  });
  if((note.bottleneck || "").trim()) tags.add("#gargalo");
  if((note.improvementIdea || "").trim()) tags.add("#melhoria");
  return [...tags];
}
function filteredNotes(){
  let arr = [...state.notes];
  if(state.filter === "favorite") arr = arr.filter(n => n.favorite && !n.archived);
  else if(state.filter === "archived") arr = arr.filter(n => n.archived);
  else if(state.filter === "recent") arr = arr.filter(n => !n.archived).sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
  else if(state.filter === "bottleneck") arr = arr.filter(n => !n.archived && (n.bottleneck || "").trim());
  else if(state.filter === "improvement") arr = arr.filter(n => !n.archived && (n.improvementIdea || "").trim());
  else arr = arr.filter(n => !n.archived);

  if(state.selectedTag) arr = arr.filter(n => generateTags(n).includes(state.selectedTag));
  if(state.search.trim()){
    const q = normalize(state.search);
    arr = arr.filter(n => normalize(getText(n) + " " + generateTags(n).join(" ")).includes(q));
  }
  return arr;
}

let saveTimer;
function updateNote(id, field, value){
  const note = state.notes.find(n => n.id === id);
  if(!note) return;
  note[field] = value;
  note.updatedAt = now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { save(); render(); }, 250);
}

function cardTemplate(note){
  const suggestions = generateSuggestions(note);
  const tags = generateTags(note);
  return `
    <article class="note-card" draggable="true" data-id="${note.id}">
      <div class="card-top">
        <h3 class="card-title" contenteditable="true" data-field="title" data-placeholder="Título da anotação">${escapeHtml(note.title)}</h3>
        <div class="card-actions">
          <button class="mini-btn favorite ${note.favorite ? "on":""}" data-action="favorite" title="Favoritar">★</button>
          <button class="mini-btn" data-action="duplicate" title="Duplicar">⧉</button>
          <button class="mini-btn" data-action="archive" title="Arquivar">${note.archived ? "↥":"↧"}</button>
          <button class="mini-btn" data-action="delete" title="Excluir">×</button>
        </div>
      </div>

      ${editableField("Processo","process",note.process,"Descreva o processo...")}
      ${editableField("Gargalo","bottleneck",note.bottleneck,"Descreva o gargalo...")}
      ${editableField("Ideia de melhoria","improvementIdea",note.improvementIdea,"Minha ideia de melhoria...")}

      ${suggestions.length ? `<div class="suggestions">${suggestions.map(s=>`<button class="suggestion" data-suggestion="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join("")}</div>` : ""}
      <div class="card-tags">${tags.map(t=>`<button class="tag" data-tag="${t}">${t}</button>`).join("")}</div>
      <div class="card-foot">
        <span><i class="status-dot"></i> Auto salvo</span>
        <span>${formatDate(note.updatedAt)}</span>
      </div>
    </article>
  `;
}
function editableField(label, field, value, ph){
  return `<div class="field"><label>${label}</label><div class="editable" contenteditable="true" data-field="${field}" data-placeholder="${ph}">${escapeHtml(value || "")}</div></div>`;
}
function escapeHtml(str=""){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapeAttr(str=""){ return escapeHtml(str).replace(/"/g,"&quot;"); }

function render(){
  const notes = filteredNotes();
  feed.innerHTML = notes.length ? notes.map(cardTemplate).join("") : `<div class="empty">Nenhuma anotação encontrada. Crie uma nova melhoria para começar.</div>`;
  renderTags();
  renderStats();
  syncFilters();
  bindCards();
}
function renderStats(){
  $("#totalCount").textContent = state.notes.filter(n=>!n.archived).length;
  $("#improvementCount").textContent = state.notes.filter(n=>!n.archived && n.improvementIdea.trim()).length;
  $("#bottleneckCount").textContent = state.notes.filter(n=>!n.archived && n.bottleneck.trim()).length;
}
function renderTags(){
  const all = new Map();
  state.notes.forEach(n => generateTags(n).forEach(t => all.set(t, (all.get(t)||0)+1)));
  $("#tagCloud").innerHTML = [...all.keys()].map(t => `<button class="smart-tag" data-tag="${t}">${t}</button>`).join("") || `<small style="color:#9AA4B2">Sem tags ainda</small>`;
  $$("#tagCloud .smart-tag").forEach(btn => btn.onclick = () => {
    state.selectedTag = state.selectedTag === btn.dataset.tag ? null : btn.dataset.tag;
    save(); render();
  });
}
function syncFilters(){
  $$(".nav-item,.chip").forEach(b => b.classList.toggle("active", b.dataset.filter === state.filter));
}

function bindCards(){
  $$(".note-card").forEach(card => {
    const id = card.dataset.id;
    card.querySelectorAll("[contenteditable]").forEach(el => {
      el.addEventListener("input", () => updateNote(id, el.dataset.field, el.innerText.trim()));
      el.addEventListener("blur", () => render());
    });

    card.querySelectorAll("[data-action]").forEach(btn => {
      btn.onclick = () => handleAction(id, btn.dataset.action);
    });

    card.querySelectorAll("[data-suggestion]").forEach(btn => {
      btn.onclick = () => {
        updateNote(id, "improvementIdea", btn.dataset.suggestion);
        save(); render();
      };
    });

    card.querySelectorAll("[data-tag]").forEach(btn => {
      btn.onclick = () => { state.selectedTag = btn.dataset.tag; save(); render(); };
    });

    card.addEventListener("dragstart", () => { state.draggedId = id; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => { state.draggedId = null; card.classList.remove("dragging"); save(); render(); });
    card.addEventListener("dragover", e => {
      e.preventDefault();
      const dragged = state.notes.findIndex(n => n.id === state.draggedId);
      const target = state.notes.findIndex(n => n.id === id);
      if(dragged < 0 || target < 0 || dragged === target) return;
      const [item] = state.notes.splice(dragged,1);
      state.notes.splice(target,0,item);
      save();
      render();
    });
  });
}
function handleAction(id, action){
  const idx = state.notes.findIndex(n => n.id === id);
  if(idx < 0) return;
  const note = state.notes[idx];

  if(action === "favorite") note.favorite = !note.favorite;
  if(action === "archive") note.archived = !note.archived;
  if(action === "duplicate"){
    state.notes.splice(idx+1,0,{...note,id:uid(),title:note.title+" cópia",favorite:false,archived:false,createdAt:now(),updatedAt:now()});
  }
  if(action === "delete"){
    if(confirm("Excluir esta anotação?")) state.notes.splice(idx,1);
  }
  note.updatedAt = now();
  save(); render();
}

function setFilter(f){
  state.filter = f; state.selectedTag = null; save(); render();
}
$$(".nav-item,.chip").forEach(btn => btn.onclick = () => setFilter(btn.dataset.filter));

searchInput.addEventListener("input", e => {
  state.search = e.target.value;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(render, 120);
});

function openModal(){ modal.showModal(); setTimeout(()=>$("#titleField").focus(),80); }
function closeModal(){ modal.close(); $("#noteForm").reset(); }
$("#newBtn").onclick = openModal;
$("#fab").onclick = openModal;
$("#closeModal").onclick = closeModal;
$("#cancelModal").onclick = closeModal;

$("#noteForm").addEventListener("submit", e => {
  e.preventDefault();
  const note = {
    id:uid(),
    title:$("#titleField").value.trim(),
    process:$("#processField").value.trim(),
    bottleneck:$("#bottleneckField").value.trim(),
    improvementIdea:$("#ideaField").value.trim(),
    favorite:false,
    archived:false,
    createdAt:now(),
    updatedAt:now()
  };
  state.notes.unshift(note);
  save(); closeModal(); render();
});

$("#menuBtn").onclick = () => { $("#sidebar").classList.add("open"); $("#overlay").classList.add("open"); };
$("#overlay").onclick = () => { $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("open"); };

load();
render();
