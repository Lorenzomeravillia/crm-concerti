/* global supabase, CRM_CONFIG */

// ── Init ──────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(
  window.CRM_CONFIG.SUPABASE_URL,
  window.CRM_CONFIG.SUPABASE_KEY
);

const TABLE = 'venues';

// ── State ─────────────────────────────────────────────────────────────────
let allVenues = [];

// ── DOM refs ──────────────────────────────────────────────────────────────
const cardList      = document.getElementById('cardList');
const statsBar      = document.getElementById('statsBar');
const searchInput   = document.getElementById('searchInput');
const filterStato   = document.getElementById('filterStato');
const filterTipo    = document.getElementById('filterTipo');
const filterGruppo  = document.getElementById('filterGruppo');
const filterOltre   = document.getElementById('filterOltre');
const overlay       = document.getElementById('overlay');
const modalTitle    = document.getElementById('modalTitle');
const venueForm     = document.getElementById('venueForm');
const btnAdd        = document.getElementById('btnAdd');
const fab           = document.getElementById('fab');
const btnCancel     = document.getElementById('btnCancel');
const btnClose      = document.getElementById('btnClose');
const btnDelete     = document.getElementById('btnDelete');
const btnSave       = document.getElementById('btnSave');
const btnExportPdf  = document.getElementById('btnExportPdf');
const toast         = document.getElementById('toast');

// ── Display labels ──────────────────────────────────────────────────────────
const LABELS = {
  tipo: { enoteca: 'Enoteca', pub: 'Pub', birreria: 'Birreria', ristorante: 'Ristorante', sagra_feste: 'Sagra / Feste', altro: 'Altro' },
  gruppo: { black_white: 'Black & White', '2deep': '2Deep', entrambi: 'Entrambi', da_decidere: 'Da decidere' },
  canale: { instagram: 'Instagram', email: 'Email', visita: 'Visita', altro: 'Altro' },
  stato: { da_contattare: 'Da contattare', contattato: 'Contattato', risposto: 'Risposto', serata_fissata: 'Serata fissata', no: 'No' },
};

