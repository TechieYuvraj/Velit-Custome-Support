import { state, setState, subscribe, updateArray } from '../core/state.js';
import { api } from '../core/api.js';
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
    const arr = Array.isArray(data) ? data : (data ? [data] : []);
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
  // Expected fields from webhook can vary; map flexibly
  return {
    id: t.id || t.ticketId || t.TicketId || t.number || `T-${Math.random().toString(36).slice(2,8)}`,
    status: (t.status || t.Status || 'open').toString().trim().toLowerCase(),
    title: t.title || t.subject || t.Subject || '',
    customer: t.customer || t.name || t.Customer || '',
    email: t.email || t.Email || '',
    createdAt: t.createdAt || t.Created || t.Time || Date.now(),
    updatedAt: t.updatedAt || t.Updated || t.lastUpdated || Date.now(),
    conversation: Array.isArray(t.conversation) ? t.conversation : [],
    internalNotes: t.internalNotes || t.notes || '',
    linked: {
      tickets: t.linkedTickets || [],
      orders: t.linkedOrders || [],
      shipments: t.linkedShipments || [],
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

function openCreateTicketModal(){
  // Simple prompt-based modal fallback to keep scope minimal; can be replaced with full modal later
  const title = prompt('Ticket Title');
  if(!title) return;
  const customer = prompt('Customer Name') || '';
  const email = prompt('Customer Email') || '';
  const payload = { title, customer, email, priority };
  const btn = document.getElementById('create-ticket');
  if(!btn) return;
  withButtonLoader(btn, async ()=>{
    try {
      await api.createTicket(payload);
      // Optimistically insert
      const t = normalizeTicket({ ...payload, status: 'open', createdAt: Date.now(), updatedAt: Date.now(), id: `VEL-${Math.floor(Math.random()*90000+10000)}` });
      updateArray('tickets', arr=> [t, ...arr]);
    } catch(e){
      alert('Failed to create ticket');
    }
  }, 'Creating...');
}
