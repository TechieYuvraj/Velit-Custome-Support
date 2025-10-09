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
  
  // Show initial loading for the whole app
  const appContainer = document.querySelector('.dashboard-container');
  if (appContainer) {
    showLoader(appContainer, 'overlay');
  }
  
  try {
    // Load all data in parallel
    await Promise.all([
      initCustomerSupport(),
      loadOrders()
      // Note: Don't load shipping requests at startup since view is hidden
    ]);
  } catch (error) {
    console.error('Failed to load initial data:', error);
  } finally {
    if (appContainer) {
      hideLoader(appContainer, 'overlay');
    }
  }
  
  await switchView('customer-support');
}

document.addEventListener('DOMContentLoaded', ()=>{ initApp(); });