// ── Helpers ───────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.className = ''; }, 3000);
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function badge(value, kind) {
  if (!value) return '';
  const label = (LABELS[kind] && LABELS[kind][value]) || value.replace(/_/g, ' ');
  return `<span class="badge badge-${value}">${esc(label)}</span>`;
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Render ────────────────────────────────────────────────────────────────
function applyFilters() {
  const q     = searchInput.value.toLowerCase().trim();
  const stato = filterStato.value;
  const tipo  = filterTipo.value;
  const gruppo = filterGruppo.value;
  const oltre = filterOltre.value;

  return allVenues.filter(v => {
    if (q && !`${v.nome} ${v.citta}`.toLowerCase().includes(q)) return false;
    if (stato  && v.stato !== stato)   return false;
    if (tipo   && v.tipo  !== tipo)    return false;
    if (gruppo && v.gruppo_proposto !== gruppo) return false;
    if (oltre === 'true'  && !v.oltre_20km) return false;
    if (oltre === 'false' &&  v.oltre_20km) return false;
    return true;
  });
}

function renderStats(venues) {
  const byStato = {};
  venues.forEach(v => { byStato[v.stato] = (byStato[v.stato] || 0) + 1; });
  const order = ['serata_fissata', 'risposto', 'contattato', 'da_contattare', 'no'];
  const labels = {
    serata_fissata: 'Serate fissate',
    risposto: 'Risposte',
    contattato: 'Contattati',
    da_contattare: 'Da contattare',
    no: 'No',
  };

  let html = '';
  if (venues.length < allVenues.length) {
    html += `<div class="stat-chip stat-chip-filter" id="filterResetChip">
      Filtri attivi — mostrati <strong>${venues.length}</strong> di ${allVenues.length} · azzera
    </div>`;
  } else {
    html += `<div class="stat-chip">Totale <strong>${venues.length}</strong></div>`;
  }

  statsBar.innerHTML = html +
    order.filter(s => byStato[s]).map(s =>
      `<div class="stat-chip">${labels[s]} <strong>${byStato[s]}</strong></div>`
    ).join('');

  const resetChip = document.getElementById('filterResetChip');
  if (resetChip) resetChip.addEventListener('click', resetFilters);
}

function resetFilters() {
  searchInput.value = '';
  filterStato.value = '';
  filterTipo.value = '';
  filterGruppo.value = '';
  filterOltre.value = '';
  renderCards();
}

// ── PDF export ────────────────────────────────────────────────────────────
function exportPdf() {
  const rows = applyFilters();
  if (!rows.length) { showToast('Nessun locale da esportare.', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('it-IT');

  doc.setFontSize(14);
  doc.text('CRM Concerti — Locali', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Esportato il ${today} — ${rows.length} locali`, 14, 20);

  const head = [['Nome', 'Città', 'Km', 'Tipo', 'Gruppo', 'Canale', 'Contatto', 'Stato', 'Ultimo contatto', 'Note']];
  const body = rows.map(v => [
    v.nome || '',
    v.citta || '',
    v.distanza_km != null ? String(v.distanza_km) : '',
    LABELS.tipo[v.tipo] || v.tipo || '',
    LABELS.gruppo[v.gruppo_proposto] || v.gruppo_proposto || '',
    LABELS.canale[v.canale] || v.canale || '',
    v.contatto || '',
    LABELS.stato[v.stato] || v.stato || '',
    fmtDate(v.data_ultimo_contatto),
    v.note || '',
  ]);

  doc.autoTable({
    head, body,
    startY: 25,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [124, 106, 247], textColor: 255 },
    columnStyles: { 9: { cellWidth: 60 } },
  });

  doc.save(`crm-concerti-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function renderCards() {
  const rows = applyFilters();
  renderStats(rows);

  if (!rows.length) {
    cardList.innerHTML = `<div class="empty-state">Nessun locale trovato.</div>`;
    return;
  }

  cardList.innerHTML = rows.map(v => {
    const dist = v.distanza_km != null ? `${v.distanza_km} km` : (v.oltre_20km ? 'oltre 20 km' : '');
    const sub = [esc(v.citta), dist].filter(Boolean).join('<span class="dot">·</span>');

    const meta = [];
    if (v.canale) meta.push(`<span>${esc(LABELS.canale[v.canale] || v.canale)}</span>`);
    if (v.contatto) meta.push(`<span>${esc(v.contatto)}</span>`);
    if (v.data_ultimo_contatto) meta.push(`<span>📅 ${fmtDate(v.data_ultimo_contatto)}</span>`);
    if (v.link_profilo) meta.push(`<a href="${esc(v.link_profilo)}" target="_blank" rel="noopener" data-stop="1">Profilo ↗</a>`);

    return `
    <div class="card" data-id="${v.id}">
      <div class="card-top">
        <span class="card-title">${esc(v.nome)}</span>
        ${badge(v.stato, 'stato')}
      </div>
      <div class="card-sub">${sub}</div>
      <div class="card-badges">
        ${badge(v.tipo, 'tipo')}
        ${badge(v.gruppo_proposto, 'gruppo')}
      </div>
      ${meta.length ? `<div class="card-meta">${meta.join('')}</div>` : ''}
      ${v.note ? `<div class="card-note">${esc(v.note)}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Load data ─────────────────────────────────────────────────────────────
async function loadVenues() {
  cardList.innerHTML = `<div class="empty-state"><span class="loader"></span> Caricamento…</div>`;
  const { data, error } = await sb.from(TABLE).select('*').order('nome');
  if (error) { showToast('Errore caricamento: ' + error.message, 'error'); return; }
  allVenues = data || [];
  renderCards();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Modal helpers ─────────────────────────────────────────────────────────
function getField(id) { return document.getElementById(id); }

function openModal(venue = null) {
  venueForm.reset();
  getField('fieldId').value = '';
  btnDelete.style.display = 'none';

  if (venue) {
    modalTitle.textContent = 'Modifica locale';
    btnDelete.style.display = 'inline-flex';
    getField('fieldId').value          = venue.id;
    getField('fieldNome').value        = venue.nome || '';
    getField('fieldCitta').value       = venue.citta || '';
    getField('fieldDistanza').value    = venue.distanza_km ?? '';
    getField('fieldOltre').checked     = !!venue.oltre_20km;
    getField('fieldTipo').value        = venue.tipo || 'altro';
    getField('fieldGruppo').value      = venue.gruppo_proposto || 'da_decidere';
    getField('fieldCanale').value      = venue.canale || 'instagram';
    getField('fieldContatto').value    = venue.contatto || '';
    getField('fieldStato').value       = venue.stato || 'da_contattare';
    getField('fieldDataContatto').value = venue.data_ultimo_contatto || '';
    getField('fieldNote').value        = venue.note || '';
    getField('fieldLink').value        = venue.link_profilo || '';
  } else {
    modalTitle.textContent = 'Nuovo locale';
  }

  overlay.classList.add('open');
  if (!venue) setTimeout(() => getField('fieldNome').focus(), 50);
}

function closeModal() {
  overlay.classList.remove('open');
}

// ── Save ──────────────────────────────────────────────────────────────────
venueForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnSave.disabled = true;
  btnSave.textContent = 'Salvataggio…';

  const id = getField('fieldId').value;
  const distRaw = getField('fieldDistanza').value;

  const payload = {
    nome:                 getField('fieldNome').value.trim(),
    citta:                getField('fieldCitta').value.trim(),
    distanza_km:          distRaw !== '' ? parseInt(distRaw, 10) : null,
    oltre_20km:           getField('fieldOltre').checked,
    tipo:                 getField('fieldTipo').value,
    gruppo_proposto:      getField('fieldGruppo').value,
    canale:               getField('fieldCanale').value,
    contatto:             getField('fieldContatto').value.trim() || null,
    stato:                getField('fieldStato').value,
    data_ultimo_contatto: getField('fieldDataContatto').value || null,
    note:                 getField('fieldNote').value.trim() || null,
    link_profilo:         getField('fieldLink').value.trim() || null,
    updated_at:           new Date().toISOString(),
  };

  let error;
  if (id) {
    ({ error } = await sb.from(TABLE).update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from(TABLE).insert(payload));
  }

  btnSave.disabled = false;
  btnSave.textContent = 'Salva';

  if (error) { showToast('Errore: ' + error.message, 'error'); return; }

  showToast(id ? 'Locale aggiornato.' : 'Locale aggiunto.');
  closeModal();
  await loadVenues();
});

// ── Delete ────────────────────────────────────────────────────────────────
btnDelete.addEventListener('click', async () => {
  const id = getField('fieldId').value;
  if (!id) return;
  if (!confirm('Eliminare questo locale? L\'operazione non è reversibile.')) return;

  const { error } = await sb.from(TABLE).delete().eq('id', id);
  if (error) { showToast('Errore eliminazione: ' + error.message, 'error'); return; }

  showToast('Locale eliminato.');
  closeModal();
  await loadVenues();
});

// ── Realtime (optional) ───────────────────────────────────────────────────
sb.channel('crm-venues')
  .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => loadVenues())
  .subscribe();

// ── Events ────────────────────────────────────────────────────────────────
btnAdd.addEventListener('click', () => openModal());
fab.addEventListener('click', () => openModal());
btnCancel.addEventListener('click', closeModal);
btnClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

cardList.addEventListener('click', (e) => {
  // Let links (e.g. profilo) work without opening the editor
  if (e.target.closest('[data-stop]')) return;
  const card = e.target.closest('.card');
  if (!card) return;
  const venue = allVenues.find(v => v.id === card.dataset.id);
  if (venue) openModal(venue);
});

[searchInput, filterStato, filterTipo, filterGruppo, filterOltre].forEach(el => {
  el.addEventListener('input', renderCards);
});

btnExportPdf.addEventListener('click', exportPdf);

// ── Auto-tick oltre_20km ──────────────────────────────────────────────────
getField('fieldDistanza').addEventListener('input', (e) => {
  const km = parseInt(e.target.value, 10);
  if (!isNaN(km)) getField('fieldOltre').checked = km > 20;
});

// ── Follow-up reminder ────────────────────────────────────────────────────
const reminderBanner  = document.getElementById('reminderBanner');
const reminderTitle   = document.getElementById('reminderTitle');
const reminderList    = document.getElementById('reminderList');
const reminderToggle  = document.getElementById('reminderToggle');

const FOLLOWUP_DAYS = 5;

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86_400_000);
}

async function checkFollowups() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FOLLOWUP_DAYS);
  const iso = cutoff.toISOString().slice(0, 10);

  const { data } = await sb.from(TABLE)
    .select('id, nome, citta, data_ultimo_contatto')
    .eq('stato', 'contattato')
    .lte('data_ultimo_contatto', iso)
    .order('data_ultimo_contatto', { ascending: true });

  const overdue = data || [];

  if (!overdue.length) {
    reminderBanner.style.display = 'none';
    return;
  }

  const n = overdue.length;
  reminderTitle.textContent = `${n} locale${n > 1 ? 'i' : ''} senza risposta da oltre ${FOLLOWUP_DAYS} giorni`;

  reminderList.innerHTML = overdue.map(v => {
    const days = daysSince(v.data_ultimo_contatto);
    const daysLabel = days === Infinity ? 'mai contattato' : `${days} giorni fa`;
    return `<li class="reminder-item" data-id="${v.id}">
      <span class="reminder-item-name">${esc(v.nome)}${v.citta ? ` · ${esc(v.citta)}` : ''}</span>
      <span class="reminder-item-days">${daysLabel}</span>
    </li>`;
  }).join('');

  reminderBanner.style.display = 'block';
}

reminderToggle.addEventListener('click', () => {
  reminderBanner.classList.toggle('collapsed');
});

reminderList.addEventListener('click', (e) => {
  const item = e.target.closest('.reminder-item');
  if (!item) return;
  const venue = allVenues.find(v => v.id === item.dataset.id);
  if (venue) openModal(venue);
});

// ── Boot ──────────────────────────────────────────────────────────────────
loadVenues();
checkFollowups();
setInterval(checkFollowups, 30 * 60 * 1000); // ogni 30 min
