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
  // Support Firestore document shape from LabelHistory webhook
  if(r.document && r.document.fields){
    const doc = r.document;
    const f = doc.fields || {};
    const val = (node)=>{
      if(!node || typeof node !== 'object') return undefined;
      if('stringValue' in node) return node.stringValue;
      if('integerValue' in node) return String(node.integerValue);
      if('doubleValue' in node) return String(node.doubleValue);
      if('booleanValue' in node) return node.booleanValue;
      if('timestampValue' in node){ try { return new Date(node.timestampValue).toISOString(); } catch { return undefined; } }
      if('nullValue' in node) return null;
      return undefined;
    };
    const createdAtStr = val(f.createdAt) || doc.createTime;
    const updatedAtStr = val(f.updatedAt) || doc.updateTime;
    const base = {
      Product: val(f.Product),
      Status: val(f.Status),
      trackingNumber: val(f.trackingNumber),
      requestId: val(f.requestId),
      orderId: val(f.orderId),
      url: val(f.url),
      Email: val(f.Email),
      Name: val(f.Name),
      Note: val(f.Note),
      createdAt: createdAtStr,
      updatedAt: updatedAtStr
    };
    r = base;
  }
  // Map to flat model
  const status = (r.Status || r.status || 'pending').toString().trim().toLowerCase().replace(/\s+/g,'_');
  const createdAt = r.createdAt ? Date.parse(r.createdAt) : (r.Date ? Date.parse(r.Date) : undefined);
  const updatedAt = r.updatedAt ? Date.parse(r.updatedAt) : undefined;
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
    note: r.Note || r.note || '',
    createdAt,
    updatedAt
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
      ${r.note ? `<div class="sr-line"><span class="note-label">Note:</span> <span>${escapeHtml(r.note)}</span></div>` : ''}
    </div>
    <div class="sr-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
      ${r.url ? `<button class="mini-btn" onclick="window.open('${r.url}','_blank')">Label</button>`:''}
      <button class="mini-btn update-status-btn" data-request-id="${r.id}" onclick="openUpdateStatusModal('${r.id}')">Update Shipment Status</button>
    </div>
    <div class="sr-footer"><small>Created: ${formatDate(r.createdAt)}${r.updatedAt?` • Updated: ${formatDate(r.updatedAt)}`:''}</small></div>
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
  initUpdateStatusModal();
}

// Initialize the update status modal
function initUpdateStatusModal() {
  // Create modal HTML if it doesn't exist
  if (!document.getElementById('update-status-modal')) {
    const modalHTML = `
      <div id="update-status-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Update Shipment Status</h3>
            <button class="modal-close" onclick="closeUpdateStatusModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="status-select">Status:</label>
              <select id="status-select" class="form-control">
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div class="form-group">
              <label for="status-note">Note:</label>
              <textarea id="status-note" class="form-control" placeholder="Enter any additional notes..." rows="3"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="closeUpdateStatusModal()">Cancel</button>
            <button class="btn-primary" onclick="updateShipmentStatus()">Update Status</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
}

// Global functions for modal interaction
window.openUpdateStatusModal = function(requestId) {
  const modal = document.getElementById('update-status-modal');
  const request = state.shippingRequests.find(r => r.id === requestId);
  
  if (modal && request) {
    // Set current values
    document.getElementById('status-select').value = request.status || 'pending';
    document.getElementById('status-note').value = '';
    
    // Store request ID for update
    modal.dataset.requestId = requestId;
    modal.style.display = 'flex';
  }
};

window.closeUpdateStatusModal = function() {
  const modal = document.getElementById('update-status-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.dataset.requestId = '';
  }
};

window.updateShipmentStatus = async function() {
  const modal = document.getElementById('update-status-modal');
  const requestId = modal.dataset.requestId;
  const newStatus = document.getElementById('status-select').value;
  const note = document.getElementById('status-note').value;
  
  if (!requestId) return;
  
  try {
    // Disable buttons to prevent duplicate submits
    const footer = modal.querySelector('.modal-footer');
    const buttons = footer ? Array.from(footer.querySelectorAll('button')) : [];
    buttons.forEach(b => b.disabled = true);

    // Collect request context to send along
    const req = state.shippingRequests.find(r => r.id === requestId) || {};
    const payload = {
      requestId: req.requestId || requestId,
      orderId: req.orderId || '',
      trackingNumber: req.trackingNumber || '',
      email: req.email || '',
      name: req.name || '',
      product: req.product || '',
      status: newStatus,
      note: note || '',
    };

    // Send to webhook
    await api.updateShipmentStatus(payload);

    // Update the status in local state
    const requestIndex = state.shippingRequests.findIndex(r => r.id === requestId);
    if (requestIndex !== -1) {
      state.shippingRequests[requestIndex].status = newStatus;
      setState({ shippingRequests: [...state.shippingRequests] });
    }
    
    closeUpdateStatusModal();
    renderShippingRequests();
    renderShippingStats();
  } catch (error) {
    console.error('Failed to update shipment status:', error);
    alert('Failed to update status. Please try again.');
  } finally {
    const footer = modal.querySelector('.modal-footer');
    const buttons = footer ? Array.from(footer.querySelectorAll('button')) : [];
    buttons.forEach(b => b.disabled = false);
  }
};
