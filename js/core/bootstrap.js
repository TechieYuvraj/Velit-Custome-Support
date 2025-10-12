import { loadCustomerSupport } from '../views/customerSupportView.js';
import { attachConversationListHandlers } from '../components/conversationDetail.js';
import { state, setState } from './state.js';
import { loadOrders, attachOrderHistoryHandlers } from '../views/orderHistoryView.js';
import { initShippingRequestsView } from '../views/shippingRequestsView.js';
import { showLoader, hideLoader, withButtonLoader } from '../utils/loader.js';
import { initTicketsView } from '../views/ticketsView.js';

function isoRange(fromDate, toDate){
  return [fromDate + 'T00:00:00Z', toDate + 'T23:59:59Z'];
}

async function switchView(view){
  const views=['order-history','shipping-requests','customer-support','tickets'];
  views.forEach(v=>{
    const section=document.getElementById(`view-${v}`);
    if(section) section.hidden = v!==view;
    const btn=document.getElementById(`nav-${v}`);
    if(btn){ if(v===view) btn.classList.add('active'); else btn.classList.remove('active'); }
  });
  setState({ currentView: view });
  
  const currentSection = document.getElementById(`view-${view}`);
  
  if(view==='order-history'){ 
    if(!state.orders.length) {
      showLoader(currentSection, 'overlay');
      try {
        await loadOrders();
      } finally {
        hideLoader(currentSection, 'overlay');
      }
    }
  }
  if(view==='shipping-requests'){ 
    showLoader(currentSection, 'overlay');
    try {
      await initShippingRequestsView();
    } finally {
      hideLoader(currentSection, 'overlay');
    }
  }
  if(view==='customer-support'){
    // Customer support is already loaded, no need to reload
  }
  if(view==='tickets'){
    showLoader(currentSection, 'overlay');
    try { await initTicketsView(); } finally { hideLoader(currentSection, 'overlay'); }
  }
}

async function initCustomerSupport(){
  // Date filters removed; use defaults embedded in view loader
  try { await loadCustomerSupport(); } catch(err){ console.error(err); }
}

function bindNav(){
  ['order-history','shipping-requests','customer-support','tickets'].forEach(v=>{
    const btn=document.getElementById(`nav-${v}`);
    if(btn) btn.addEventListener('click', async ()=> await switchView(v));
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
    filterBtn.addEventListener('click', async ()=> {
      await withButtonLoader(filterBtn, async () => {
        await initCustomerSupport();
      }, 'Filtering...');
    });
  }
}

export async function initApp(){
  bindNav();
  attachConversationListHandlers();
  attachOrderHistoryHandlers();
  bindCustomerSupportSubNav();
  bindFilters();

  // Fire all initial data loads without blocking UI so tab switching remains responsive
  // Start fetches for all four tabs in the background
  (async ()=>{ try { await initCustomerSupport(); } catch(e){ console.error('Customer support init failed', e);} })();
  (async ()=>{ try { await loadOrders(); } catch(e){ console.error('Orders load failed', e);} })();
  (async ()=>{ try { await initShippingRequestsView(); } catch(e){ console.error('Shipping requests init failed', e);} })();
  (async ()=>{ try { const mod = await import('../views/ticketsView.js'); await mod.initTicketsView(); } catch(e){ console.error('Tickets init failed', e);} })();

  // Immediately show customer support view; user can navigate while data loads
  await switchView('customer-support');
}

document.addEventListener('DOMContentLoaded', ()=>{ initApp(); });
