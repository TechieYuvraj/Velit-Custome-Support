import { PRODUCT_DIMENSIONS, FROM_ADDRESSES } from '../config/endpoints.js';
import { state, updateArray } from '../core/state.js';
import { api } from '../core/api.js';

function ensureModal(){
  let m=document.getElementById('ship-request-modal');
  if(!m){
    m=document.createElement('div');
    m.id='ship-request-modal';
    m.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2100;align-items:center;justify-content:center;';
    document.body.appendChild(m);
  }
  return m;
}

export function openShipRequestModal(prefillOrder){
  const modal = ensureModal();
  modal.style.display='flex';
  const order = prefillOrder || {};
  modal.innerHTML = `
    <div class="ship-modal-shell" style="background:#fff;padding:28px 24px;border-radius:14px;width:520px;max-width:92vw;position:relative;box-shadow:0 8px 40px rgba(0,0,0,.18);">
      <button id="close-ship-request" aria-label="Close" style="position:absolute;top:8px;right:10px;font-size:20px;border:none;background:none;cursor:pointer">&times;</button>
      <h3 style="margin:0 0 12px;font-size:18px;font-weight:600;">Create Shipping Request</h3>
      <form id="ship-request-form">
        <div class="form-row"><label>Order No:</label><input type="text" id="sr-order-no" value="${order['Order Number']|| order.id || ''}" required /></div>
        <div class="form-row"><label>Email:</label><input type="email" id="sr-email" value="${order.Email || order.email || ''}" /></div>
        <div class="form-row"><label>From Address:</label>${selectHtml('sr-from-address', FROM_ADDRESSES)}</div>
        <div class="form-row"><label>Product Dimensions:</label>${selectHtml('sr-product-dim', PRODUCT_DIMENSIONS)}</div>
        <div class="form-row"><label>Notes:</label><textarea id="sr-notes" rows="2" placeholder="Optional internal notes..."></textarea></div>
        <div class="form-actions" style="margin-top:14px;display:flex;gap:12px;align-items:center;">
          <button type="submit" id="sr-submit" class="primary-action">Submit Request</button>
          <span id="sr-status-msg" style="font-size:13px;color:#555;"></span>
        </div>
      </form>
    </div>`;
  modal.querySelector('#close-ship-request').onclick=()=> modal.style.display='none';
  modal.querySelector('#ship-request-form').addEventListener('submit', handleSubmit);
}

function selectHtml(id, options){
  return `<select id="${id}">` + options.map(o=>`<option value="${o}">${o}</option>`).join('') + '</select>';
}

async function handleSubmit(e){
  e.preventDefault();
  const submitBtn = document.getElementById('sr-submit');
  const statusMsg = document.getElementById('sr-status-msg');
  submitBtn.disabled = true;
  const order_no = document.getElementById('sr-order-no').value.trim();
  const email = document.getElementById('sr-email').value.trim();
  const product_dimensions = document.getElementById('sr-product-dim').value.trim();
  const from_address = document.getElementById('sr-from-address').value.trim();
  const notes = document.getElementById('sr-notes').value.trim();
  statusMsg.textContent='Submitting (2s)...';

  // Artificial 2s loader
  await new Promise(r=> setTimeout(r,2000));

  const payload = { order_no, email, product_dimensions, from_address, notes };
  try {
    await api.createShippingLabel(payload); // ignoring response per spec
    statusMsg.innerHTML = '<span style="color:#195744;font-weight:600;">Request queued. Appears live in list in ~40s.</span>';
    const placeholderId = `pending-${Date.now()}`;
    const createdAt = Date.now();
    const etaMs = 40000;
    const tempItem = { id: placeholderId, orderNo: order_no, email, name:'', status:'pending', createdAt, address:'', _etaExpires: createdAt + etaMs };
    updateArray('shippingRequests', arr=> [tempItem, ...arr]);
    scheduleDelayedInsert({ order_no, email, product_dimensions, from_address, created_at: new Date().toISOString() }, placeholderId);
  } catch(err){
    statusMsg.innerHTML = '<span style="color:#b00020;">Failed to submit.</span>';
  } finally {
    submitBtn.disabled = false;
  }
}

function scheduleDelayedInsert(item, placeholderId){
  setTimeout(()=>{
    updateArray('shippingRequests', arr=> {
      const filtered = arr.filter(r=> r.id !== placeholderId);
      const normalized = { id: item.order_no || `REQ-${Date.now()}`, orderNo: item.order_no, email: item.email, status:'open', createdAt: Date.now(), address:'', name:'' };
      return [normalized, ...filtered];
    });
  }, 40000); // 40s
}
