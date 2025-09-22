import { state, setState } from '../core/state.js';
import { openShippingLabelModal } from '../components/shippingLabelModal.js';
import { api } from '../core/api.js';
import { openShipRequestModal } from '../components/shipRequestModal.js';

// Placeholder mock orders until endpoint confirmed
function mockOrders(){
  // Simplified mock matching new remote shape
  return [
    { id: '1010', name: 'Alice Lee', email: 'alice@example.com', phone: '1112223333', address: { line1:'123 Pine St', line2:'', city:'Seattle', state:'WA', zip:'98101', country:'United States' } },
    { id: '1009', name: 'Bob Martin', email: 'bob@example.com', phone: '2223334444', address: { line1:'88 Sunset Blvd', line2:'Suite 5', city:'Los Angeles', state:'CA', zip:'90001', country:'United States' } },
    { id: '1008', name: 'Chloe Green', email: 'chloe@example.com', phone: '3334445555', address: { line1:'45 Green Way', line2:'', city:'Portland', state:'OR', zip:'97201', country:'United States' } }
  ];
}

export async function loadOrders({ retry=false }={}){
  const sessionId = buildSessionId();
  let remote = [];
  let usedSource = 'mock';
  try {
    const data = await api.fetchOrderHistory(sessionId, 'Order History');
    if(Array.isArray(data)) remote = data; else if(data && typeof data === 'object') remote = [data];
  } catch(err){
    if(retry) console.warn('Retry failed for order history', err); else console.warn('Order history fetch failed, using mock data', err);
  }
  let normalized = [];
  if(remote && remote.length){
    normalized = remote.map(r=> normalizeRemoteOrder(r)).filter(Boolean);
  }
  if(normalized.length){
    usedSource = 'live';
  } else {
    normalized = mockOrders();
    usedSource = 'mock';
  }
  setState({ orders: normalized, ordersSource: usedSource });
  renderOrderCards();
  updateOrdersMeta();
}

function updateOrdersMeta(){
  const metaHost = document.getElementById('order-source-indicator');
  if(!metaHost) return;
  const source = state.ordersSource;
  const label = source==='live' ? 'Live Data' : (source==='mock' ? 'Fallback (Mock)' : '—');
  const color = source==='live' ? '#2e7d32' : (source==='mock' ? '#b26a00' : '#666');
  metaHost.innerHTML = `<span style="color:${color};font-weight:600;">${label}</span>` +
    (source!=='live' ? ' <button id="retry-orders" class="mini-btn" style="margin-left:8px;">Retry</button>' : '');
  const retryBtn = document.getElementById('retry-orders');
  if(retryBtn){
    retryBtn.addEventListener('click', ()=>{
      retryBtn.disabled = true;
      retryBtn.textContent = 'Retrying...';
      loadOrders({ retry:true });
    });
  }
}

function buildSessionId(){
  const d=new Date();
  const pad=n=> String(n).padStart(2,'0');
  return pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+pad(d.getDate())+pad(d.getMonth()+1)+d.getFullYear();
}

function normalizeRemoteOrder(r){
  if(!r) return null;
  // New canonical remote shape (sample provided):
  // { "Order Number": 1025, "Shipping Name": "...", "Shipping Address 1": "...", ... }
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
    const card = e.target.closest('.order-card');
    if(card && card.dataset.orderId){
      const order = state.orders.find(o=>o.id===card.dataset.orderId);
      if(order){
        // For now just open modal prefilled with single order structure shape expected by modal
  const adapted = [{ 'Order Number': order.id, 'Shipping Name': order.name, 'Shipping Address 1': order.address.line1, 'Shipping Address 2': order.address.line2, 'Shipping City': order.address.city, 'Shipping State': order.address.state, 'Shipping Country': order.address.country, 'Shipping Zipcode': order.address.zip, 'Phone': order.phone || '', 'Email': order.email }];
        openShippingLabelModal(order.email, adapted, []);
      }
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
  return `<div class="order-card" data-order-id="${o.id}">
    <div class="order-header">
      <h4>${o.id}</h4>
    </div>
    <div class="order-meta">
      <div><strong>${o.name || '—'}</strong><br><span class="email">${o.email || '—'}</span>${o.phone? `<br><span class="phone">${o.phone}</span>`:''}</div>
    </div>
    <div class="order-address">${addr}</div>
    <div class="order-actions"><button class="mini-btn">Create Shipping Label</button></div>
  </div>`;
}
