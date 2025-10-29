import { state, setState } from '../core/state.js';
import { api } from '../core/api.js';
import { formatDate, extractNameFromEmail } from '../utils/format.js';
import { showLoader, hideLoader } from '../utils/loader.js';
import { showServerErrorModal } from '../utils/errorModal.js';

const DEFAULT_FROM = '2024-01-01T00:00:00Z';
const DEFAULT_TO = '2025-09-16T23:59:59Z';

// Entry used by bootstrap
export async function loadCustomerSupport(fromDateISO = DEFAULT_FROM, toDateISO = DEFAULT_TO){
  const section = document.getElementById('view-customer-support');
  
  try {
    showLoading();
    if(section) showLoader(section, 'overlay');
    
    const data = await api.fetchConversations(fromDateISO, toDateISO);
    
    // Handle new Firestore document structure
    const normalizedData = normalizeFirestoreResponse(data);
    
    // Sort by updated_at or started_at in descending order (newest first)
    normalizedData.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.started_at || 0);
      const dateB = new Date(b.updated_at || b.started_at || 0);
      return dateB - dateA; // Descending order
    });
    
    const emailConversations = normalizedData.filter(c => c.channel_type === 'email');
    const crmConversations = normalizedData.filter(c => c.channel_type === 'inapp_public');
    
    setState({ conversations: normalizedData, emailConversations, crmConversations });
    renderEmailList();
    renderCRMList();
    updateEmailStats();
  } catch(err){
    console.warn('Failed to load conversations', err);
    showError();
    // Show error modal popup
    showServerErrorModal('Failed to load customer support conversations. Server not responding.', () => loadCustomerSupport(fromDateISO, toDateISO));
  } finally {
    if(section) hideLoader(section, 'overlay');
  }
}

// Normalize Firestore document response to flat structure
function normalizeFirestoreResponse(data) {
  if (!data) return [];
  const docs = Array.isArray(data) ? data : [data];
  
  return docs.map(item => {
    // Helper to extract value from Firestore field type
    const val = (field) => {
      if (!field || typeof field !== 'object') return field;
      if ('stringValue' in field) return field.stringValue;
      if ('integerValue' in field) return String(field.integerValue);
      if ('doubleValue' in field) return String(field.doubleValue);
      if ('booleanValue' in field) return field.booleanValue;
      if ('timestampValue' in field) return field.timestampValue;
      if ('nullValue' in field) return null;
      return field;
    };
    
    // New format: fields are directly on the object with typed values
    if (item.session_id || item.email || item.contact_id) {
      // Generate conversation_id from contact_id or random if not available
      const conversationId = val(item.contact_id) || Math.random().toString(36).substr(2, 9);
      
      return {
        conversation_id: conversationId,
        channel_type: val(item.channel_type) || '',
        session_id: val(item.session_id) || '',
        name: val(item.name) || '',
        email: val(item.email) || '',
        subject: val(item.subject) || '',
        contact_id: val(item.contact_id) || '',
        started_at: val(item.createdAt) || val(item.started_at),
        updated_at: val(item.updatedAt) || val(item.updated_at),
        status: val(item.status) || 'Unknown',
        messages: [] // Messages will be fetched separately when conversation is selected
      };
    }
    
    // Old format: nested under document.fields
    if (item.document && item.document.fields) {
      const fields = item.document.fields;
      const docName = item.document.name || '';
      const conversationId = docName.split('/').pop() || Math.random().toString(36).substr(2, 9);
      
      return {
        conversation_id: conversationId,
        channel_type: val(fields.channel_type) || '',
        session_id: val(fields.session_id) || '',
        name: val(fields.name) || '',
        email: val(fields.email) || '',
        subject: val(fields.subject) || '',
        contact_id: val(fields.contact_id) || '',
        started_at: val(fields.started_at) || val(fields.createdAt) || item.document.createTime,
        updated_at: val(fields.updated_at) || val(fields.updatedAt) || item.document.updateTime,
        status: val(fields.status) || 'Unknown',
        messages: [] // Messages will be fetched separately when conversation is selected
      };
    }
    
    // Fallback: return as-is if already in flat structure (backward compatibility)
    return item;
  }).filter(Boolean);
}

