import { api } from '../core/api.js';
import { state } from '../core/state.js';
import { FROM_ADDRESSES, PRODUCT_DIMENSIONS, FROM_ADDRESS_BOOK, PRODUCT_SPECS } from '../config/endpoints.js';

function ensureContainer(){
  let modal = document.getElementById('shipping-label-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id='shipping-label-modal';
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }
  return modal;
}

export async function openShippingLabelModal(email, orders = []){
  const modal = ensureContainer();
  if(Array.isArray(orders) && orders.length === 1){
    const orderNo = orders[0]?.['Order Number'];
    const exists = (state.shippingRequests||[]).some(r=> String(r.orderId) === String(orderNo));
    if(exists){
      const safeOrderNo = escapeHtml(orderNo || '');
      modal.style.display='flex';
      modal.innerHTML = `
        <div class="shipping-modal">
          <div class="shipping-modal__header">
            <div class="shipping-modal__header-section">
              <h3 class="shipping-modal__heading">Shipping Request</h3>
            </div>
            <div class="shipping-modal__header-section shipping-modal__header-section--right">
              <h3 class="shipping-modal__heading">Notice</h3>
              <button id="close-shipping-label-modal" class="shipping-modal__close" aria-label="Close" data-close-modal="shipping-label">&times;</button>
            </div>
          </div>
          <div class="shipping-modal__body">
            <div class="shipping-modal__column shipping-modal__column--details">
              <div class="shipping-modal__details">
                <p class="shipping-modal__message warning">Shipping Request has already been created for order <strong>${safeOrderNo}</strong>.</p>
              </div>
            </div>
          </div>
          <div class="shipping-modal__footer">
            <button type="button" class="shipping-modal__submit" data-close-modal="shipping-label">Close</button>
          </div>
        </div>`;
      modal.querySelectorAll('[data-close-modal="shipping-label"]').forEach(btn=>{
        btn?.addEventListener('click', ()=>{ modal.style.display='none'; });
      });
      return;
    }
  }

  modal.style.display='flex';
  modal.innerHTML = `
    <div class="shipping-modal">
      <div class="shipping-modal__header">
        <div class="shipping-modal__header-section">
          <h3 class="shipping-modal__heading">Shipping Request</h3>
        </div>
        <div class="shipping-modal__header-section shipping-modal__header-section--right">
          <h3 class="shipping-modal__heading">Recipient Details</h3>
          <button id="close-shipping-label-modal" class="shipping-modal__close" aria-label="Close" data-close-modal="shipping-label">&times;</button>
        </div>
      </div>
      <div class="shipping-modal__body">
        <form id="modal-shipping-label-form" class="shipping-modal__column shipping-modal__form">
          <div class="shipping-modal__card shipping-modal__card--service">
            <label for="modal-service-type">Shipping Service</label>
            <select id="modal-service-type" required>
              <option value="FEDEX_GROUND">FEDEX GROUND</option>
              <option value="UPS_GROUND">UPS GROUND</option>
            </select>
          </div>
          <div id="modal-order-no-group" class="form-group"></div>
          <div id="modal-from-address-group" class="form-group"></div>
          <div id="modal-product-dimensions-group" class="form-group"></div>
        </form>
        <div class="shipping-modal__column shipping-modal__column--details">
          <div id="modal-dynamic-address" class="shipping-modal__details"></div>
          <div id="modal-shipping-label-response" class="shipping-modal__message"></div>
        </div>
      </div>
      <div class="shipping-modal__footer">
        <button type="submit" form="modal-shipping-label-form" class="shipping-modal__submit">Create</button>
      </div>
    </div>`;

  modal.querySelectorAll('[data-close-modal="shipping-label"]').forEach(btn=>{
    btn?.addEventListener('click', ()=>{ modal.style.display='none'; });
  });

  buildOrderSelector(orders);
  buildStaticSelects();
  buildFromDetails();
  buildProductSpecs();

  const fromSel = modal.querySelector('#modal-from-address');
  if(fromSel && !fromSel.value && fromSel.options.length) fromSel.selectedIndex = 0;
  const prodSel = modal.querySelector('#modal-product-dimensions');
  if(prodSel && !prodSel.value && prodSel.options.length) prodSel.selectedIndex = 0;

  fillFromFromPreset();
  fillProductFromPreset();

  const form = modal.querySelector('#modal-shipping-label-form');
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const orderNo = document.getElementById('modal-order-no')?.value.trim();
    const respDiv = modal.querySelector('#modal-shipping-label-response');
    if(respDiv){
      respDiv.textContent = '';
      respDiv.classList.remove('success','warning','error');
    }

    const createBtn = modal.querySelector('button[form="modal-shipping-label-form"]');
    const originalBtnHtml = createBtn ? createBtn.innerHTML : '';
    if(createBtn){ createBtn.disabled = true; createBtn.innerHTML = '⏳ Creating…'; }

    const exists = (state.shippingRequests||[]).some(r=> String(r.orderId) === String(orderNo));
    if(exists){
      if(respDiv){
        respDiv.textContent = 'Shipping Request has already been created.';
        respDiv.classList.add('warning');
      }
      if(createBtn){ createBtn.disabled = false; createBtn.innerHTML = originalBtnHtml; }
      return;
    }

    const payload = buildShippingRequestPayload(orderNo, email);
    const required = [
      document.getElementById('modal-shipping-name')?.value,
      document.getElementById('modal-shipping-address1')?.value,
      document.getElementById('modal-shipping-city')?.value,
      document.getElementById('modal-shipping-state')?.value,
      document.getElementById('modal-shipping-country')?.value,
      document.getElementById('modal-shipping-zipcode')?.value,
      document.getElementById('modal-shipping-phone')?.value,
      document.getElementById('modal-shipping-email')?.value
    ];
    const missing = required.some(v=> !v || !String(v).trim());
    if(missing){
      if(respDiv){
        respDiv.textContent = 'Please fill all recipient fields.';
        respDiv.classList.add('error');
      }
      if(createBtn){ createBtn.disabled = false; createBtn.innerHTML = originalBtnHtml; }
      return;
    }

    try {
      const Name = document.getElementById('modal-shipping-name')?.value || '';
      const EmailAddr = document.getElementById('modal-shipping-email')?.value || '';
      const product = document.getElementById('modal-product-dimensions')?.value || '';
      const createdAtIso = new Date().toISOString();
      const meta = { date: createdAtIso, product, orderId: orderNo, Name, Email: EmailAddr };
      await api.createShippingLabel(payload, meta);
      if(respDiv){
        respDiv.textContent = 'Submitted successfully. Your label will be available shortly.';
        respDiv.classList.add('success');
      }
    } catch(err){
      if(respDiv){
        respDiv.textContent = 'Failed to submit.';
        respDiv.classList.add('error');
      }
    } finally {
      if(createBtn){ createBtn.disabled = false; createBtn.innerHTML = originalBtnHtml; }
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
    <div class="shipping-modal__grid">
      <div class="form-group"><label>Shipping Name</label><input type="text" id="modal-shipping-name" value="${order['Shipping Name']||''}"></div>
      <div class="form-group"><label>Address 1</label><input type="text" id="modal-shipping-address1" value="${order['Shipping Address 1']||''}"></div>
      <div class="form-group"><label>Address 2</label><input type="text" id="modal-shipping-address2" value="${order['Shipping Address 2']||''}"></div>
      <div class="form-group"><label>City</label><input type="text" id="modal-shipping-city" value="${order['Shipping City']||''}"></div>
      <div class="form-group"><label>State</label><input type="text" id="modal-shipping-state" value="${order['Shipping State']||''}"></div>
      <div class="form-group"><label>Country</label><input type="text" id="modal-shipping-country" value="${order['Shipping Country']||''}"></div>
      <div class="form-group"><label>Zipcode</label><input type="text" id="modal-shipping-zipcode" value="${order['Shipping Zipcode']||''}"></div>
      <div class="form-group"><label>Phone</label><input type="text" id="modal-shipping-phone" value="${order['Phone']||''}"></div>
      <div class="form-group"><label>Email</label><input type="email" id="modal-shipping-email" value="${order['Email']||''}"></div>
    </div>`;
}

function buildStaticSelects(){
  const fromGroup=document.getElementById('modal-from-address-group');
  if(fromGroup){
    fromGroup.innerHTML='';
    const label=document.createElement('label');
    label.setAttribute('for','modal-from-address');
    label.textContent='From Address Preset';
    const sel=document.createElement('select'); sel.id='modal-from-address';
    FROM_ADDRESSES.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o); });
    fromGroup.append(label, sel);
    const details=document.createElement('div'); details.id='modal-from-details'; details.className='shipping-modal__grid'; fromGroup.appendChild(details);
  }
  const prodGroup=document.getElementById('modal-product-dimensions-group');
  if(prodGroup){
    prodGroup.innerHTML='';
    const label=document.createElement('label');
    label.setAttribute('for','modal-product-dimensions');
    label.textContent='Product Dimensions';
    const sel=document.createElement('select'); sel.id='modal-product-dimensions';
    PRODUCT_DIMENSIONS.forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); });
    prodGroup.append(label, sel);
    const details=document.createElement('div'); details.id='modal-product-specs'; details.className='shipping-modal__grid'; prodGroup.appendChild(details);
  }
}

function buildFromDetails(){
  const host = document.getElementById('modal-from-details');
  if(!host) return;
  host.innerHTML = `
    <div class="form-group"><label>Full Name</label><input type="text" id="modal-from-fullName"></div>
    <div class="form-group"><label>Sender Name</label><input type="text" id="modal-from-senderName"></div>
    <div class="form-group"><label>Address 1</label><input type="text" id="modal-from-address1"></div>
    <div class="form-group"><label>Address 2</label><input type="text" id="modal-from-address2"></div>
    <div class="form-group"><label>City</label><input type="text" id="modal-from-city"></div>
    <div class="form-group"><label>State</label><input type="text" id="modal-from-state"></div>
    <div class="form-group"><label>Country</label><input type="text" id="modal-from-country"></div>
    <div class="form-group"><label>Zipcode</label><input type="text" id="modal-from-zipCode"></div>
    <div class="form-group"><label>Phone</label><input type="text" id="modal-from-phoneNumber"></div>`;
  const sel = document.getElementById('modal-from-address');
  if(sel){ sel.addEventListener('change', fillFromFromPreset); }
}

function buildProductSpecs(){
  const host = document.getElementById('modal-product-specs');
  if(!host) return;
  host.innerHTML = `
    <div class="form-group"><label>Length</label><input type="number" min="1" id="modal-prod-length"></div>
    <div class="form-group"><label>Width</label><input type="number" min="1" id="modal-prod-width"></div>
    <div class="form-group"><label>Height</label><input type="number" min="1" id="modal-prod-height"></div>
    <div class="form-group"><label>Weight</label><input type="number" min="1" id="modal-prod-weight"></div>`;
  const sel = document.getElementById('modal-product-dimensions');
  if(sel){ sel.addEventListener('change', fillProductFromPreset); }
}

function fillFromFromPreset(){
  const sel = document.getElementById('modal-from-address');
  const key = sel?.value;
  const rec = FROM_ADDRESS_BOOK.find(x=> x.fullName === key) || FROM_ADDRESS_BOOK[0];
  if(!rec) return;
  setVal('modal-from-fullName', rec.fullName);
  setVal('modal-from-senderName', rec.senderName);
  setVal('modal-from-address1', rec.address1);
  setVal('modal-from-address2', rec.address2 || '');
  setVal('modal-from-city', rec.city);
  setVal('modal-from-state', rec.state);
  setVal('modal-from-country', rec.country);
  setVal('modal-from-zipCode', rec.zipCode);
  setVal('modal-from-phoneNumber', rec.phoneNumber);
}

function fillProductFromPreset(){
  const sel = document.getElementById('modal-product-dimensions');
  const key = sel?.value;
  const spec = PRODUCT_SPECS[key] || PRODUCT_SPECS[Object.keys(PRODUCT_SPECS)[0]];
  if(!spec) return;
  setVal('modal-prod-length', spec.length);
  setVal('modal-prod-width', spec.width);
  setVal('modal-prod-height', spec.height);
  setVal('modal-prod-weight', spec.weight);
}

function buildShippingRequestPayload(order_no, email){
  const from = {
    zipCode: getVal('modal-from-zipCode'),
    fullName: getVal('modal-from-fullName'),
    senderName: getVal('modal-from-senderName'),
    address1: getVal('modal-from-address1'),
    city: getVal('modal-from-city'),
    state: getVal('modal-from-state'),
    country: getVal('modal-from-country'),
    address2: getVal('modal-from-address2'),
    phoneNumber: getVal('modal-from-phoneNumber')
  };
  const to = {
    zipCode: getVal('modal-shipping-zipcode'),
    fullName: getVal('modal-shipping-name'),
    address1: getVal('modal-shipping-address1'),
    city: getVal('modal-shipping-city'),
    state: getVal('modal-shipping-state'),
    country: getVal('modal-shipping-country'),
    Address2: getVal('modal-shipping-address2'),
    phoneNumber: getVal('modal-shipping-phone')
  };
  const pkg = {
    weight: toNum('modal-prod-weight'),
    height: toNum('modal-prod-height'),
    width: toNum('modal-prod-width'),
    length: toNum('modal-prod-length')
  };
  // requestId + shipDate per provided logic
  const requestId = (()=>{
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
  })();
  const createdAtIso = new Date().toISOString();
  const shipDate = createdAtIso.split('T')[0];
  
  // Get service type from dropdown and calculate channel
  const serviceType = getVal('modal-service-type') || 'FEDEX_GROUND';
  const channel = serviceType === 'UPS_GROUND' ? 'GENERAL' : 'NJF';
  
  return [{
    requestId,
    shipDate,
    createdAt: createdAtIso,
    serviceType: serviceType,
    channel: channel,
    signature: 'NO_SIGNATURE_REQUIRED',
    reference: 'ref-example',
    from,
    to,
    packages: [pkg]
  }];
}

function escapeHtml(str=''){
  return str.replace(/["&'<>]/g, c=>({
    '"':'&quot;','&':'&amp;','\'':'&#39;','<' :'&lt;','>' :'&gt;'
  })[c]||c);
}

function setVal(id, v){ const el=document.getElementById(id); if(el) el.value = v ?? ''; }
function getVal(id){ return (document.getElementById(id)?.value || '').trim(); }
function toNum(id){ const n=parseFloat(getVal(id)); return Number.isFinite(n) ? n : undefined; }
