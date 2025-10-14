import { state, setState, subscribe, updateArray } from '../core/state.js';
import { api } from '../core/api.js';
import { BUSINESS_ID } from '../config/endpoints.js';
import { showLoader, hideLoader, withButtonLoader } from '../utils/loader.js';

let unsub = null;
let initialized = false;

// Local storage for recently created tickets (temporary cache)
const LOCAL_TICKETS_KEY = 'velit_recent_tickets';
const LOCAL_TICKETS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function readLocalTickets(){
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(arr)) return [];
    const now = Date.now();
    // prune expired
    const fresh = arr.filter(t => typeof t === 'object' && t && (now - (t.createdAt||0)) <= LOCAL_TICKETS_TTL_MS);
    if(fresh.length !== arr.length){ localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(fresh)); }
    return fresh.map(normalizeTicket).filter(Boolean);
  } catch { return []; }
}

function writeLocalTickets(list){
  try {
    const serializable = (list||[]).map(t => ({
      id: t.id, status: t.status, priority: t.priority, title: t.title || '',
      Name: t.customer || t.name || '', Email: t.email || '',
      Order_no: t.orderNo || '', Shipping_no: t.shippingNo || '',
      createdAt: t.createdAt || Date.now(), updatedAt: t.updatedAt || t.createdAt || Date.now()
    }));
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(serializable));
  } catch {/* no-op */}
}

function addLocalTicket(ticket){
  const cur = readLocalTickets();
  const next = [ticket, ...cur.filter(t => (t.id||'') !== (ticket.id||''))];
  writeLocalTickets(next);
}

function removeLocalTicketById(id){
  const cur = readLocalTickets();
  writeLocalTickets(cur.filter(t => (t.id||'') !== (id||'')));
}

function mergeWithLocalTickets(serverList){
  const locals = readLocalTickets();
  const server = (serverList||[]).map(normalizeTicket).filter(Boolean);

  const serverIds = new Set(server.map(t => String(t.id||'')));
  const onlyLocal = locals.filter(t => !serverIds.has(String(t.id||'')));

  const isStrictId = (id)=> /^VEL-\d{6}$/.test(String(id||''));
  const hasLocalEquivalent = (s)=> locals.some(l => {
    const emailMatch = (l.email||'').toLowerCase() && (s.email||'').toLowerCase() && (l.email||'').toLowerCase() === (s.email||'').toLowerCase();
    const orderMatch = l.orderNo && s.orderNo && String(l.orderNo) === String(s.orderNo);
    const shipMatch = l.shippingNo && s.shippingNo && String(l.shippingNo) === String(s.shippingNo);
    const nameMatch = (l.customer||l.name||'').toLowerCase() && (s.customer||s.name||'').toLowerCase() && (l.customer||l.name||'').toLowerCase() === (s.customer||s.name||'').toLowerCase();
    return emailMatch && (orderMatch || shipMatch || nameMatch);
  });
  // Drop server pseudo IDs when we have a matching local ticket within TTL
  const acceptedServer = server.filter(s => isStrictId(s.id) || !hasLocalEquivalent(s));

  // Persist pruned locals only (optional normalization of cache)
  if(onlyLocal.length !== locals.length){ writeLocalTickets(onlyLocal); }

  const merged = [...onlyLocal, ...acceptedServer];
  merged.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  return merged;
}

// Helpers to detect id shapes
function isStrictVelId(id){ return /^VEL-\d{6}$/.test(String(id||'')); }
function isPseudoId(id){ return /^T-/.test(String(id||'')); }

function ensureSubscribed(){
  if(unsub) return;
  unsub = subscribe((s)=>{
    if(s.currentView === 'tickets'){
      renderTicketsList();
      renderTicketsStats();
      renderTicketDetail(s.selectedTicket);
    }
  });
}

export async function initTicketsView(){
  ensureSubscribed();
  await loadTickets();
  attachTicketsHandlers();
  renderTicketsStats();
  renderTicketsList();
}

export async function loadTickets(){
  if(initialized) return;
  try {
    const data = await api.fetchTickets();
    // Support Firestore list shape { documents: [...] } or single object
    const arr = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.documents))
        ? data.documents.map(d => ({ document: d }))
        : (data ? [data] : []);
  const list = arr.map(normalizeTicket).filter(Boolean);
  setState({ tickets: list });
  // If server returned no tickets, clear any local cached tickets to avoid showing phantom items
  if(!list.length){ writeLocalTickets([]); }
  } catch (e){
    console.error('Failed to fetch tickets', e);
  } finally {
    initialized = true;
  }
}

