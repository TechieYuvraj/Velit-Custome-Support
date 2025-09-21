import { state, setState, updateArray, subscribe } from '../core/state.js';
import { api } from '../core/api.js';

let unsub = null;
let initialized = false;

function ensureSubscribed(){
  if(unsub) return;
  unsub = subscribe((s)=>{
    if(s.currentView === 'shipping-requests'){
      renderShippingRequests();
      renderShippingStats();
    }
  });
}

export async function loadShippingRequests(){
  if(initialized) return; // fetch only once for now
  try {
    const data = await api.fetchShipmentStatus();
    // Expecting an array; normalize minimal fields
    const list = Array.isArray(data) ? data.map(normalizeRequest) : [];
    setState({ shippingRequests: list });
  } catch(err){
    console.error('Failed to load shipping requests', err);
  } finally {
    initialized = true;
  }
}

function normalizeRequest(r){
  // Accept multiple possible field names defensively
  return {
    id: r.id || r.request_id || r.tracking_id || `REQ-${Math.random().toString(36).slice(2,8)}`,
    email: r.email || r.user_email || '',
    orderNo: r.order_no || r.orderNo || r.order_number || '',
    name: r.name || r.customer_name || '',
    status: (r.status || 'open').toLowerCase(),
    createdAt: r.createdAt || r.created_at || r.timestamp || Date.now(),
    address: r.address || r.shipping_address || '',
  };
}

function filtered(){
  const term = (document.getElementById('shipping-search')?.value || '').toLowerCase();
  const statusFilter = (document.getElementById('shipping-status-filter')?.value || '').toLowerCase();
  let list = [...state.shippingRequests];
  // Sort newest first by createdAt (numeric) fallback by array order
  list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  if(term){
    list = list.filter(r=> [r.id,r.orderNo,r.email,r.name,r.status,r.address].join(' ').toLowerCase().includes(term));
  }
  if(statusFilter){
    list = list.filter(r=> r.status === statusFilter);
  }
  return list;
}

export function attachShippingRequestsHandlers(){
  ensureSubscribed();
  const search = document.getElementById('shipping-search');
  if(search) search.addEventListener('input', ()=> renderShippingRequests());
  const statusSel = document.getElementById('shipping-status-filter');
  if(statusSel) statusSel.addEventListener('change', ()=>{ renderShippingRequests(); renderShippingStats(); });
}

export function renderShippingRequests(){
  const host = document.getElementById('shipping-request-cards');
  if(!host) return;
  const list = filtered();
  if(!list.length){ host.innerHTML = '<p class="empty">No shipping requests found.</p>'; return; }
  host.innerHTML = list.map(cardHtml).join('');
}

function cardHtml(r){
  const countdown = r.status==='pending' ? remainingSeconds(r) : null;
  return `<div class="ship-req-card status-${r.status}">
    <div class="sr-head"><h4>${r.orderNo || '(No Order)'} </h4><span class="sr-status">${r.status}${countdown!==null?` (${countdown}s)`:''}</span></div>
    <div class="sr-meta">
      <div><strong>${r.name || 'Unknown'}</strong><br><span class="email">${r.email}</span></div>
      <div class="sr-id">${r.id}</div>
    </div>
    <div class="sr-address">${escapeHtml(r.address||'')}</div>
    <div class="sr-footer"><small>${formatDate(r.createdAt)}${countdown!==null ? ` • Activates soon` : ''}</small></div>
  </div>`;
}

function formatDate(ts){
  try { const d = new Date(ts); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); } catch { return ''; }
}

function escapeHtml(str){
  return str.replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

function remainingSeconds(r){
  if(!r._etaExpires) return null;
  const diff = Math.max(0, r._etaExpires - Date.now());
  return Math.ceil(diff/1000);
}

export function renderShippingStats(){
  const host = document.getElementById('shipping-stats');
  if(!host) return;
  const list = state.shippingRequests;
  const counts = list.reduce((acc,r)=>{ acc[r.status]=(acc[r.status]||0)+1; return acc; },{});
  const total = list.length;
  const statuses = ['pending','open','in_transit','delivered','cancelled'];
  host.innerHTML = `<div class="stat-card total"><span class="label">Total</span><span class="value">${total}</span></div>` +
    statuses.map(s=> `<div class="stat-card ${s}"><span class="label">${labelize(s)}</span><span class="value">${counts[s]||0}</span></div>`).join('');
}

function labelize(s){
  return s.replace(/_/g,' ').replace(/\b\w/g, m=> m.toUpperCase());
}

// Handle delayed insertion coming from shipRequestModal via updateArray already scheduled.
// This file just needs to ensure UI updates (subscription handles that).

// Public bootstrap for view
export async function initShippingRequestsView(){
  ensureSubscribed();
  await loadShippingRequests();
  attachShippingRequestsHandlers();
  renderShippingStats();
  renderShippingRequests();
}
