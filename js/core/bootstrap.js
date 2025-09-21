import { loadCustomerSupport } from '../views/customerSupportView.js';
import { attachConversationListHandlers } from '../components/conversationDetail.js';
import { state, setState } from './state.js';
import { loadOrders, attachOrderHistoryHandlers } from '../views/orderHistoryView.js';
import { initShippingRequestsView } from '../views/shippingRequestsView.js';

function isoRange(fromDate, toDate){
  return [fromDate + 'T00:00:00Z', toDate + 'T23:59:59Z'];
}

function switchView(view){
  const views=['order-history','shipping-requests','customer-support'];
  views.forEach(v=>{
    const section=document.getElementById(`view-${v}`);
    if(section) section.hidden = v!==view;
    const btn=document.getElementById(`nav-${v}`);
    if(btn){ if(v===view) btn.classList.add('active'); else btn.classList.remove('active'); }
  });
  setState({ currentView: view });
  if(view==='order-history'){ if(!state.orders.length) loadOrders(); }
  if(view==='shipping-requests'){ initShippingRequestsView(); }
}

async function initCustomerSupport(){
  const fromInput = document.getElementById('from-date');
  const toInput = document.getElementById('to-date');
  if(fromInput && toInput){
    if(!fromInput.value) fromInput.value='2024-01-01';
    if(!toInput.value) toInput.value=new Date().toISOString().split('T')[0];
    const [fromISO, toISO] = isoRange(fromInput.value, toInput.value);
    try { await loadCustomerSupport(fromISO, toISO); } catch(err){ console.error(err); }
  }
}

function bindNav(){
  ['order-history','shipping-requests','customer-support'].forEach(v=>{
    const btn=document.getElementById(`nav-${v}`);
    if(btn) btn.addEventListener('click', ()=> switchView(v));
  });
}

function bindFilters(){
  const filterBtn = document.getElementById('filter-conversations-btn');
  if(filterBtn){
    filterBtn.addEventListener('click', ()=> initCustomerSupport());
  }
}

export async function initApp(){
  bindNav();
  attachConversationListHandlers();
  attachOrderHistoryHandlers();
  bindFilters();
  await initCustomerSupport();
  switchView('customer-support');
}

document.addEventListener('DOMContentLoaded', ()=>{ initApp(); });