function normalizeTicket(t){
  if(!t || typeof t !== 'object') return null;
  // Unwrap Firestore document shape if present
  if(t.document && t.document.fields){
    const doc = t.document;
    const f = doc.fields || {};
    const val = (node)=>{
      if(!node || typeof node !== 'object') return undefined;
      if('stringValue' in node) return node.stringValue;
      if('integerValue' in node) return String(node.integerValue);
      if('doubleValue' in node) return String(node.doubleValue);
      if('booleanValue' in node) return node.booleanValue;
      if('timestampValue' in node){
        try { return new Date(node.timestampValue).getTime(); } catch { return Date.now(); }
      }
      if('nullValue' in node) return null;
      return undefined;
    };
    const createdAt = doc.createTime ? Date.parse(doc.createTime) : undefined;
    const updatedAt = doc.updateTime ? Date.parse(doc.updateTime) : undefined;
    // Build a flat object using expected keys
    const flat = {
      Name: val(f.Name),
      Email: val(f.Email),
      Ticket_id: val(f.Ticket_id),
      Order_no: val(f.Order_no),
      Shipping_no: val(f.Shipping_no),
      timestamp: val(f.timestamp),
      createdAt, updatedAt
    };
    // Remap for common handling below
    t = {
      ...t,
      id: flat.Ticket_id,
      name: flat.Name,
      email: flat.Email,
      orderNo: flat.Order_no,
      shippingNo: flat.Shipping_no,
      createdAt: flat.timestamp || flat.createdAt || Date.now(),
      updatedAt: flat.timestamp || flat.updatedAt || Date.now()
    };
  }
  // Expected fields from webhook can vary; map flexibly
  const normalizedId = t.id || t.ticketId || t.TicketId || t.Ticket_id || t.number || '';
  return {
    id: normalizedId,
    status: (t.status || t.Status || 'open').toString().trim().toLowerCase(),
    priority: (t.priority || t.Priority || 'normal').toString().trim().toLowerCase(),
    title: t.title || t.subject || t.Subject || '',
    customer: t.customer || t.name || t.Name || t.Customer || '',
    email: t.email || t.Email || '',
    createdAt: t.createdAt || t.Created || t.Time || Date.now(),
    updatedAt: t.updatedAt || t.Updated || t.lastUpdated || Date.now(),
    conversation: Array.isArray(t.conversation) ? t.conversation : [],
    internalNotes: t.internalNotes || t.notes || '',
    orderNo: t.orderNo || t.Order_no || t.order || undefined,
    shippingNo: t.shippingNo || t.Shipping_no || t.trackingNumber || undefined,
    linked: {
      tickets: t.linkedTickets || [],
      orders: t.linkedOrders || (t.Order_no ? [t.Order_no] : []),
      shipments: t.linkedShipments || (t.Shipping_no ? [t.Shipping_no] : []),
      conversations: t.linkedConversations || []
    }
  };
}

function labelize(s=''){
  return s.replace(/_/g,' ').replace(/\b\w/g, m=> m.toUpperCase());
}

function formatDate(ts){
  try { const d=new Date(ts); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});} catch { return ''; }
}

export function attachTicketsHandlers(){
  const createBtn = document.getElementById('create-ticket');
  if(createBtn){
    createBtn.addEventListener('click', ()=> openCreateTicketModal());
  }
  document.addEventListener('click', (e)=>{
    const item = e.target.closest('.ticket-item');
    if(item && item.dataset.ticketId){
      const ticket = state.tickets.find(t=> t.id===item.dataset.ticketId);
      if(ticket) setState({ selectedTicket: ticket });
    }
  });
}

function ticketsCounts(){
  const counts = state.tickets.reduce((acc,t)=>{ acc.total=(acc.total||0)+1; acc[t.status]=(acc[t.status]||0)+1; return acc; },{ total: 0});
  return counts;
}

export function renderTicketsStats(){
  const host = document.getElementById('tickets-stats');
  if(!host) return;
  const c = ticketsCounts();
  host.innerHTML = `
    <div class="stat-card open"><span class="label">Open</span><span class="value">${c.open||0}</span></div>
    <div class="stat-card closed"><span class="label">Closed</span><span class="value">${c.closed||0}</span></div>
    <div class="stat-card total"><span class="label">Total</span><span class="value">${c.total||0}</span></div>
  `;
}

export function renderTicketsList(){
  const host = document.getElementById('tickets-list');
  if(!host) return;
  const list = [...state.tickets].sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
  if(!list.length){ host.innerHTML = '<p class="empty">No tickets found.</p>'; return; }
  host.innerHTML = list.map(t=> ticketRow(t)).join('');
}

function ticketRow(t){
  return `<div class="ticket-item" data-ticket-id="${escapeHtml(t.id)}">
    <div class="ti-main">
      <div class="ti-title"><strong>${escapeHtml(t.id)}</strong> — ${escapeHtml(t.title||'')}</div>
      <div class="ti-meta"><span class="badge ${t.status}">${escapeHtml(labelize(t.status))}</span> • Updated ${escapeHtml(formatDate(t.updatedAt))}</div>
    </div>
  </div>`;
}

