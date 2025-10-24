import { state, setState } from '../core/state.js';
import { openShippingLabelModal } from '../components/shippingLabelModal.js';
import { api } from '../core/api.js';
import { openShipRequestModal } from '../components/shipRequestModal.js';
import { withButtonLoader } from '../utils/loader.js';
import { showServerErrorModal } from '../utils/errorModal.js';

export async function loadOrders({ retry=false }={}){
  const sessionId = buildSessionId();
  let remote = [];
  
  try {
    const data = await api.fetchOrderHistory(sessionId, 'Order History');
    if(Array.isArray(data)) {
      remote = data;
    } else if (data && Array.isArray(data.documents)) {
      // Firestore list shape
      remote = data.documents.map(d => ({ document: d }));
    } else if(data && typeof data === 'object') {
      remote = [data];
    }
  } catch(err){
    console.error('Order history fetch failed', err);
    // Show error modal popup
    showServerErrorModal('Failed to load order history. Server not responding.', () => loadOrders({ retry: true }));
  }
  
  let normalized = [];
  if(remote && remote.length){
    normalized = remote.map(r=> normalizeRemoteOrder(r)).filter(Boolean);
  }
  
  setState({ orders: normalized });
  renderOrderCards();
}

function buildSessionId(){
  const d=new Date();
  const pad=n=> String(n).padStart(2,'0');
  return pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+pad(d.getDate())+pad(d.getMonth()+1)+d.getFullYear();
}

function normalizeRemoteOrder(r){
  if(!r) return null;
  // Support Firestore document structure
  if (r.document && r.document.fields) {
    const doc = r.document;
    const f = doc.fields || {};
    const sval = (n)=> n && n.stringValue != null ? String(n.stringValue) : undefined;
    const tval = (n)=> n && n.timestampValue ? String(n.timestampValue) : undefined;
    const id = sval(f.order_number) || sval(f.order_no) || sval(f.id);
    if(!id) return null;
    const name = sval(f.shipping_name) || sval(f.name) || '';
    const email = sval(f.email) || '';
    const phone = (sval(f.phone) || '').toString();
    const address = {
      line1: sval(f.shipping_address_1) || sval(f.address1) || sval(f.address_1) || '',
      line2: sval(f.shipping_address_2) || sval(f.address2) || sval(f.address_2) || '',
      city: sval(f.shipping_city) || sval(f.city) || '',
      state: sval(f.shipping_state) || sval(f.state) || '',
      zip: sval(f.shipping_zipcode) || sval(f.zip) || sval(f.zipcode) || '',
      country: sval(f.shipping_country) || sval(f.country) || ''
    };
    // Optional metadata (not currently displayed)
    const createdAt = tval(f.createdAt) || doc.createTime;
    return { id: String(id), name, email, phone, address, createdAt };
  }
  // Backward-compatible flat/canonical structures
  const id = r['Order Number'] || r.order_number || r.order_no || r.id;
  if(!id) return null;
  const name = r['Shipping Name'] || r.name || '';
  const email = r.Email || r.email || '';
  const phone = (r.Phone || r.phone || '').toString();
  const address = {
    line1: r['Shipping Address 1'] || r.address1 || r.address_1 || '',
    line2: r['Shipping Address 2'] || r.address2 || r.address_2 || '',
    city: r['Shipping City'] || r.city || '',
    state: r['Shipping State'] || r.state || '',
    zip: r['Shipping Zipcode'] || r.zip || r.zipcode || '',
    country: r['Shipping Country'] || r.country || ''
  };
  return { id: String(id), name, email, phone, address };
}

export function attachOrderHistoryHandlers(){
  const search = document.getElementById('order-search');
  if(search){ search.addEventListener('input', ()=> renderOrderCards()); }
  const createBtn = document.getElementById('create-shipping-request');
  if(createBtn){ createBtn.addEventListener('click', ()=> openShipRequestModal()); }
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.order-card .order-actions .mini-btn');
    if(!btn) return;
    const card = e.target.closest('.order-card');
    if(!card) return;
    const orderId = card.dataset.orderId;
    const exists = (state.shippingRequests||[]).some(r=> String(r.orderId) === String(orderId));
    if(exists){
      const order = state.orders.find(o=>o.id===orderId);
      if(order){
        const adapted = [{ 'Order Number': order.id, 'Shipping Name': order.name, 'Shipping Address 1': order.address.line1, 'Shipping Address 2': order.address.line2, 'Shipping City': order.address.city, 'Shipping State': order.address.state, 'Shipping Country': order.address.country, 'Shipping Zipcode': order.address.zip, 'Phone': order.phone || '', 'Email': order.email }];
        openShippingLabelModal(order.email, adapted, []);
      }
      return;
    }
    const order = state.orders.find(o=>o.id===orderId);
    if(order){
      const adapted = [{ 'Order Number': order.id, 'Shipping Name': order.name, 'Shipping Address 1': order.address.line1, 'Shipping Address 2': order.address.line2, 'Shipping City': order.address.city, 'Shipping State': order.address.state, 'Shipping Country': order.address.country, 'Shipping Zipcode': order.address.zip, 'Phone': order.phone || '', 'Email': order.email }];
      openShippingLabelModal(order.email, adapted, []);
    }
  });
}

function filteredOrders(){
  const term = (document.getElementById('order-search')?.value || '').toLowerCase();
  let list = [...state.orders];
  // Descending by fallback index (most recent first)
  list.reverse();
  if(term){
    list = list.filter(o=> [o.id,o.email,o.name,o.phone,o.address.line1,o.address.city,o.address.state,o.address.zip].join(' ').toLowerCase().includes(term));
  }
  return list;
}

export function renderOrderCards(){
  const host = document.getElementById('order-cards');
  if(!host) return;
  
  const list = filteredOrders();
  if(!list.length){ host.innerHTML='<p class="empty">No orders found.</p>'; return; }
  host.innerHTML = list.map(o=> orderCard(o)).join('');
}

function multilineAddress(addr){
  return `${addr.line1}${addr.line2? '\n'+addr.line2:''}\n${addr.city}, ${addr.state} ${addr.zip}\n${addr.country}`;
}

function orderCard(o){
  const addr = multilineAddress(o.address).replace(/\n/g,'<br>');
  const exists = (state.shippingRequests||[]).some(r=> String(r.orderId) === String(o.id));
  return `<div class="order-card" data-order-id="${o.id}">
    <div class="order-header">
      <h4>${o.id}</h4>
    </div>
    <div class="order-meta">
      <div><strong>${o.name || '—'}</strong><br><span class="email">${o.email || '—'}</span>${o.phone? `<br><span class="phone">${o.phone}</span>`:''}</div>
    </div>
    <div class="order-address">${addr}</div>
    <div class="order-actions">${exists ? '<span class="muted">Shipping Request has been already created.</span>' : '<button class="mini-btn">Create Shipping Request</button>'}</div>
  </div>`;
}
