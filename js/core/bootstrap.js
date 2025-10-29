import { loadCustomerSupport } from '../views/customerSupportView.js';
import { attachConversationListHandlers } from '../components/conversationDetail.js';
import { state, setState } from './state.js';
import { loadOrders, attachOrderHistoryHandlers } from '../views/orderHistoryView.js';
import { initShippingRequestsView } from '../views/shippingRequestsView.js';
import { showLoader, hideLoader, withButtonLoader } from '../utils/loader.js';
import { initTicketsView } from '../views/ticketsView.js';
import { initAuth, isLoggedIn } from './auth.js';

// Track which views have been loaded
const viewsLoaded = {
  'order-history': false,
  'shipping-requests': false,
  'customer-support': false,
  'tickets': false
};

// Define loading sequence
const LOAD_SEQUENCE = ['tickets', 'customer-support', 'shipping-requests', 'order-history'];
let currentLoadIndex = 0;

function isoRange(fromDate, toDate){
  return [fromDate + 'T00:00:00Z', toDate + 'T23:59:59Z'];
}

// Function to load next view in sequence
async function loadNextView() {
  if (currentLoadIndex >= LOAD_SEQUENCE.length) return;
  
  const viewToLoad = LOAD_SEQUENCE[currentLoadIndex];
  const section = document.getElementById(`view-${viewToLoad}`);
  
  if (!viewsLoaded[viewToLoad]) {
    console.log(`🔄 Sequential loading: Loading ${viewToLoad}...`);
    try {
      switch(viewToLoad) {
        case 'tickets':
          await initTicketsView();
          break;
        case 'customer-support':
          await loadCustomerSupport();
          break;
        case 'order-history':
          await loadOrders();
          break;
        case 'shipping-requests':
          await initShippingRequestsView();
          break;
      }
      viewsLoaded[viewToLoad] = true;
      console.log(`✅ Loaded ${viewToLoad} successfully`);
    } catch(err) {
      console.error(`Failed to load ${viewToLoad}:`, err);
    }
  }
  
  currentLoadIndex++;
  // Load next view after a short delay
  if (currentLoadIndex < LOAD_SEQUENCE.length) {
    setTimeout(loadNextView, 800); // 800ms delay between loads
  }
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
  
  // Lazy loading: Only load data if view hasn't been loaded yet
  if(view==='order-history' && !viewsLoaded['order-history']){ 
    showLoader(currentSection, 'overlay');
    try {
      await loadOrders();
      viewsLoaded['order-history'] = true;
    } catch(err) {
      console.error('Failed to load orders:', err);
    } finally {
      hideLoader(currentSection, 'overlay');
    }
  }
  
  if(view==='shipping-requests' && !viewsLoaded['shipping-requests']){ 
    showLoader(currentSection, 'overlay');
    try {
      await initShippingRequestsView();
      viewsLoaded['shipping-requests'] = true;
    } catch(err) {
      console.error('Failed to load shipping requests:', err);
    } finally {
      hideLoader(currentSection, 'overlay');
    }
  }
  
  if(view==='customer-support' && !viewsLoaded['customer-support']){
    showLoader(currentSection, 'overlay');
    try {
      await loadCustomerSupport();
      viewsLoaded['customer-support'] = true;
    } catch(err) {
      console.error('Failed to load customer support:', err);
    } finally {
      hideLoader(currentSection, 'overlay');
    }
  }
  
  if(view==='tickets' && !viewsLoaded['tickets']){
    showLoader(currentSection, 'overlay');
    try { 
      await initTicketsView();
      viewsLoaded['tickets'] = true;
    } catch(err) {
      console.error('Failed to load tickets:', err);
    } finally { 
      hideLoader(currentSection, 'overlay'); 
    }
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
      // Stats bar removed from UI
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
  // Initialize auth system first
  initAuth();

  // Only initialize app features if logged in
  if (isLoggedIn()) {
    // Set up UI handlers first
    bindNav();
    attachConversationListHandlers();
    attachOrderHistoryHandlers();
    bindCustomerSupportSubNav();
    bindFilters();

    console.log('🚀 App initialized - Sequential loading enabled');
    
    // Show tickets view as default
    await switchView('tickets');
    
    // Start sequential loading of all views
    // This will load in order: tickets → channels → orders → shipping
    requestAnimationFrame(() => {
      loadNextView();
    });
  }
}

document.addEventListener('DOMContentLoaded', ()=>{ initApp(); });
