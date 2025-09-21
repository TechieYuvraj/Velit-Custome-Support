import { state, setState } from '../core/state.js';
import { api } from '../core/api.js';
import { formatDate, extractNameFromEmail } from '../utils/format.js';

export async function loadCustomerSupport(fromDateISO, toDateISO){
  const data = await api.fetchConversations(fromDateISO, toDateISO);
  const all = Array.isArray(data)? data : [data];
  const emailConversations = all.filter(c=>c.channel_type==='email');
  const crmConversations = all.filter(c=>c.channel_type==='inapp_public');
  setState({ conversations: all, emailConversations, crmConversations });
  renderEmailList();
  renderCRMList();
}

export function renderEmailList(){
  const container = document.getElementById('email-conversations');
  if(!container) return;
  const list = state.emailConversations;
  if(!list.length){ container.innerHTML='<div class="no-data"><p>No conversations found</p></div>'; return; }
  container.innerHTML = list.map(conv=>`
    <div class="conversation-item" data-id="${conv.conversation_id}" data-type="email">
      <div class="conversation-header">
        <div class="conversation-name">${conv.name || extractNameFromEmail(conv.email || conv.sender_email || 'Unknown')}</div>
        <div class="conversation-status status-${(conv.status||'').toLowerCase()}">${conv.status}</div>
      </div>
      <div class="conversation-email">${conv.email || 'No email'}</div>
      <div class="conversation-subject">${conv.subject || 'No subject'}</div>
      <div class="conversation-dates">
        <span>Opened: ${formatDate(conv.started_at)}</span>
        <span>Updated: ${formatDate(conv.updated_at || conv.started_at)}</span>
      </div>
    </div>`).join('');
}

export function renderCRMList(){
  const container = document.getElementById('crm-conversations');
  if(!container) return;
  const list = state.crmConversations;
  if(!list.length){ container.innerHTML='<div class="no-data"><p>No CRM conversations found</p></div>'; return; }
  container.innerHTML = list.map(conv=>`
    <div class="conversation-item" data-id="${conv.conversation_id}" data-type="crm">
      <div class="conversation-header">
        <div class="conversation-name">${conv.session_id || 'Unknown Customer'}</div>
        <div class="conversation-status status-${(conv.status||'').toLowerCase()}">${conv.status}</div>
      </div>
      <div class="conversation-dates">
        <span>Started: ${formatDate(conv.started_at)}</span>
        <span>Updated: ${formatDate(conv.updated_at || conv.started_at)}</span>
      </div>
    </div>`).join('');
}
