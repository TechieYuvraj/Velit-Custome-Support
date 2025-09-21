import { api } from '../core/api.js';
import { FROM_ADDRESSES, PRODUCT_DIMENSIONS } from '../config/endpoints.js';

function ensureContainer(){
  let modal = document.getElementById('shipping-label-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id='shipping-label-modal';
    modal.style.cssText='display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);z-index:2000;align-items:center;justify-content:center;';
    document.body.appendChild(modal);
  }
  return modal;
}

export async function openShippingLabelModal(email, orders = [], labelHistory = []){
  const modal = ensureContainer();
  modal.style.display='flex';
  modal.innerHTML = `
    <div style="display:flex;width:90%;max-width:960px;height:80%;background:#fff;border-radius:12px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.15);">
      <div style="flex:1;padding:20px 16px 20px 20px;border-right:1px solid #eee;overflow-y:auto;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">Label History</h3>
        <div id="modal-label-history-list">${labelHistory.length ? renderLabelHistory(labelHistory) : 'No history'}</div>
      </div>
      <div style="flex:1;padding:20px 20px 20px 16px;overflow-y:auto;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">Generate Shipping Label</h3>
        <form id="modal-shipping-label-form">
          <div id="modal-order-no-group"></div>
          <div id="modal-dynamic-address"></div>
          <div class="form-group" id="modal-from-address-group"></div>
          <div class="form-group" id="modal-product-dimensions-group"></div>
          <button type="submit" class="primary-action" style="margin-top:16px;">Generate Label</button>
        </form>
        <div id="modal-shipping-label-response" style="margin-top:14px;font-size:13px;"></div>
      </div>
      <button id="close-shipping-label-modal" aria-label="Close" style="position:absolute;top:8px;right:10px;font-size:22px;background:none;border:none;cursor:pointer;color:#444;">&times;</button>
    </div>`;

  modal.querySelector('#close-shipping-label-modal').onclick=()=>{ modal.style.display='none'; };

  buildOrderSelector(orders);
  buildStaticSelects();

  modal.querySelector('#modal-shipping-label-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const orderNo = document.getElementById('modal-order-no')?.value.trim();
    const payload = collectAddressPayload(orderNo, email);
    const respDiv = document.getElementById('modal-shipping-label-response');
    respDiv.textContent='Generating label...';
    try {
      await api.createShippingLabel(payload); // spec: ignore body
      respDiv.innerHTML='<span style="color:#195744;font-weight:600;">Label request submitted.</span>';
      // Optionally refresh history after delay
      setTimeout(async ()=>{
        try { const hist = await api.fetchLabelHistory(email); document.getElementById('modal-label-history-list').innerHTML = renderLabelHistory(Array.isArray(hist)?hist:[hist]); } catch{}
      }, 1500);
    } catch(err){
      respDiv.innerHTML = '<span style="color:#b00020;">Failed to submit label.</span>';
    }
  });
}

function buildOrderSelector(orders){
  const group = document.getElementById('modal-order-no-group');
  if(!group) return;
  group.innerHTML='';
  const label = document.createElement('label');
  label.textContent='Order No:';
  label.setAttribute('for','modal-order-no');
  group.appendChild(label);
  if(orders.length>1){
    const sel=document.createElement('select'); sel.id='modal-order-no';
    orders.forEach(o=>{ const opt=document.createElement('option'); opt.value=o['Order Number']; opt.textContent=o['Order Number']; sel.appendChild(opt); });
    group.appendChild(sel);
    sel.addEventListener('change',()=>renderAddressFields(orders.find(o=>o['Order Number']==sel.value)));
    renderAddressFields(orders[0]);
  } else {
    const inp=document.createElement('input'); inp.type='text'; inp.id='modal-order-no'; inp.value=orders[0]?.['Order Number']||''; group.appendChild(inp);
    renderAddressFields(orders[0]||{});
  }
}

function renderAddressFields(order={}){
  const host=document.getElementById('modal-dynamic-address');
  if(!host) return;
  host.innerHTML = `
    <div class="form-group"><label>Shipping Name:</label><input type="text" id="modal-shipping-name" value="${order['Shipping Name']||''}"></div>
    <div class="form-group"><label>Address 1:</label><input type="text" id="modal-shipping-address1" value="${order['Shipping Address 1']||''}"></div>
    <div class="form-group"><label>Address 2:</label><input type="text" id="modal-shipping-address2" value="${order['Shipping Address 2']||''}"></div>
    <div class="form-group"><label>City:</label><input type="text" id="modal-shipping-city" value="${order['Shipping City']||''}"></div>
    <div class="form-group"><label>State:</label><input type="text" id="modal-shipping-state" value="${order['Shipping State']||''}"></div>
    <div class="form-group"><label>Country:</label><input type="text" id="modal-shipping-country" value="${order['Shipping Country']||''}"></div>
    <div class="form-group"><label>Zipcode:</label><input type="text" id="modal-shipping-zipcode" value="${order['Shipping Zipcode']||''}"></div>
    <div class="form-group"><label>Phone:</label><input type="text" id="modal-shipping-phone" value="${order['Phone']||''}"></div>
    <div class="form-group"><label>Email:</label><input type="text" id="modal-shipping-email" value="${order['Email']||''}"></div>`;
}

function buildStaticSelects(){
  const fromGroup=document.getElementById('modal-from-address-group');
  if(fromGroup){
    fromGroup.innerHTML='<label for="modal-from-address">From Address:</label>'; const sel=document.createElement('select'); sel.id='modal-from-address'; FROM_ADDRESSES.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o); }); fromGroup.appendChild(sel);
  }
  const prodGroup=document.getElementById('modal-product-dimensions-group');
  if(prodGroup){
    prodGroup.innerHTML='<label for="modal-product-dimensions">Product Dimensions:</label>'; const sel=document.createElement('select'); sel.id='modal-product-dimensions'; PRODUCT_DIMENSIONS.forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); }); prodGroup.appendChild(sel);
  }
}

function collectAddressPayload(order_no, email){
  return {
    order_no,
    shipping_name: document.getElementById('modal-shipping-name')?.value.trim()||'',
    address_1: document.getElementById('modal-shipping-address1')?.value.trim()||'',
    address_2: document.getElementById('modal-shipping-address2')?.value.trim()||'',
    city: document.getElementById('modal-shipping-city')?.value.trim()||'',
    state: document.getElementById('modal-shipping-state')?.value.trim()||'',
    country: document.getElementById('modal-shipping-country')?.value.trim()||'',
    zipcode: document.getElementById('modal-shipping-zipcode')?.value.trim()||'',
    phone: document.getElementById('modal-shipping-phone')?.value.trim()||'',
    email: document.getElementById('modal-shipping-email')?.value.trim()|| email || '',
    product_dimensions: document.getElementById('modal-product-dimensions')?.value.trim()||'',
    from_address: document.getElementById('modal-from-address')?.value.trim()||''
  };
}

export function renderLabelHistory(history){
  if(!history || !history.length) return '<p>No label history found.</p>';
  return history.map(label=>{
    const tracking = label.trackingNumber || 'N/A';
    const url = label.url;
    return `<div class="label-history-bar"><span class="tracking-number">Tracking: <strong>${tracking}</strong></span>${url?` <button class="label-url-btn" onclick="window.open('${url}','_blank')">View Label</button>`:''}</div>`;
  }).join('');
}
