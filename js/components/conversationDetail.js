import { api } from '../core/api.js';
import { state, setState } from '../core/state.js';
import { formatDate, extractNameFromEmail } from '../utils/format.js';

export function attachConversationListHandlers(){
  document.addEventListener('click',(e)=>{
    const item = e.target.closest('.conversation-item');
    if(item){
      const id = item.dataset.id; const type=item.dataset.type;
      if(type==='email'){ selectConversation(id,'email'); } else if(type==='crm'){ selectConversation(id,'crm'); }
    }
  });
}

function selectConversation(id, type){
  const list = type==='crm'? state.crmConversations : state.emailConversations;
  const conv = list.find(c=>c.conversation_id===id);
  if(!conv) return;
  setState({ selectedConversation: conv });
  renderConversationDetail(conv, type);
}

function renderConversationDetail(conversation, type){
  const containerId = type==='email'? 'email-detail':'crm-detail';
  const el = document.getElementById(containerId);
  if(!el) return;
  if(type==='email') renderEmailDetail(el, conversation); else renderCrmDetail(el, conversation);
}

function renderEmailDetail(host, conversation){
  const senderName = conversation.name || extractNameFromEmail(conversation.sender_email || conversation.email || 'Unknown');
  const contactInfo = conversation.sender_email || conversation.email || 'No email';
  const subjectOrTopic = conversation.subject || 'No subject';
  const status = (conversation.status || '').trim() || 'Unknown';
  const statusClass = status ? 'status-' + status.toLowerCase() : 'status-na';
  host.innerHTML = `
    <div class="detail-header" style="position:sticky;top:0;z-index:5;background:#fff;padding:8px 5px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #e2e8e5;border-radius: 10px;">
      <div style="flex:1;min-width:0;">
        <div class="detail-title" style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subjectOrTopic}</div>
        <div class="detail-info" style="margin-top:2px;font-size:12px;color:#345;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          <strong>${senderName}</strong> • ${contactInfo}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:90px;">
        <span class="conv-status-pill ${statusClass}" style="text-transform:capitalize;">${status}</span>
        <button id="toggle-status-btn" data-current="${status.toLowerCase()}" style="background:#195744;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">${status.toLowerCase()==='open'?'Close':'Reopen'}</button>
      </div>
    </div>
    <div class="messages-scroll-wrapper" style="position:relative;display:flex;flex-direction:column;gap:12px;padding-top:8px;">
      <div class="messages-container" style="max-height:100vh;overflow-y:auto;padding-right:4px;">${renderMessages(conversation.messages||[])}</div>
    </div>
    <div class="email-reply-box" style="position:sticky;margin-top:5px;display:flex;gap:8px;">
      <input id="email-reply-input" type="text" placeholder="Type your reply..." style="flex:1;padding:10px 12px;border-radius:6px;border:2px solid #cbd5d1;font-size:13px;" />
      <button id="email-reply-send" class="primary-action" style="height:40px;">Send</button>
    </div>`;
  host.querySelector('#email-reply-send').onclick=()=>sendEmailReply(conversation);
  host.querySelector('#email-reply-input').addEventListener('keypress',e=>{ if(e.key==='Enter') sendEmailReply(conversation); });
  const toggleBtn = host.querySelector('#toggle-status-btn');
  if(toggleBtn){
    toggleBtn.addEventListener('click', async ()=>{
      const current = (conversation.status||'').toLowerCase();
      const next = current==='open' ? 'closed' : 'open';
      try { await api.updateStatus(conversation.session_id, next, conversation.from_email || conversation.email || '');
        conversation.status = next.charAt(0).toUpperCase()+next.slice(1);
        renderEmailDetail(host, conversation);
      } catch(err){ console.warn('Status update failed', err); }
    });
  }
}

function renderCrmDetail(host, conversation){
  host.innerHTML = `
    <div class="detail-header"><div class="detail-title">${conversation.session_id || 'General inquiry'}</div></div>
    <div class="messages-container">${renderMessages(conversation.messages||[])}</div>`;
}

function renderMessages(messages){
  if(!messages || !messages.length) return '<p style="text-align:center;color:#888;padding:20px;">No messages in this conversation</p>';
  return messages.map(msg=>{
    const m = msg.fields ? {
      sender: msg.fields.sender?.stringValue,
      message: msg.fields.message?.stringValue,
      image_link: msg.fields.image_link?.stringValue,
      imagelink: msg.fields.imagelink?.stringValue,
      timestamp: msg.fields.timestamp?.timestampValue || msg.fields.timestamp?.stringValue,
    }: msg;
    const isUser = m.sender==='user' || m.sender==='customer';
    const alignClass = isUser? 'message-left':'message-right';
    const bubbleClass = isUser? 'message-bubble-user':'message-bubble-admin';
    const textContent = m.message || m.content || 'No content';
    let imageUrl = m.image_link || m.imagelink || '';
    if(imageUrl.includes('drive.google.com/file/d/')){
      const match = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)\//); if(match && match[1]) imageUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    const imageContent = imageUrl? `<div class="message-image"><img src="${imageUrl}" alt="attachment" style="max-width:220px;max-height:160px;border-radius:8px;margin-top:8px;" onerror="this.onerror=null;this.src='https://via.placeholder.com/220x160.png?text=Image+not+found';" /></div>`:'';
    return `<div class="message-row ${alignClass}"><div class="${bubbleClass}"><div>${textContent}</div>${imageContent}<span class="message-time">${formatDate(m.timestamp)}</span></div></div>`;
  }).join('');
}

// Shipping label creation removed per latest UI instruction

async function sendEmailReply(conversation){
  const input=document.getElementById('email-reply-input'); if(!input) return; const content=input.value.trim(); if(!content) return;
  const lastMsg = (conversation.messages && conversation.messages.length)? conversation.messages[conversation.messages.length-1]:{};
  const payload = { "to-email": conversation.email || conversation.sender_email || '', message_id: lastMsg.message_id || '', thread_id: conversation.conversation_id || '', "from-email": conversation.agent_email || 'support@velit.com', subject: conversation.subject || '', content };
  try { await api.sendEmail(payload); input.value=''; } catch(err){ console.warn('Email send failed', err); }
}
