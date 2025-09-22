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
    <div class="detail-header" style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div class="detail-title" style="font-weight:600;">${subjectOrTopic}</div>
      <div class="conv-status-pill ${statusClass}" style="padding:4px 10px;border-radius:14px;font-size:12px;background:#eef5f3;color:#195744;text-transform:capitalize;">${status}</div>
    </div>
    <div class="detail-info" style="margin-top:4px;font-size:13px;color:#234;">
      <strong>${senderName}</strong> • ${contactInfo}
    </div>
    <div class="messages-container" style="margin-top:12px;">${renderMessages(conversation.messages||[])}</div>
    <div class="email-reply-box" style="margin-top:16px;display:flex;gap:8px;">
      <input id="email-reply-input" type="text" placeholder="Type your reply..." style="flex:1;padding:8px;border-radius:6px;border:1px solid #ccc;" />
      <button id="email-reply-send" class="primary-action">Send</button>
    </div>`;
  host.querySelector('#email-reply-send').onclick=()=>sendEmailReply(conversation);
  host.querySelector('#email-reply-input').addEventListener('keypress',e=>{ if(e.key==='Enter') sendEmailReply(conversation); });
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
