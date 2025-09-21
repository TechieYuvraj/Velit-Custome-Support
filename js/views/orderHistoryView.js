import { state, setState } from '../core/state.js';
import { openShippingLabelModal } from '../components/shippingLabelModal.js';
import { api } from '../core/api.js';
import { openShipRequestModal } from '../components/shipRequestModal.js';

// Placeholder mock orders until endpoint confirmed
function mockOrders(){
  return [
    { id: 'O-1005', email: 'alice@example.com', name: 'Alice Lee', lines: 2, total: 280.50, address: { line1:'123 Pine St', line2:'', city:'Seattle', state:'WA', zip:'98101', country:'USA' } },
    { id: 'O-1004', email: 'bob@example.com', name: 'Bob Martin', lines: 1, total: 99.99, address: { line1:'88 Sunset Blvd', line2:'Suite 5', city:'Los Angeles', state:'CA', zip:'90001', country:'USA' } },
    { id: 'O-1003', email: 'chloe@example.com', name: 'Chloe Green', lines: 3, total: 540.00, address: { line1:'45 Green Way', line2:'', city:'Portland', state:'OR', zip:'97201', country:'USA' } },
  ];
}

export async function loadOrders(){
  // TODO: Replace with real fetch once endpoint provided
  const orders = mockOrders();
  setState({ orders });
  renderOrderCards();
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
        const adapted = [{ 'Order Number': order.id, 'Shipping Name': order.name, 'Shipping Address 1': order.address.line1, 'Shipping Address 2': order.address.line2, 'Shipping City': order.address.city, 'Shipping State': order.address.state, 'Shipping Country': order.address.country, 'Shipping Zipcode': order.address.zip, 'Phone': '', 'Email': order.email }];
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
    list = list.filter(o=> [o.id,o.email,o.name,o.address.line1,o.address.city,o.address.state,o.address.zip].join(' ').toLowerCase().includes(term));
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
      <span class="lines">${o.lines} line${o.lines>1?'s':''}</span>
    </div>
    <div class="order-meta">
      <div><strong>${o.name}</strong><br><span class="email">${o.email}</span></div>
      <div class="amount">$${o.total.toFixed(2)}</div>
    </div>
    <div class="order-address">${addr}</div>
    <div class="order-actions"><button class="mini-btn">Create Shipping Label</button></div>
  </div>`;
}
