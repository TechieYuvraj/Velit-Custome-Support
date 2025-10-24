import { PRODUCT_DIMENSIONS, FROM_ADDRESSES, FROM_ADDRESS_BOOK, PRODUCT_SPECS } from '../config/endpoints.js';
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

        <div class="form-row" style="background:#e8f5f0;padding:12px;border-radius:8px;border:2px solid #4a9d7a;margin:16px 0;">
          <label style="display:block;font-size:.75rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#2e4d43;margin-bottom:6px;">🚚 SHIPPING SERVICE TYPE:</label>
          <select id="sr-service-type" required style="padding:10px 12px;border:2px solid #4a9d7a;border-radius:8px;background:#ffffff;font-size:.85rem;font-weight:600;width:100%;cursor:pointer;box-sizing:border-box;color:#2e4d43;appearance:auto;">
            <option value="FEDEX_GROUND">FEDEX GROUND</option>
            <option value="UPS_GROUND">UPS GROUND</option>
          </select>
        </div>

        <h4 style="margin-top:12px">From</h4>
        <div class="form-row"><label>Preset:</label>${selectHtml('sr-from-address', FROM_ADDRESSES)}</div>
        <div class="form-row"><label>Full Name:</label><input type="text" id="sr-from-fullname" /></div>
        <div class="form-row"><label>Sender Name:</label><input type="text" id="sr-from-sender" /></div>
        <div class="form-row"><label>Address 1:</label><input type="text" id="sr-from-address1" /></div>
        <div class="form-row"><label>Address 2:</label><input type="text" id="sr-from-address2" /></div>
        <div class="form-row"><label>City:</label><input type="text" id="sr-from-city" /></div>
        <div class="form-row"><label>State:</label><input type="text" id="sr-from-state" /></div>
        <div class="form-row"><label>Country:</label><input type="text" id="sr-from-country" /></div>
        <div class="form-row"><label>Zipcode:</label><input type="text" id="sr-from-zip" /></div>
        <div class="form-row"><label>Phone:</label><input type="text" id="sr-from-phone" /></div>

        <h4 style="margin-top:16px;margin-bottom:12px;font-size:15px;font-weight:600;color:#2e4d43;">To (Recipient Details)</h4>
        
        <div class="form-row"><label>Full Name:</label><input type="text" id="sr-to-fullname" value="${order.name || order.Name || ''}" /></div>
        <div class="form-row"><label>Address 1:</label><input type="text" id="sr-to-address1" value="${order.address?.line1 || ''}" /></div>
        <div class="form-row"><label>Address 2:</label><input type="text" id="sr-to-address2" value="${order.address?.line2 || ''}" /></div>
        <div class="form-row"><label>City:</label><input type="text" id="sr-to-city" value="${order.address?.city || ''}" /></div>
        <div class="form-row"><label>State:</label><input type="text" id="sr-to-state" value="${order.address?.state || ''}" /></div>
        <div class="form-row"><label>Country:</label><input type="text" id="sr-to-country" value="${order.address?.country || ''}" /></div>
        <div class="form-row"><label>Zipcode:</label><input type="text" id="sr-to-zip" value="${order.address?.zip || ''}" /></div>
        <div class="form-row"><label>Phone:</label><input type="text" id="sr-to-phone" value="${order.phone || ''}" /></div>

        <h4 style="margin-top:12px">Package</h4>
        <div class="form-row"><label>Preset:</label>${selectHtml('sr-product-dim', PRODUCT_DIMENSIONS)}</div>
        <div class="form-row"><label>Length:</label><input type="number" id="sr-length" min="1" /></div>
        <div class="form-row"><label>Width:</label><input type="number" id="sr-width" min="1" /></div>
        <div class="form-row"><label>Height:</label><input type="number" id="sr-height" min="1" /></div>
        <div class="form-row"><label>Weight:</label><input type="number" id="sr-weight" min="1" /></div>

  <div class="form-row"><label>Note:</label><textarea id="sr-note" rows="2" placeholder="Optional note to include with the request..."></textarea></div>
        <div class="form-actions" style="margin-top:14px;display:flex;gap:12px;align-items:center;">
          <button type="submit" id="sr-submit" class="primary-action">Submit Request</button>
          <span id="sr-status-msg" style="font-size:13px;color:#555;"></span>
        </div>
      </form>
    </div>`;
  modal.querySelector('#close-ship-request').onclick=()=> modal.style.display='none';
  // Prefill From inputs from preset
  const fromSelect = document.getElementById('sr-from-address');
  const fillFrom = (key)=>{
    const rec = FROM_ADDRESS_BOOK.find(x=> x.fullName === key) || FROM_ADDRESS_BOOK[0];
    if(!rec) return;
    setVal('sr-from-fullname', rec.fullName);
    setVal('sr-from-sender', rec.senderName);
    setVal('sr-from-address1', rec.address1);
    setVal('sr-from-address2', rec.address2 || '');
    setVal('sr-from-city', rec.city);
    setVal('sr-from-state', rec.state);
    setVal('sr-from-country', rec.country);
    setVal('sr-from-zip', rec.zipCode);
    setVal('sr-from-phone', rec.phoneNumber);
  };
  fillFrom(fromSelect.value);
  fromSelect.addEventListener('change', ()=> fillFrom(fromSelect.value));

  // Prefill Package from preset
  const prodSelect = document.getElementById('sr-product-dim');
  const fillPkg = (key)=>{
    const spec = PRODUCT_SPECS[key] || PRODUCT_SPECS[Object.keys(PRODUCT_SPECS)[0]];
    if(!spec) return;
    setVal('sr-length', spec.length);
    setVal('sr-width', spec.width);
    setVal('sr-height', spec.height);
    setVal('sr-weight', spec.weight);
  };
  fillPkg(prodSelect.value);
  prodSelect.addEventListener('change', ()=> fillPkg(prodSelect.value));

  modal.querySelector('#ship-request-form').addEventListener('submit', handleSubmit);
}

function selectHtml(id, options){
  return `<select id="${id}">` + options.map(o=>`<option value="${o}">${o}</option>`).join('') + '</select>';
}

async function handleSubmit(e){
  e.preventDefault();
  const submitBtn = document.getElementById('sr-submit');
  const statusMsg = document.getElementById('sr-status-msg');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if(submitBtn){ submitBtn.disabled = true; submitBtn.innerHTML = '⏳ Submitting…'; }
  const order_no = document.getElementById('sr-order-no').value.trim();
  const email = document.getElementById('sr-email').value.trim();
  const prodKey = document.getElementById('sr-product-dim').value.trim();
  const fromKey = document.getElementById('sr-from-address').value.trim();
  const note = document.getElementById('sr-note').value.trim();
  const serviceType = document.getElementById('sr-service-type').value.trim();
  
  // Set channel based on service type
  const channel = serviceType === 'UPS_GROUND' ? 'GENERAL' : 'NJF';
  
  statusMsg.textContent='';

  // Prevent duplicate shipping requests for same order
  const exists = (state.shippingRequests||[]).some(r=> String(r.orderId) === String(order_no));
  if(exists){
    statusMsg.innerHTML = '<span style="color:#b26a00;">Shipping Request has been already created.</span>';
    if(submitBtn){ submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; }
    return;
  }

  // Optional small UX pause to show loader
  await new Promise(r=> setTimeout(r,500));

  // Build payload per required JSON spec
  const from = {
    zipCode: val('sr-from-zip'),
    fullName: val('sr-from-fullname'),
    senderName: val('sr-from-sender'),
    address1: val('sr-from-address1'),
    city: val('sr-from-city'),
    state: val('sr-from-state'),
    country: val('sr-from-country'),
    extension: val('sr-from-address2'),
    phoneNumber: val('sr-from-phone')
  };
  const to = {
    zipCode: val('sr-to-zip'),
    fullName: val('sr-to-fullname'),
    address1: val('sr-to-address1'),
    city: val('sr-to-city'),
    state: val('sr-to-state'),
    country: val('sr-to-country'),
    address2: val('sr-to-address2'),
    phoneNumber: val('sr-to-phone')
  };
  const pkg = {
    weight: num('sr-weight'),
    height: num('sr-height'),
    width: num('sr-width'),
    length: num('sr-length')
  };
  // Provided requestId logic and shipDate
  function generateRequestId(){
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const rnd = Math.floor(Math.random() * 900 + 100);
    return `${dd}${mm}${yyyy}${hh}${min}${ss}${ms}${dd}${rnd}`;
  }
  const createdAtIso = new Date().toISOString();
  const shipDate = createdAtIso.split('T')[0];
  const requestId = generateRequestId();
  const payload = [{
    requestId,
    shipDate,
    createdAt: createdAtIso,
    serviceType: serviceType,
    channel: channel,
    signature: 'NO_SIGNATURE_REQUIRED',
    reference: 'ref-example',
    note,
    from,
    to,
    packages: [pkg]
  }];
  try {
    const meta = {
      date: createdAtIso,
      product: prodKey,
      orderId: order_no,
      Name: to.fullName || '',
      Email: email,
      note
    };
    await api.createShippingLabel(payload, meta); // ignoring response per spec
    statusMsg.innerHTML = '<span style="color:#195744;font-weight:600;">Request queued. Appears live in list in ~40s.</span>';
    const placeholderId = `pending-${Date.now()}`;
    const createdAt = Date.now();
    const etaMs = 40000;
    const tempItem = { id: placeholderId, orderId: order_no, email, name: to.fullName || '', status:'pending', createdAt, address:'', product: prodKey, from, pkg, note, _etaExpires: createdAt + etaMs };
    updateArray('shippingRequests', arr=> [tempItem, ...arr]);
    scheduleDelayedInsert({ order_no, email, product_dimensions: prodKey, from_address: fromKey, from, pkg, created_at: new Date().toISOString(), note }, placeholderId);
  } catch(err){
    statusMsg.innerHTML = '<span style="color:#b00020;">Failed to submit.</span>';
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; }
  }
}

function scheduleDelayedInsert(item, placeholderId){
  setTimeout(()=>{
    updateArray('shippingRequests', arr=> {
      const filtered = arr.filter(r=> r.id !== placeholderId);
      const normalized = { id: item.order_no || `REQ-${Date.now()}`, orderId: item.order_no, email: item.email, status:'open', createdAt: Date.now(), address:'', name:'', product: item.product_dimensions, from: item.from, pkg: item.pkg, note: item.note };
      return [normalized, ...filtered];
    });
  }, 40000); // 40s
}

function setVal(id, v){ const el=document.getElementById(id); if(el) el.value = v ?? ''; }
function val(id){ return (document.getElementById(id)?.value || '').trim(); }
function num(id){ const n = parseFloat(val(id)); return Number.isFinite(n) ? n : undefined; }
