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
  if(initialized) {
    console.log('Shipping requests already initialized, skipping fetch');
    return; // fetch only once for now
  }
  try {
    const sessionId = buildSessionId();
    const data = await api.fetchShippingRequests(sessionId, 'ShippingRequests');
    console.log('Shipping requests raw API response:', data);
    const array = Array.isArray(data) ? data : (data ? [data] : []);
    const list = array.map(normalizeRequest).filter(Boolean);
    console.log('Final shipping requests list:', list);
    setState({ shippingRequests: list });
    
    // If no data, set some mock data for testing
    if (!list.length) {
      console.log('No shipping requests from API, setting mock data for testing');
      const mockData = [
        {
          id: 'SR-001',
          product: 'Rooftop AC Unit',
          status: 'pending',
          trackingNumber: 'TRK123456',
          requestId: 'REQ-001',
          orderId: 'ORD-12345',
          url: '',
          email: 'customer@example.com',
          name: 'John Doe',
          createdAt: Date.now() - 86400000 // 1 day ago
        },
        {
          id: 'SR-002',
          product: 'Gas Heater',
          status: 'in_transit',
          trackingNumber: 'TRK789012',
          requestId: 'REQ-002',
          orderId: 'ORD-67890',
          url: '',
          email: 'jane@example.com',
          name: 'Jane Smith',
          createdAt: Date.now() - 43200000 // 12 hours ago
        }
      ];
      setState({ shippingRequests: mockData });
    }
  } catch(err){
    console.error('Failed to load shipping requests', err);
  } finally {
    initialized = true;
  }
}

function buildSessionId(){
  const d=new Date();
  const pad=n=> String(n).padStart(2,'0');
  return pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+pad(d.getDate())+pad(d.getMonth()+1)+d.getFullYear();
}

function normalizeRequest(r){
  if(!r || typeof r !== 'object') return null;
  // New shape sample:
  // { Product, Status, trackingNumber, requestId, orderId, url, Email, Name }
  const status = (r.Status || r.status || 'pending').toString().trim().toLowerCase().replace(/\s+/g,'_');
  return {
    id: r.requestId || r.trackingNumber || r.orderId || `REQ-${Math.random().toString(36).slice(2,8)}`,
    product: r.Product || r.product || '',
    status,
    trackingNumber: r.trackingNumber || r.tracking || '',
    requestId: r.requestId || '',
    orderId: r.orderId || '',
    url: r.url || '',
    email: r.Email || r.email || '',
    name: r.Name || r.shipping_name || r['Shipping Name'] || r.name || '',
    createdAt: r.Time || r.createdAt || r.created_at || Date.now()
  };
}

function filtered(){
  const term = (document.getElementById('shipping-search')?.value || '').toLowerCase();
  const statusFilter = (document.getElementById('shipping-status-filter')?.value || '').toLowerCase();
  let list = [...state.shippingRequests];
  // Sort newest first by createdAt (numeric) fallback by array order
  list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  if(term){
    list = list.filter(r=> [r.id,r.trackingNumber,r.requestId,r.orderId,r.email,r.name,r.status,r.product].join(' ').toLowerCase().includes(term));
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
  console.log('renderShippingRequests called, host element:', host);
  if(!host) return;
  const list = filtered();
  console.log('Filtered shipping requests for rendering:', list);
  if(!list.length){ host.innerHTML = '<p class="empty">No shipping requests found.</p>'; return; }
  host.innerHTML = list.map(cardHtml).join('');
}

function cardHtml(r){
  const countdown = r.status==='pending' ? remainingSeconds(r) : null;
  return `<div class="ship-req-card status-${r.status}">
    <div class="sr-head"><h4>${escapeHtml(r.product || '—')}</h4><span class="sr-status">${escapeHtml(r.status)}${countdown!==null?` (${countdown}s)`:''}</span></div>
    <div class="sr-meta">
      <div><strong>${escapeHtml(r.name || 'Unknown')}</strong><br><span class="email">${escapeHtml(r.email || '')}</span></div>
      <div class="sr-id" title="Tracking Number">${escapeHtml(String(r.trackingNumber || 'N/A'))}</div>
    </div>
    <div class="sr-body-fields">
      <div class="sr-line">${escapeHtml(r.requestId || '')}</div>
      <div class="sr-line"><span class="order-id-label">Order ID:</span> <span>${escapeHtml(r.orderId || 'N/A')}</span></div>
    </div>
    <div class="sr-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
      ${r.url ? `<button class="mini-btn" onclick="window.open('${r.url}','_blank')">Label</button>`:''}
    </div>
    <div class="sr-footer"><small>${formatDate(r.createdAt)}</small></div>
  </div>`;
}

function formatDate(ts){
  try { const d = new Date(ts); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); } catch { return ''; }
}

function escapeHtml(str){
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
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
  console.log('initShippingRequestsView called');
  ensureSubscribed();
  await loadShippingRequests();
  attachShippingRequestsHandlers();
  renderShippingStats();
  renderShippingRequests();
}