function escapeHtml(str){ if(str==null) return ''; return String(str).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

export function renderTicketDetail(ticket){
  const host = document.getElementById('ticket-detail');
  if(!host) return;
  if(!ticket){
    host.innerHTML = `<div class="detail-placeholder"><i class="fas fa-ticket"></i><p>Select a ticket to view details</p></div>`;
    return;
  }
  const conv = ticket.conversation || [];
  const notes = ticket.internalNotes || '';
  const linked = computeLinked(ticket);
  host.innerHTML = `
    <div class="ticket-detail-shell">
      <div class="ticket-header">
        <div class="th-left">
          <h3>${escapeHtml(ticket.id)}</h3>
          <div class="th-tags">
            <span class="badge ${ticket.status}">${escapeHtml(labelize(ticket.status))}</span>
            <span class="badge ${ticket.priority}">${escapeHtml(labelize(ticket.priority))}</span>
          </div>
          <div class="th-sub">Created: ${escapeHtml(formatDate(ticket.createdAt))} • Updated: ${escapeHtml(formatDate(ticket.updatedAt))}</div>
        </div>
        <div class="th-right">
          <div class="th-customer"><strong>${escapeHtml(ticket.customer||'')}</strong><br><span class="email">${escapeHtml(ticket.email||'')}</span></div>
        </div>
      </div>
      <div class="ticket-body">
        <div class="ticket-linked">
          <h4>Linked</h4>
          <div class="linked-sections">
            <div class="linked-block">
              <div class="linked-title">Order</div>
              ${linked.orders.length ? linked.orders.map(o=> orderCard(o)).join('') : '<div class="empty">No linked order</div>'}
            </div>
            <div class="linked-block">
              <div class="linked-title">Shipment</div>
              ${linked.shipments.length ? linked.shipments.map(s=> shipmentCard(s)).join('') : '<div class="empty">No linked shipment</div>'}
            </div>
          </div>
        </div>
        <div class="ticket-conversation">
          <h4>Conversation</h4>
          ${conv.length ? conv.map(msg=> ticketMessage(msg)).join('') : '<div class="empty">No messages</div>'}
        </div>
        <div class="ticket-notes">
          <h4>Internal Notes</h4>
          <div class="note-card">${escapeHtml(notes)}</div>
        </div>
      </div>
    </div>
  `;
}

function computeLinked(ticket){
  const orderIds = new Set([
    ...(Array.isArray(ticket.linked?.orders) ? ticket.linked.orders : []),
    ticket.orderNo
  ].filter(Boolean).map(x=> String(x)));
  const shipIds = new Set([
    ...(Array.isArray(ticket.linked?.shipments) ? ticket.linked.shipments : []),
    ticket.shippingNo
  ].filter(Boolean).map(x=> String(x)));

  const orders = (state.orders||[]).filter(o=> orderIds.has(String(o.id)));
  const shipments = (state.shippingRequests||[]).filter(r=> shipIds.has(String(r.trackingNumber||r.id)));
  return { orders, shipments };
}

function orderCard(o){
  const created = o.createdAt ? `Created: ${escapeHtml(formatDate(o.createdAt))}` : '';
  return `<div class="linked-card order-card">
    <div class="lc-header">
      <div class="lc-title"><i class="fas fa-receipt"></i> Order #${escapeHtml(String(o.id))}</div>
      ${created ? `<div class="lc-meta">${created}</div>`:''}
    </div>
    <div class="lc-body">
      <div class="lc-row"><span class="k">Name</span><span class="v">${escapeHtml(o.name||'')}</span></div>
      <div class="lc-row"><span class="k">Email</span><span class="v">${escapeHtml(o.email||'')}</span></div>
    </div>
  </div>`;
}

function shipmentCard(s){
  const created = s.createdAt ? `Created: ${escapeHtml(formatDate(s.createdAt))}` : '';
  const track = String(s.trackingNumber||s.id||'');
  return `<div class="linked-card ship-card">
    <div class="lc-header">
      <div class="lc-title"><i class="fas fa-truck"></i> Shipment #${escapeHtml(track)}</div>
      <div class="lc-tags">
        <span class="badge ${escapeHtml(s.status||'')}">${escapeHtml(labelize(s.status||''))}</span>
      </div>
    </div>
    <div class="lc-body">
      <div class="lc-row"><span class="k">Request ID</span><span class="v">${escapeHtml(s.requestId||'')}</span></div>
      ${s.product ? `<div class="lc-row"><span class="k">Product</span><span class="v">${escapeHtml(s.product)}</span></div>`:''}
      ${created ? `<div class="lc-row"><span class="k">${created}</span></div>`:''}
      ${s.url ? `<div class="lc-row"><span class="k">Label</span><span class="v"><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">Download</a></span></div>`:''}
      ${s.Note ? `<div class="lc-note">${escapeHtml(s.Note)}</div>`:''}
    </div>
  </div>`;
}

function ticketMessage(m){
  const who = m.author || m.sender || 'User';
  const when = m.time || m.timestamp || '';
  const text = m.text || m.message || '';
  return `<div class="ticket-msg">
    <div class="tm-head"><strong>${escapeHtml(who)}</strong> <span class="tm-time">${escapeHtml(when)}</span></div>
    <div class="tm-body">${escapeHtml(text)}</div>
  </div>`;
}

// ===== Create Ticket Modal =====
function ensureCreateTicketModal(){
  if(document.getElementById('create-ticket-modal')) return;
  const html = `
    <div id="create-ticket-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:620px;">
        <div class="modal-header">
          <h3>Create Ticket</h3>
          <button class="modal-close" onclick="closeCreateTicketModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Email</label>
            <div class="search-dropdown">
              <input id="ct-email" class="form-control" placeholder="Select or type email" />
              <ul id="ct-email-results" class="search-results" style="display:none;"></ul>
            </div>
          </div>
          <div class="form-group">
            <label>Name</label>
            <div class="search-dropdown">
              <input id="ct-name" class="form-control" placeholder="Select or type name" />
              <ul id="ct-name-results" class="search-results" style="display:none;"></ul>
            </div>
          </div>
          <div class="form-group"><label>Phone</label><input id="ct-phone" class="form-control" placeholder="Optional phone" /></div>
          <div class="form-group"><label>Ticket ID</label><input id="ct-ticket-id" class="form-control" placeholder="Auto-generated" readonly /></div>
          <div class="form-row" style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1">
              <label>Status</label>
              <select id="ct-status" class="form-control" disabled>
                <option value="open" selected>Open</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label>Priority</label>
              <select id="ct-priority" class="form-control">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div class="form-row" style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1"><label>Category</label><input id="ct-category" class="form-control" placeholder="e.g. Support" /></div>
            <div class="form-group" style="flex:1">
              <label>Source Channel</label>
              <select id="ct-source" class="form-control">
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="phone">Phone</option>
                <option value="web">Web</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Linked Orders</label>
            <div class="search-dropdown">
              <input id="ct-order-search" class="form-control" placeholder="Search orders... (filtered by email)" />
              <ul id="ct-order-results" class="search-results" style="display:none;"></ul>
            </div>
            <div id="ct-order-selected" class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
          </div>
          <div class="form-group">
            <label>Linked Shipments</label>
            <div class="search-dropdown">
              <input id="ct-ship-search" class="form-control" placeholder="Search shipping requests... (filtered by email)" />
              <ul id="ct-ship-results" class="search-results" style="display:none;"></ul>
            </div>
            <div id="ct-ship-selected" class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
          </div>
          <div class="form-group">
            <label>Linked Conversations</label>
            <div class="search-dropdown">
              <input id="ct-conv-search" class="form-control" placeholder="Search conversations... (filtered by email)" />
              <ul id="ct-conv-results" class="search-results" style="display:none;"></ul>
            </div>
            <div id="ct-conv-selected" class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
          </div>
          <div class="form-group">
            <label>Linked Tickets</label>
            <div class="search-dropdown">
              <input id="ct-tick-search" class="form-control" placeholder="Search tickets... (filtered by email)" />
              <ul id="ct-tick-results" class="search-results" style="display:none;"></ul>
            </div>
            <div id="ct-tick-selected" class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeCreateTicketModal()">Cancel</button>
          <button id="ct-submit" class="btn-primary">Create</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // wire submit
  document.getElementById('ct-submit')?.addEventListener('click', onSubmitCreateTicket);

  // wire search inputs
  wireEmailDropdown();
  wireNameDropdown();
  wireOrderMulti();
  wireShipMulti();
  wireConvMulti();
  wireTicketMulti();
}

export function openCreateTicketModal(){
  ensureCreateTicketModal();
  const modal = document.getElementById('create-ticket-modal');
  if(modal){
    // Set default Ticket ID as max existing + 1 (preserve prefix/padding if possible)
    const nextId = computeNextTicketId();
    const idInput = document.getElementById('ct-ticket-id');
    if(idInput) idInput.value = nextId;
    modal.style.display='flex';
  }
}

window.closeCreateTicketModal = function(){
  const modal = document.getElementById('create-ticket-modal');
  if(modal){ modal.style.display='none'; }
};

let selectedOrderIds = [];
let selectedShipmentIds = [];
let selectedConversationIds = [];
let selectedTicketIds = [];
let selectedName = '';
let selectedEmail = '';

function addChip(containerId, idVal, onRemove){
  const wrap = document.getElementById(containerId); if(!wrap) return;
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#eef6f4;border:1px solid #cfe2dc;color:#194b3b;padding:4px 8px;border-radius:999px;font-size:.78rem;';
  chip.innerHTML = `${escapeHtml(String(idVal))} <button aria-label="Remove" style="border:none;background:transparent;color:#194b3b;cursor:pointer;font-weight:700">×</button>`;
  const btn = chip.querySelector('button');
  btn.addEventListener('click', ()=>{ chip.remove(); onRemove?.(); });
  wrap.appendChild(chip);
}

function wireOrderMulti(){
  const input = document.getElementById('ct-order-search');
  const listEl = document.getElementById('ct-order-results');
  if(!input || !listEl) return;
  const makeItems = (term)=>{
    const termL = term.toLowerCase();
    let base = (state.orders||[]);
    if(selectedEmail){ base = base.filter(o=> (o.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
    const items = base.filter(o=>{
      const hay = [o.id,o.name,o.email,o.phone,o.address?.line1,o.address?.city,o.address?.state,o.address?.zip].join(' ').toLowerCase();
      return hay.includes(termL);
    }).slice(0,10);
    listEl.innerHTML = items.map(o=> `<li data-val="${escapeHtml(String(o.id))}"><strong>${escapeHtml(String(o.id))}</strong> — ${escapeHtml(o.name||'')} <span class="muted">${escapeHtml(o.email||'')}</span></li>`).join('');
    if(items.length){ listEl.style.display = 'block'; } else { listEl.style.display = 'none'; }
  };
  // toggle open on click; render recent on first open
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      let recent = [...(state.orders||[])];
      if(selectedEmail){ recent = recent.filter(o=> (o.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
      recent = recent.slice(-10).reverse();
      listEl.innerHTML = recent.map(o=> `<li data-val="${escapeHtml(String(o.id))}"><strong>${escapeHtml(String(o.id))}</strong> — ${escapeHtml(o.name||'')} <span class="muted">${escapeHtml(o.email||'')}</span></li>`).join('');
      listEl.style.display = recent.length ? 'block' : 'none';
    } else {
      listEl.style.display = 'none';
    }
  });
  // filter as user types
  input.addEventListener('input', ()=>{
    if(listEl.style.display !== 'block'){ listEl.style.display = 'block'; }
    makeItems(input.value);
  });
  listEl.addEventListener('click', (e)=>{
    const li = e.target.closest('li');
    if(!li) return;
    const chosen = li.dataset.val || '';
    if(chosen && !selectedOrderIds.includes(chosen)){
      selectedOrderIds.push(chosen);
      addChip('ct-order-selected', chosen, ()=>{
        selectedOrderIds = selectedOrderIds.filter(x=> x!==chosen);
      });
    }
    input.value = '';
    listEl.style.display = 'none';
  });
  // click outside to close
  document.addEventListener('click', (ev)=>{
    if(!ev.target.closest('.search-dropdown')){ listEl.style.display = 'none'; }
  });
}

function wireShipMulti(){
  const input = document.getElementById('ct-ship-search');
  const listEl = document.getElementById('ct-ship-results');
  if(!input || !listEl) return;
  const makeItems = (term)=>{
    const termL = term.toLowerCase();
    let base = (state.shippingRequests||[]);
    if(selectedEmail){ base = base.filter(r=> (r.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
    const items = base.filter(r=>{
      const hay = [r.id,r.trackingNumber,r.orderId,r.email,r.name,r.status,r.product].join(' ').toLowerCase();
      return hay.includes(termL);
    }).slice(0,10);
    listEl.innerHTML = items.map(r=> `<li data-val="${escapeHtml(String(r.trackingNumber||r.id||''))}"><strong>${escapeHtml(String(r.trackingNumber||r.id||''))}</strong> — ${escapeHtml(r.status||'')} <span class="muted">${escapeHtml(r.email||'')}</span></li>`).join('');
    if(items.length){ listEl.style.display = 'block'; } else { listEl.style.display = 'none'; }
  };
  // toggle open on click; render recent on first open
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      let recent = [...(state.shippingRequests||[])];
      if(selectedEmail){ recent = recent.filter(r=> (r.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
      recent = recent.slice(-10).reverse();
      listEl.innerHTML = recent.map(r=> `<li data-val="${escapeHtml(String(r.trackingNumber||r.id||''))}"><strong>${escapeHtml(String(r.trackingNumber||r.id||''))}</strong> — ${escapeHtml(r.status||'')} <span class="muted">${escapeHtml(r.email||'')}</span></li>`).join('');
      listEl.style.display = recent.length ? 'block' : 'none';
    } else {
      listEl.style.display = 'none';
    }
  });
  // filter as user types
  input.addEventListener('input', ()=>{
    if(listEl.style.display !== 'block'){ listEl.style.display = 'block'; }
    makeItems(input.value);
  });
  listEl.addEventListener('click', (e)=>{
    const li = e.target.closest('li');
    if(!li) return;
    const chosen = li.dataset.val || '';
    if(chosen && !selectedShipmentIds.includes(chosen)){
      selectedShipmentIds.push(chosen);
      addChip('ct-ship-selected', chosen, ()=>{
        selectedShipmentIds = selectedShipmentIds.filter(x=> x!==chosen);
      });
    }
    input.value = '';
    listEl.style.display = 'none';
  });
  // click outside to close
  document.addEventListener('click', (ev)=>{
    if(!ev.target.closest('.search-dropdown')){ listEl.style.display = 'none'; }
  });
}

function wireConvMulti(){
  const input = document.getElementById('ct-conv-search');
  const listEl = document.getElementById('ct-conv-results');
  if(!input || !listEl) return;
  const makeItems = (term)=>{
    const termL = term.toLowerCase();
    let base = (state.emailConversations||[]);
    if(selectedEmail){ base = base.filter(c=> (c.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
    const items = base.filter(c=>{
      const hay = [c.id,c.conversation_id,c.threadId,c.email,c.name].join(' ').toLowerCase();
      return hay.includes(termL);
    }).slice(0,10);
    listEl.innerHTML = items.map(c=> {
      const id = c.id || c.conversation_id || c.threadId || c.email;
      return `<li data-val="${escapeHtml(String(id))}"><strong>${escapeHtml(String(id))}</strong> — ${escapeHtml(c.name||'')} <span class="muted">${escapeHtml(c.email||'')}</span></li>`;
    }).join('');
    listEl.style.display = items.length ? 'block' : 'none';
  };
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      let recent = [...(state.emailConversations||[])];
      if(selectedEmail){ recent = recent.filter(c=> (c.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
      recent = recent.slice(-10).reverse();
      listEl.innerHTML = recent.map(c=> {
        const id = c.id || c.conversation_id || c.threadId || c.email;
        return `<li data-val="${escapeHtml(String(id))}"><strong>${escapeHtml(String(id))}</strong> — ${escapeHtml(c.name||'')} <span class="muted">${escapeHtml(c.email||'')}</span></li>`;
      }).join('');
      listEl.style.display = recent.length ? 'block' : 'none';
    } else { listEl.style.display = 'none'; }
  });
  input.addEventListener('input', ()=>{ if(listEl.style.display !== 'block') listEl.style.display='block'; makeItems(input.value); });
  listEl.addEventListener('click', (e)=>{
    const li = e.target.closest('li'); if(!li) return;
    const chosen = li.dataset.val || '';
    if(chosen && !selectedConversationIds.includes(chosen)){
      selectedConversationIds.push(chosen);
      addChip('ct-conv-selected', chosen, ()=>{ selectedConversationIds = selectedConversationIds.filter(x=> x!==chosen); });
    }
    input.value = '';
    listEl.style.display = 'none';
  });
  document.addEventListener('click', (ev)=>{ if(!ev.target.closest('.search-dropdown')) listEl.style.display = 'none'; });
}

function wireTicketMulti(){
  const input = document.getElementById('ct-tick-search');
  const listEl = document.getElementById('ct-tick-results');
  if(!input || !listEl) return;
  const makeItems = (term)=>{
    const termL = term.toLowerCase();
    let base = (state.tickets||[]);
    if(selectedEmail){ base = base.filter(t=> (t.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
    const items = base.filter(t=>{
      const hay = [t.id,t.customer,t.email,t.orderNo,t.shippingNo,t.status,t.priority].join(' ').toLowerCase();
      return hay.includes(termL);
    }).slice(0,10);
    listEl.innerHTML = items.map(t=> `<li data-val="${escapeHtml(String(t.id))}"><strong>${escapeHtml(String(t.id))}</strong> — ${escapeHtml(t.customer||'')} <span class="muted">${escapeHtml(t.email||'')}</span></li>`).join('');
    listEl.style.display = items.length ? 'block' : 'none';
  };
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      let recent = [...(state.tickets||[])];
      if(selectedEmail){ recent = recent.filter(t=> (t.email||'').toLowerCase() === selectedEmail.toLowerCase()); }
      recent = recent.slice(-10).reverse();
      listEl.innerHTML = recent.map(t=> `<li data-val="${escapeHtml(String(t.id))}"><strong>${escapeHtml(String(t.id))}</strong> — ${escapeHtml(t.customer||'')} <span class="muted">${escapeHtml(t.email||'')}</span></li>`).join('');
      listEl.style.display = recent.length ? 'block' : 'none';
    } else { listEl.style.display = 'none'; }
  });
  input.addEventListener('input', ()=>{ if(listEl.style.display !== 'block') listEl.style.display='block'; makeItems(input.value); });
  listEl.addEventListener('click', (e)=>{
    const li = e.target.closest('li'); if(!li) return;
    const chosen = li.dataset.val || '';
    if(chosen && !selectedTicketIds.includes(chosen)){
      selectedTicketIds.push(chosen);
      addChip('ct-tick-selected', chosen, ()=>{ selectedTicketIds = selectedTicketIds.filter(x=> x!==chosen); });
    }
    input.value = '';
    listEl.style.display = 'none';
  });
  document.addEventListener('click', (ev)=>{ if(!ev.target.closest('.search-dropdown')) listEl.style.display = 'none'; });
}

function wireNameDropdown(){
  const input = document.getElementById('ct-name');
  const listEl = document.getElementById('ct-name-results');
  if(!input || !listEl) return;

  const unique = new Map();
  (state.emailConversations||[]).forEach(c=>{
    const n = c.name || '';
    const e = c.email || '';
    if(n){ unique.set(n, e); }
  });
  const allItems = Array.from(unique.entries());
  const render = (term='')=>{
    const t = term.toLowerCase();
    const items = allItems.filter(([n,e])=> n.toLowerCase().includes(t) || (e||'').toLowerCase().includes(t)).slice(0,10);
    listEl.innerHTML = items.map(([n,e])=> `<li data-name="${escapeHtml(n)}" data-email="${escapeHtml(e)}"><strong>${escapeHtml(n)}</strong>${e?` <span class='muted'>${escapeHtml(e)}</span>`:''}</li>`).join('');
    listEl.style.display = items.length ? 'block' : 'none';
  };
  // toggle on click shows recent
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      render('');
    } else {
      listEl.style.display = 'none';
    }
  });
  // type-to-filter
  input.addEventListener('input', ()=>{ render(input.value); });
  listEl.addEventListener('click', (e)=>{
    const li = e.target.closest('li'); if(!li) return;
    selectedName = li.dataset.name || '';
    input.value = selectedName;
    // If email empty, auto-fill from pair
    const emailInput = document.getElementById('ct-email');
    const paired = li.dataset.email || '';
    if(emailInput && paired && !emailInput.value){ emailInput.value = paired; selectedEmail = paired; }
    // Refresh other dropdowns filtered by email
    document.getElementById('ct-order-results')?.style.setProperty('display','none');
    document.getElementById('ct-ship-results')?.style.setProperty('display','none');
    document.getElementById('ct-conv-results')?.style.setProperty('display','none');
    document.getElementById('ct-tick-results')?.style.setProperty('display','none');
    listEl.style.display = 'none';
  });
  // close on outside click
  document.addEventListener('click', (ev)=>{ if(!ev.target.closest('.search-dropdown')) listEl.style.display = 'none'; });
}

function wireEmailDropdown(){
  const input = document.getElementById('ct-email');
  const listEl = document.getElementById('ct-email-results');
  if(!input || !listEl) return;

  const allEmails = Array.from(new Set((state.emailConversations||[]).map(c=> c.email || '').filter(Boolean)));
  const render = (term='')=>{
    const t = term.toLowerCase();
    const items = allEmails.filter(e=> e.toLowerCase().includes(t)).slice(0,10);
    listEl.innerHTML = items.map(e=> `<li data-email="${escapeHtml(e)}">${escapeHtml(e)}</li>`).join('');
    listEl.style.display = items.length ? 'block' : 'none';
  };
  // toggle on click shows recent
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      render('');
    } else {
      listEl.style.display = 'none';
    }
  });
  // type-to-filter
  input.addEventListener('input', ()=>{ render(input.value); });
  listEl.addEventListener('click', (e)=>{
    const li = e.target.closest('li'); if(!li) return;
    selectedEmail = li.dataset.email || '';
    input.value = selectedEmail;
    // If name empty, try find a name by email
    const nameInput = document.getElementById('ct-name');
    if(nameInput && !nameInput.value){
      const match = (state.emailConversations||[]).find(c=> (c.email||'')===selectedEmail);
      if(match && match.name){ nameInput.value = match.name; selectedName = match.name; }
    }
    // Reset selections filtered by email context
    selectedOrderIds = [];
    selectedShipmentIds = [];
    selectedConversationIds = [];
    selectedTicketIds = [];
    document.getElementById('ct-order-selected')?.replaceChildren();
    document.getElementById('ct-ship-selected')?.replaceChildren();
    document.getElementById('ct-conv-selected')?.replaceChildren();
    document.getElementById('ct-tick-selected')?.replaceChildren();
    listEl.style.display = 'none';
  });
  // close on outside click
  document.addEventListener('click', (ev)=>{ if(!ev.target.closest('.search-dropdown')) listEl.style.display = 'none'; });
}

function computeNextTicketId(){
  // Strict format: VEL-000001, VEL-000002, ... always 6 digits
  const list = state.tickets || [];
  let maxNum = 0;
  for(const t of list){
    const id = String(t.id || t.Ticket_id || '');
    const m = id.match(/^VEL-(\d{6})$/);
    if(m){
      const num = parseInt(m[1], 10);
      if(Number.isFinite(num) && num > maxNum){ maxNum = num; }
    }
  }
  const next = (maxNum || 0) + 1;
  const numStr = String(next).padStart(6, '0');
  return `VEL-${numStr}`;
}

async function onSubmitCreateTicket(){
  const btn = document.getElementById('ct-submit');
  const name = (document.getElementById('ct-name')?.value||'').trim();
  const email = (document.getElementById('ct-email')?.value||'').trim();
  const phone = (document.getElementById('ct-phone')?.value||'').trim();
  const status = 'open';
  const priority = (document.getElementById('ct-priority')?.value||'normal').trim();
  const category = (document.getElementById('ct-category')?.value||'').trim();
  const sourceChannel = (document.getElementById('ct-source')?.value||'email').trim();
  // Always generate the next ticket ID in VEL-000001 format
  const idInput = document.getElementById('ct-ticket-id');
  const ticketId = computeNextTicketId();
  if(idInput){ idInput.value = ticketId; }
  const orderIds = [...selectedOrderIds];
  const shipIds = [...selectedShipmentIds];
  const convIds = [...selectedConversationIds];
  const tickIds = [...selectedTicketIds];

  if(!email || !ticketId){
    alert('Please fill Email (and Ticket ID will auto-generate).');
    return;
  }

  const payload = {
    business_id: BUSINESS_ID,
    Name: name,
    Email: email,
    Phone: phone,
    Ticket_id: ticketId,
    Status: status,
    Priority: priority,
    Category: category,
    SourceChannel: sourceChannel,
    // Send arrays of JSON objects for linked references as requested
    linkedOrders: orderIds.map(id=> ({ orderId: id })),
    linkedShipments: shipIds.map(id=> ({ shipmentId: id })),
    linkedConversations: convIds.map(id=> ({ conversationId: id })),
    linkedTickets: tickIds.map(id=> ({ ticketId: id }))
  };

  // Optimistically create a local ticket and store to localStorage
  const pending = normalizeTicket({
    id: ticketId,
    status,
    priority,
    title:'',
    Name: name,
    Email: email,
    Phone: phone,
    Category: category,
    SourceChannel: sourceChannel,
    linkedOrders: orderIds,
    linkedShipments: shipIds,
    linkedConversations: convIds,
    linkedTickets: tickIds,
    createdAt: Date.now(), updatedAt: Date.now()
  });
  // Mark as local (not rendered, but useful internally)
  pending._local = true;
  addLocalTicket(pending);
  updateArray('tickets', arr=> [pending, ...arr.filter(t=> (t.id||'') !== pending.id)]);

  await withButtonLoader(btn, async ()=>{
    try {
      const result = await api.createTicket(payload);
      // Prefer server ticket if any
      const created = Array.isArray(result) ? (result[0]||null) : (result || null);
      const normalized = created ? normalizeTicket(created) : normalizeTicket({
        id: ticketId, status:'open', priority:'normal', title:'', customer:name, email,
        createdAt: Date.now(), updatedAt: Date.now()
      });
      if(normalized){
        // If server didn't return a valid Ticket ID, keep the client-generated strict VEL-xxxxxx
        if(!normalized.id || isPseudoId(normalized.id) || !isStrictVelId(normalized.id)){
          normalized.id = ticketId;
        }
        // Ensure essential details are retained if server response lacks them
        if(!normalized.customer && !normalized.name){ normalized.customer = name; }
        if(!normalized.email){ normalized.email = email; }
        if(!normalized.orderNo){ normalized.orderNo = orderNo || undefined; }
        if(!normalized.shippingNo){ normalized.shippingNo = shipNo || undefined; }
        if(!normalized.createdAt){ normalized.createdAt = Date.now(); }
        if(!normalized.updatedAt){ normalized.updatedAt = normalized.createdAt; }
        // Replace local pending with server-normalized and drop any server pseudo duplicates
        updateArray('tickets', arr=> {
          const cleaned = arr.filter(t=> {
            const tid = String(t.id||'');
            if(tid === ticketId) return false;
            if(isPseudoId(tid)){
              const emailMatch = (t.email||'').toLowerCase() === (email||'').toLowerCase();
              const nameMatch = (t.customer||t.name||'').toLowerCase() === (name||'').toLowerCase();
              const orderMatch = !!(orderNo && t.orderNo && String(orderNo)===String(t.orderNo));
              const shipMatch = !!(shipNo && t.shippingNo && String(shipNo)===String(t.shippingNo));
              const timeClose = Math.abs((t.createdAt||0) - (normalized.createdAt||Date.now())) < 5*60*1000;
              if(emailMatch && timeClose && (orderMatch || shipMatch || nameMatch)) return false;
            }
            return true;
          });
          return [normalized, ...cleaned];
        });
        // Remove from local cache once server has accepted
        removeLocalTicketById(ticketId);
      }
      closeCreateTicketModal();
    } catch(err){
      console.error('Failed to create ticket', err);
      // Keep the local pending item in list and storage so it persists temporarily
      alert('Ticket saved locally. Will sync when online.');
    }
  }, 'Creating...');
}
