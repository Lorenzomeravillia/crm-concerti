/* global supabase, CRM_CONFIG */

// ── Init ──────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(
  window.CRM_CONFIG.SUPABASE_URL,
  window.CRM_CONFIG.SUPABASE_KEY,
  { db: { schema: 'crm' } }
);

const TABLE = 'venues';

// ── State ─────────────────────────────────────────────────────────────────
let allVenues = [];

// ── DOM refs ──────────────────────────────────────────────────────────────
const tableBody     = document.getElementById('tableBody');
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
const btnCancel     = document.getElementById('btnCancel');
const btnDelete     = document.getElementById('btnDelete');
const btnSave       = document.getElementById('btnSave');
const toast         = document.getElementById('toast');

// ── Helpers ───────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.className = ''; }, 3000);
}

function badge(value, prefix = '') {
  if (!value) return '';
  const cls = prefix ? `badge-${prefix}_${value}` : `badge-${value}`;
  const label = value.replace(/_/g, ' ');
  return `<span class="badge ${cls}">${label}</span>`;
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
  statsBar.innerHTML = `<div class="stat-chip">Totale <strong>${venues.length}</strong></div>` +
    order.filter(s => byStato[s]).map(s =>
      `<div class="stat-chip">${labels[s]} <strong>${byStato[s]}</strong></div>`
    ).join('');
}

function renderTable() {
  const rows = applyFilters();
  renderStats(rows);

  if (!rows.length) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="10">Nessun locale trovato.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map(v => `
    <tr data-id="${v.id}">
      <td class="nome">
        ${v.link_profilo
          ? `<a class="link" href="${v.link_profilo}" target="_blank" rel="noopener">${v.nome}</a>`
          : v.nome}
      </td>
      <td>${v.citta}</td>
      <td>${v.distanza_km != null ? v.distanza_km + ' km' : ''}</td>
      <td>${badge(v.tipo)}</td>
      <td>${badge(v.gruppo_proposto)}</td>
      <td>${v.canale || ''}</td>
      <td>${badge(v.stato)}</td>
      <td>${fmtDate(v.data_ultimo_contatto)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.note || ''}">${v.note || ''}</td>
      <td><button class="btn btn-ghost btn-sm" data-edit="${v.id}">Modifica</button></td>
    </tr>
  `).join('');
}

// ── Load data ─────────────────────────────────────────────────────────────
async function loadVenues() {
  tableBody.innerHTML = `<tr class="empty-row"><td colspan="10"><span class="loader"></span> Caricamento…</td></tr>`;
  const { data, error } = await sb.from(TABLE).select('*').order('nome');
  if (error) { showToast('Errore caricamento: ' + error.message, 'error'); return; }
  allVenues = data || [];
  renderTable();
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
  getField('fieldNome').focus();
}

function closeModal() { overlay.classList.remove('open'); }

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
  .on('postgres_changes', { event: '*', schema: 'crm', table: TABLE }, () => loadVenues())
  .subscribe();

// ── Events ────────────────────────────────────────────────────────────────
btnAdd.addEventListener('click', () => openModal());
btnCancel.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

tableBody.addEventListener('click', (e) => {
  const id = e.target.dataset.edit;
  if (!id) return;
  const venue = allVenues.find(v => v.id === id);
  if (venue) openModal(venue);
});

[searchInput, filterStato, filterTipo, filterGruppo, filterOltre].forEach(el => {
  el.addEventListener('input', renderTable);
});

// ── Auto-tick oltre_20km ──────────────────────────────────────────────────
getField('fieldDistanza').addEventListener('input', (e) => {
  const km = parseInt(e.target.value, 10);
  if (!isNaN(km)) getField('fieldOltre').checked = km > 20;
});

// ── Boot ──────────────────────────────────────────────────────────────────
loadVenues();