export function renderEmailList(){
  const host = document.getElementById('email-conversations');
  if(!host) return;
  const list = state.emailConversations || [];
  if(!list.length){ host.innerHTML = '<div class="no-data">No conversations</div>'; return; }
  host.innerHTML = list.map(emailItemHtml).join('');
}

export function renderCRMList(){
  const host = document.getElementById('crm-conversations');
  if(!host) return;
  const list = state.crmConversations || [];
  if(!list.length){ host.innerHTML = '<div class="no-data">No conversations</div>'; return; }
  host.innerHTML = list.map(crmItemHtml).join('');
}

// Email row: Name, Email, Subject, Create Time, Update Time
function emailItemHtml(conv){
  const name = conv.name || extractNameFromEmail(conv.email || '') || 'Unknown';
  const email = conv.email || '';
  const createDate = formatDate(conv.started_at);
  const updateDate = formatDate(conv.updated_at);
  const subject = conv.subject || 'No subject';
  
  return `<div class="conversation-item" data-id="${conv.conversation_id}" data-type="email">
    <div class="conversation-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div class="conversation-name" style="font-weight:600;">${escapeHtml(name)}</div>
        <div class="conversation-email" style="font-size:11px;color:#456;margin-top:2px;">${escapeHtml(email)}</div>
        <div class="conversation-subject" style="margin-top:4px;font-size:12px;color:#333;">${escapeHtml(subject)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="conversation-dates" style="font-size:10px;color:#567;text-align:right;line-height:1.3;">
          <div>Created: ${createDate}</div>
          <div>Updated: ${updateDate}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// CRM row: Session_Id, Subject, Date
function crmItemHtml(conv){
  const session = conv.session_id || 'Session';
  const subject = conv.subject || 'No subject';
  const date = formatDate(conv.started_at);
  return `<div class="conversation-item" data-id="${conv.conversation_id}" data-type="crm">
    <div class="conversation-header" style="display:flex;justify-content:space-between;gap:8px;">
      <div class="conversation-name" style="font-weight:600;">${escapeHtml(session)}</div>
      <div class="conversation-date" style="font-size:11px;color:#567;">${date}</div>
    </div>
    <div class="conversation-subject" style="margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(subject)}</div>
  </div>`;
}

function updateEmailStats(){
  // Stats logic kept for potential future use, but not displayed
  // Remove this function call from loadCustomerSupport if stats are permanently removed
  const list = state.emailConversations || [];
  const total = list.length;
  const open = list.filter(c => (c.status||'').toLowerCase()==='open').length;
  const closed = list.filter(c => (c.status||'').toLowerCase()==='closed').length;
  const pending = list.filter(c => !c.status).length;
  // Stats elements removed from HTML - no longer displaying
  // setStat('cs-total', total);
  // setStat('cs-open', open);
  // setStat('cs-closed', closed);
  // setStat('cs-pending', pending);
}

function setStat(id, val){ const el=document.getElementById(id); if(el) el.textContent = val; }

function showLoading(){
  const email = document.getElementById('email-conversations');
  const crm = document.getElementById('crm-conversations');
  if(email) showLoader(email, 'section', 'Loading conversations...');
  if(crm) showLoader(crm, 'section', 'Loading conversations...');
}

function showError(){
  const email = document.getElementById('email-conversations');
  const crm = document.getElementById('crm-conversations');
  if(email) email.innerHTML = '<div class="section-loader"><div style="color:#e74c3c;">❌ Failed to load conversations</div></div>';
  if(crm) crm.innerHTML = '<div class="section-loader"><div style="color:#e74c3c;">❌ Failed to load conversations</div></div>';
}

function escapeHtml(str){
  const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' };
  return (str||'').replace(/[&<>"']/g, ch => map[ch] || ch);
}
