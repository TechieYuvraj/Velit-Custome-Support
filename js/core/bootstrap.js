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
  // Date filters removed; use defaults embedded in view loader
  try { await loadCustomerSupport(); } catch(err){ console.error(err); }
}

function bindNav(){
  ['order-history','shipping-requests','customer-support'].forEach(v=>{
    const btn=document.getElementById(`nav-${v}`);
    if(btn) btn.addEventListener('click', ()=> switchView(v));
  });
}

function bindCustomerSupportSubNav(){
  const subButtons = document.querySelectorAll('.cs-sub-btn');
  if(!subButtons.length) return;
    const emailStatsBar = document.getElementById('email-stats-bar');
    subButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.getAttribute('data-cs');
      // toggle active state
      subButtons.forEach(b=> b.classList.remove('active'));
      btn.classList.add('active');
      // show/hide panels
      document.querySelectorAll('[data-cs-panel]').forEach(panel=>{
        if(panel.getAttribute('data-cs-panel') === target){
          panel.style.display='block';
        } else {
          panel.style.display='none';
        }
      });
        if(target==='email') {
          if(emailStatsBar) emailStatsBar.style.display='flex';
        } else {
          if(emailStatsBar) emailStatsBar.style.display='none';
        }
    });
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
  bindCustomerSupportSubNav();
  bindFilters();
  await initCustomerSupport();
  switchView('customer-support');
}

document.addEventListener('DOMContentLoaded', ()=>{ initApp(); });
