import { state, setState } from '../core/state.js';
import { api } from '../core/api.js';
import { formatDate, extractNameFromEmail } from '../utils/format.js';

const DEFAULT_FROM = '2024-01-01T00:00:00Z';
const DEFAULT_TO = '2025-09-16T23:59:59Z';

// Entry used by bootstrap
export async function loadCustomerSupport(fromDateISO = DEFAULT_FROM, toDateISO = DEFAULT_TO){
  try {
    showLoading();
    const data = await api.fetchConversations(fromDateISO, toDateISO);
    const all = Array.isArray(data) ? data : (data ? [data] : []);
    const emailConversations = all.filter(c => c.channel_type === 'email');
    const crmConversations = all.filter(c => c.channel_type === 'inapp_public');
    setState({ conversations: all, emailConversations, crmConversations });
    renderEmailList();
    renderCRMList();
    updateEmailStats();
  } catch(err){
    console.warn('Failed to load conversations', err);
    showError();
  }
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

// Email row: Name, Email, Date, Status, Subject
function emailItemHtml(conv){
  const name = conv.name || extractNameFromEmail(conv.email || '') || 'Unknown';
  const email = conv.email || '';
  const date = formatDate(conv.started_at);
  const status = (conv.status || '').trim();
  const subject = conv.subject || 'No subject';
  return `<div class="conversation-item" data-id="${conv.conversation_id}" data-type="email">
    <div class="conversation-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div class="conversation-name" style="font-weight:600;">${escapeHtml(name)}</div>
        <div class="conversation-email" style="font-size:11px;color:#456;margin-top:2px;">${escapeHtml(email)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="conversation-date" style="font-size:11px;color:#567;white-space:nowrap;">${date}</div>
        <span class="conversation-status status-${status.toLowerCase()||'na'}">${escapeHtml(status)}</span>
      </div>
    </div>
    <div class="conversation-subject" style="margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${escapeHtml(subject)}</div>
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
  const list = state.emailConversations || [];
  const total = list.length;
  const open = list.filter(c => (c.status||'').toLowerCase()==='open').length;
  const closed = list.filter(c => (c.status||'').toLowerCase()==='closed').length;
  const pending = list.filter(c => !c.status).length;
  setStat('cs-total', total);
  setStat('cs-open', open);
  setStat('cs-closed', closed);
  setStat('cs-pending', pending);
}

function setStat(id, val){ const el=document.getElementById(id); if(el) el.textContent = val; }

function showLoading(){
  const email = document.getElementById('email-conversations');
  const crm = document.getElementById('crm-conversations');
  if(email) email.innerHTML = '<div class="loading">Loading...</div>';
  if(crm) crm.innerHTML = '<div class="loading">Loading...</div>';
}

function showError(){
  const email = document.getElementById('email-conversations');
  const crm = document.getElementById('crm-conversations');
  if(email) email.innerHTML = '<div class="error">Failed to load conversations</div>';
  if(crm) crm.innerHTML = '<div class="error">Failed to load conversations</div>';
}

function escapeHtml(str){
  const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' };
  return (str||'').replace(/[&<>"']/g, ch => map[ch] || ch);
}
