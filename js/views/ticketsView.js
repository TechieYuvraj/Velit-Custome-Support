import { state, setState, subscribe, updateArray } from '../core/state.js';
import { api } from '../core/api.js';
import { BUSINESS_ID } from '../config/endpoints.js';
import { showLoader, hideLoader, withButtonLoader } from '../utils/loader.js';

let unsub = null;
let initialized = false;

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
    if(!list.length){
      // Optional small mock if empty
      setState({ tickets: [
        { id: 'VEL-00012', status: 'open', priority: 'high', customer: 'Jane Doe', email: 'jane@acme.com', createdAt: Date.now()-3600000, updatedAt: Date.now()-120000, title: 'ECU error on startup', notes: 'Reported ECU malfunction' }
      ]});
    }
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
  return {
    id: t.id || t.ticketId || t.TicketId || t.Ticket_id || t.number || `T-${Math.random().toString(36).slice(2,8)}`,
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
            <label>Name</label>
            <div class="search-dropdown">
              <input id="ct-name" class="form-control" placeholder="Select or type name" />
              <ul id="ct-name-results" class="search-results" style="display:none;"></ul>
            </div>
          </div>
          <div class="form-group">
            <label>Email</label>
            <div class="search-dropdown">
              <input id="ct-email" class="form-control" placeholder="Select or type email" />
              <ul id="ct-email-results" class="search-results" style="display:none;"></ul>
            </div>
          </div>
          <div class="form-group"><label>Ticket ID</label><input id="ct-ticket-id" class="form-control" placeholder="Auto-generated" /></div>
          <div class="form-group">
            <label>Order No</label>
            <div class="search-dropdown">
              <input id="ct-order-search" class="form-control" placeholder="Search orders..." />
              <ul id="ct-order-results" class="search-results" style="display:none;"></ul>
            </div>
          </div>
          <div class="form-group">
            <label>Shipping No</label>
            <div class="search-dropdown">
              <input id="ct-ship-search" class="form-control" placeholder="Search shipping requests..." />
              <ul id="ct-ship-results" class="search-results" style="display:none;"></ul>
            </div>
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
  wireOrderSearch();
  wireShipSearch();
  wireNameDropdown();
  wireEmailDropdown();
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

let selectedOrderNo = '';
let selectedShipNo = '';
let selectedName = '';
let selectedEmail = '';

function wireOrderSearch(){
  const input = document.getElementById('ct-order-search');
  const listEl = document.getElementById('ct-order-results');
  if(!input || !listEl) return;
  const makeItems = (term)=>{
    const termL = term.toLowerCase();
    const items = (state.orders||[]).filter(o=>{
      const hay = [o.id,o.name,o.email,o.phone,o.address?.line1,o.address?.city,o.address?.state,o.address?.zip].join(' ').toLowerCase();
      return hay.includes(termL);
    }).slice(0,10);
    listEl.innerHTML = items.map(o=> `<li data-val="${escapeHtml(String(o.id))}"><strong>${escapeHtml(String(o.id))}</strong> — ${escapeHtml(o.name||'')} <span class="muted">${escapeHtml(o.email||'')}</span></li>`).join('');
    if(items.length){ listEl.style.display = 'block'; } else { listEl.style.display = 'none'; }
  };
  // toggle open on click; render recent on first open
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      // show recent 10
      const recent = [...(state.orders||[])].slice(-10).reverse();
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
    selectedOrderNo = li.dataset.val || '';
    input.value = selectedOrderNo;
    listEl.style.display = 'none';
  });
  // click outside to close
  document.addEventListener('click', (ev)=>{
    if(!ev.target.closest('.search-dropdown')){ listEl.style.display = 'none'; }
  });
}

function wireShipSearch(){
  const input = document.getElementById('ct-ship-search');
  const listEl = document.getElementById('ct-ship-results');
  if(!input || !listEl) return;
  const makeItems = (term)=>{
    const termL = term.toLowerCase();
    const items = (state.shippingRequests||[]).filter(r=>{
      const hay = [r.id,r.trackingNumber,r.orderId,r.email,r.name,r.status,r.product].join(' ').toLowerCase();
      return hay.includes(termL);
    }).slice(0,10);
    listEl.innerHTML = items.map(r=> `<li data-val="${escapeHtml(String(r.trackingNumber||r.id||''))}"><strong>${escapeHtml(String(r.trackingNumber||r.id||''))}</strong> — ${escapeHtml(r.status||'')} <span class="muted">${escapeHtml(r.email||'')}</span></li>`).join('');
    if(items.length){ listEl.style.display = 'block'; } else { listEl.style.display = 'none'; }
  };
  // toggle open on click; render recent on first open
  input.addEventListener('click', ()=>{
    if(listEl.style.display === 'none' || !listEl.style.display){
      const recent = [...(state.shippingRequests||[])].slice(-10).reverse();
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
    selectedShipNo = li.dataset.val || '';
    input.value = selectedShipNo;
    listEl.style.display = 'none';
  });
  // click outside to close
  document.addEventListener('click', (ev)=>{
    if(!ev.target.closest('.search-dropdown')){ listEl.style.display = 'none'; }
  });
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
  // Always generate the next ticket ID in VEL-000001 format
  const idInput = document.getElementById('ct-ticket-id');
  const ticketId = computeNextTicketId();
  if(idInput){ idInput.value = ticketId; }
  const orderNo = (document.getElementById('ct-order-search')?.value||selectedOrderNo||'').trim();
  const shipNo = (document.getElementById('ct-ship-search')?.value||selectedShipNo||'').trim();

  if(!name || !email || !ticketId){
    alert('Please fill Name, Email and Ticket ID.');
    return;
  }

  const payload = {
    business_id: BUSINESS_ID,
    Name: name,
    Email: email,
    Ticket_id: ticketId,
    Order_no: orderNo,
    Shipping_no: shipNo
  };

  await withButtonLoader(btn, async ()=>{
    try {
      const result = await api.createTicket(payload);
      // Prefer server ticket if any
      const created = Array.isArray(result) ? (result[0]||null) : (result || null);
      const normalized = created ? normalizeTicket(created) : normalizeTicket({
        id: ticketId, status:'open', priority:'normal', title:'', customer:name, email,
        createdAt: Date.now(), updatedAt: Date.now()
      });
      if(normalized){ updateArray('tickets', arr=> [normalized, ...arr]); }
      closeCreateTicketModal();
    } catch(err){
      console.error('Failed to create ticket', err);
      alert('Failed to create ticket');
    }
  }, 'Creating...');
}
