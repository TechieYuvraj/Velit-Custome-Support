// Dashboard Configuration
const CONFIG = {
    webhooks: {
        email: 'https://internsss.app.n8n.cloud/webhook/fetchFromDB', // Unified webhook for both
        crm: 'https://internsss.app.n8n.cloud/webhook/fetchFromDB',   // Same as email
        shipping: 'https://internsss.app.n8n.cloud/webhook/ShippingLabel'
    },
    businessId: 'velit-camping-2027'
};

// Global state
let currentConversations = [];
let currentTab = 'emails';
let selectedConversation = null;
let chatSessionId = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    setDefaultDates();
    generateChatSessionId();
});

function initializeDashboard() {
    // Load initial data for both sections
    loadConversationsData();
    updateTicketCounts();
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Refresh button
    document.querySelector('.refresh-btn').addEventListener('click', function() {
        refreshCurrentTab();
        this.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            this.style.transform = '';
        }, 500);
    });

    // Date filter
    document.getElementById('from-date').addEventListener('change', filterEmailConversations);
    document.getElementById('to-date').addEventListener('change', filterEmailConversations);
}

function setDefaultDates() {
    const fromDate = document.getElementById('from-date');
    const toDate = document.getElementById('to-date');
    
    fromDate.value = '2024-01-01';
    toDate.value = new Date().toISOString().split('T')[0];
}

function generateChatSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    chatSessionId = `${timestamp}_${random}`;
}

// Tab Management
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Only update the currentTab variable, do not reload data here
    currentTab = tabName;
}

function refreshCurrentTab() {
    // Always reload both sections since data comes from the same webhook
    loadConversationsData();
}

// Email & CRM Section Functions (Unified Fetch)
async function loadConversationsData() {
    showLoading();

    const fromDate = document.getElementById('from-date').value;
    const toDate = document.getElementById('to-date').value;

    const payload = {
        business_id: CONFIG.businessId,
        from_date: `${fromDate}T00:00:00Z`,
        to_date: `${toDate}T23:59:59Z`
    };

    try {
        const response = await fetch(CONFIG.webhooks.email, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            // Separate conversations by channel_type
            const allConversations = Array.isArray(data) ? data : [data];
            const emailConversations = allConversations.filter(conv => conv.channel_type === "email");
            const crmConversations = allConversations.filter(conv => conv.channel_type === "inapp_public");

            // Store for global access if needed
            window.emailConversations = emailConversations;
            window.crmConversations = crmConversations;

            // Render each section
            renderEmailConversations(emailConversations);
            renderCRMConversations(crmConversations);
            updateTicketCounts(emailConversations);
        } else {
            throw new Error('Failed to fetch conversations data');
        }
    } catch (error) {
        console.error('Error loading conversations data:', error);
        showError('Failed to load conversations');
    } finally {
        hideLoading();
    }
}

function filterEmailConversations() {
    loadConversationsData();
}

function renderEmailConversations(conversations) {
    const container = document.getElementById('email-conversations');
    
    if (!conversations || conversations.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>No conversations found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item" onclick="selectConversation('${conv.conversation_id}', 'email')">
            <div class="conversation-header">
                <div class="conversation-name">${conv.name || extractNameFromEmail(conv.email || conv.sender_email || 'Unknown')}</div>
                <div class="conversation-status status-${conv.status.toLowerCase()}">${conv.status}</div>
            </div>
            <div class="conversation-email">${conv.email || 'No email'}</div>
            <div class="conversation-subject">${conv.subject || 'No subject'}</div>
            <div class="conversation-dates">
                <span>Opened: ${formatDate(conv.started_at)}</span>
                <span>Updated: ${formatDate(conv.updated_at || conv.started_at)}</span>
            </div>
        </div>
    `).join('');
}

// CRM Section Functions
function renderCRMConversations(conversations) {
    const container = document.getElementById('crm-conversations');
    
    if (!conversations || conversations.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-users"></i>
                <p>No CRM conversations found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item" onclick="selectConversation('${conv.conversation_id}', 'crm')">
            <div class="conversation-header">
                <div class="conversation-name">${conv.session_id || 'Unknown Customer'}</div>
                <div class="conversation-status status-${conv.status.toLowerCase()}">${conv.status}</div>
            </div>
            <div class="conversation-dates">
                <span>Started: ${formatDate(conv.started_at)}</span>
                <span>Updated: ${formatDate(conv.updated_at || conv.started_at)}</span>
            </div>
        </div>
    `).join('');
}

// Conversation Detail Functions
function selectConversation(conversationId, type) {
    // Remove active class from all conversation items
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to selected item
    event.currentTarget.classList.add('active');

    // Use the correct data source based on type
    let conversations;
    if (type === 'crm') {
        conversations = window.crmConversations || [];
    } else {
        conversations = window.emailConversations || [];
    }

    const conversation = conversations.find(conv => conv.conversation_id === conversationId);
    if (conversation) {
        selectedConversation = conversation;
        renderConversationDetail(conversation, type);
    }
}

function renderConversationDetail(conversation, type) {
    const containerId = type === 'email' ? 'email-detail' : 'crm-detail';
    const container = document.getElementById(containerId);

    // Determine name and contact info based on type and available fields
    let senderName, contactInfo, subjectOrTopic;
    if (type === 'email') {
        senderName = conversation.name || extractNameFromEmail(conversation.sender_email || conversation.email || 'Unknown');
        contactInfo = conversation.sender_email || conversation.email || 'No email';
        subjectOrTopic = conversation.subject || 'No subject';
    } else {
        subjectOrTopic = conversation.session_id || conversation.session_id || 'General inquiry';
    }

    container.innerHTML = `
        <div class="detail-header">
            <div class="detail-title">${subjectOrTopic}</div>
            <div class="detail-info">
                <strong>${senderName}</strong> • ${contactInfo} • Status: ${conversation.status}
            </div>
        </div>
        <div class="messages-container">
            ${renderMessages(conversation.messages || [])}
        </div>
        ${type === 'email' ? `
        <div class="email-reply-box" style="margin-top:16px;display:flex;gap:8px;">
            <input id="email-reply-input" type="text" placeholder="Type your reply..." style="flex:1;padding:8px;border-radius:6px;border:1px solid #ccc;">
            <button id="email-reply-send" style="padding:8px 18px;border-radius:6px;background:#3a7bd5;color:#fff;border:none;cursor:pointer;">Send</button>
        </div>
        ` : ''}
    `;

    // Add event listener for sending email reply
    if (type === 'email') {
        document.getElementById('email-reply-send').onclick = function() {
            sendEmailReply(conversation);
        };
        document.getElementById('email-reply-input').onkeypress = function(e) {
            if (e.key === 'Enter') sendEmailReply(conversation);
        };
    }
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        return '<p style="text-align: center; color: #888; padding: 20px;">No messages in this conversation</p>';
    }

    return messages.map(msg => {
        // Support both flat and Firestore-style nested message objects
        const message = msg.fields ? {
            sender: msg.fields.sender?.stringValue,
            message: msg.fields.message?.stringValue,
            imagelink: msg.fields.imagelink?.stringValue,
            timestamp: msg.fields.timestamp?.timestampValue || msg.fields.timestamp?.stringValue,
        } : msg;

        // User messages on left, admin/support on right
        const isUser = message.sender === 'user' || message.sender === 'customer';
        const alignClass = isUser ? 'message-left' : 'message-right';
        const bubbleClass = isUser ? 'message-bubble-user' : 'message-bubble-admin';
        const textContent = message.message || message.content || 'No content';
        const imageContent = message.imagelink
            ? `<div class="message-image"><img src="${message.imagelink}" alt="attachment" style="max-width:220px;max-height:160px;border-radius:8px;margin-top:8px;"></div>`
            : '';
        return `
            <div class="message-row ${alignClass}">
                <div class="${bubbleClass}">
                    ${textContent}
                    ${imageContent}
                    <span class="message-time">${formatDate(message.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Shipping Label Chatbot Functions
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const payload = {
            chatInput: message,
            sessionId: chatSessionId
        };
        
        const response = await fetch(CONFIG.webhooks.shipping, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            mode: 'cors'
        });

        if (response.ok) {
            const rawText = await response.text();
            hideTypingIndicator();
            let data;
            let isJson = false;
            try {
                data = JSON.parse(rawText);
                isJson = true;
            } catch (e) {
                data = rawText;
            }
            if (isJson) {
                if (Array.isArray(data) && data[0] && data[0].output) {
                    addChatMessage(data[0].output, 'bot');
                } else if (data.response) {
                    addChatMessage(data.response, 'bot');
                } else {
                    addChatMessage('I received your message.', 'bot');
                }
            } else {
                addChatMessage(data, 'bot');
            }
        } else {
            throw new Error('Failed to send message');
        }
        
    } catch (error) {
        console.error('Error sending chat message:', error);
        hideTypingIndicator();
        addChatMessage('Sorry, I encountered an error. Please try again.', 'bot');
    }
}

function addChatMessage(message, sender) {
    const chatMessages = document.getElementById('chat-messages');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let messageHtml;
    if (sender === 'bot') {
        // Render Markdown for bot messages
        messageHtml = `
            <div class="bot-message">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div>${marked.parse(message)}</div>
                    <span class="message-time">${time}</span>
                </div>
            </div>
        `;
    } else {
        // User message (plain text)
        messageHtml = `
            <div class="user-message">
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <p>${message}</p>
                    <span class="message-time">${time}</span>
                </div>
            </div>
        `;
    }

    chatMessages.insertAdjacentHTML('beforeend', messageHtml);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    const typingElement = document.createElement('div');
    typingElement.className = 'bot-message typing-indicator';
    typingElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <p><i class="fas fa-ellipsis-h fa-pulse"></i> Typing...</p>
        </div>
    `;
    
    chatMessages.appendChild(typingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Utility Functions
function updateTicketCounts(conversations = currentConversations) {
    const counts = {
        total: 0,
        open: 0,
        closed: 0,
        other: 0
    };
    
    if (conversations && conversations.length > 0) {
        conversations.forEach(conv => {
            counts.total++;
            const status = conv.status.toLowerCase();
            if (status === 'open' || status === 'pending') {
                counts.open++;
            } else if (status === 'closed') {
                counts.closed++;
            } else {
                counts.other++;
            }
        });
    }
    
    // Update the UI
    document.getElementById('total-tickets').textContent = counts.total;
    document.getElementById('open-tickets').textContent = counts.open;
    document.getElementById('closed-tickets').textContent = counts.closed;
    document.getElementById('other-tickets').textContent = counts.other;
    
    // Update timestamps
    const currentTime = formatTime(new Date());
    document.getElementById('total-update-time').textContent = currentTime;
    document.getElementById('open-update-time').textContent = currentTime;
    document.getElementById('closed-update-time').textContent = currentTime;
    document.getElementById('other-update-time').textContent = currentTime;
}

function extractNameFromEmail(email) {
    if (!email || !email.includes('@')) return 'Unknown';
    const localPart = email.split('@')[0];
    return localPart.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showError(message) {
    // You can implement a toast notification or alert here
    console.error(message);
    alert(message);
}

// Mock Data Functions (for development)
function generateMockEmailData() {
    return [
        {
            conversation_id: "dynS4Sj3Q6xTlxlC5SUh",
            channel_type: "email",
            session_id: "1742925376273018400",
            agent_id: "",
            user_id: "",
            started_at: "2025-09-09T05:00:56.502Z",
            updated_at: "2025-09-09T08:30:22.123Z",
            status: "Closed",
            sender_email: "william.zhou@velitcooling.com",
            subject: "Unit Testing and Shipping Confirmation",
            messages: [
                {
                    message_id: "aoOcaUjw92KNfe4lb7Ah",
                    sender: "user",
                    sender_id: "1742925376273018400",
                    timestamp: "2025-09-09T05:00:58.808Z",
                    message: "This unit was tested and packed on Sunday. It is scheduled to be dropped off today. It will cost $80 to 2nd day it. Please confirm.\nWilliam Zhou\nOperation Manager\nVelit Cooling & Heating"
                },
                {
                    message_id: "resp1",
                    sender: "agent",
                    sender_id: "support_agent_1",
                    timestamp: "2025-09-09T05:15:22.123Z",
                    message: "Thank you for the update, William. The $80 for 2nd day shipping is approved. Please proceed with the shipment."
                }
            ]
        },
        {
            conversation_id: "conv_2",
            channel_type: "email",
            session_id: "1742925376273018401",
            started_at: "2025-09-08T14:22:15.502Z",
            updated_at: "2025-09-08T16:45:33.789Z",
            status: "Open",
            sender_email: "sarah.johnson@techcorp.com",
            subject: "Installation Support Request",
            messages: [
                {
                    message_id: "msg_2_1",
                    sender: "user",
                    timestamp: "2025-09-08T14:22:15.502Z",
                    message: "Hi, I need help with the installation of the new cooling unit. The manual seems to be missing some steps."
                }
            ]
        },
        {
            conversation_id: "conv_3",
            channel_type: "email",
            session_id: "1742925376273018402",
            started_at: "2025-09-07T09:15:30.502Z",
            updated_at: "2025-09-07T11:20:45.123Z",
            status: "Pending",
            sender_email: "mike.davis@homeservices.com",
            subject: "Warranty Claim Processing",
            messages: [
                {
                    message_id: "msg_3_1",
                    sender: "user",
                    timestamp: "2025-09-07T09:15:30.502Z",
                    message: "I would like to file a warranty claim for unit #VH-2024-0892. It stopped working after 3 months."
                }
            ]
        }
    ];
}

function generateMockCRMData() {
    return [
        {
            conversation_id: "crm_conv_1",
            channel_type: "crm",
            started_at: "2025-09-09T10:30:00.000Z",
            updated_at: "2025-09-09T12:15:22.123Z",
            status: "Open",
            customer_name: "Jennifer Martinez",
            contact_info: "jennifer.martinez@email.com",
            topic: "Product Inquiry",
            messages: [
                {
                    message_id: "crm_msg_1",
                    sender: "customer",
                    timestamp: "2025-09-09T10:30:00.000Z",
                    message: "I'm interested in your commercial cooling solutions for a 5000 sq ft warehouse."
                }
            ]
        },
        {
            conversation_id: "crm_conv_2",
            channel_type: "crm",
            started_at: "2025-09-08T15:45:00.000Z",
            updated_at: "2025-09-08T16:30:15.456Z",
            status: "Closed",
            customer_name: "Robert Chen",
            contact_info: "robert.chen@manufacturing.com",
            topic: "Technical Support",
            messages: [
                {
                    message_id: "crm_msg_2",
                    sender: "customer",
                    timestamp: "2025-09-08T15:45:00.000Z",
                    message: "Our unit is making unusual noises. Can someone help diagnose the issue?"
                }
            ]
        }
    ];
}

function generateMockChatResponse(userMessage) {
    const responses = [
        "I can help you with shipping labels! What type of shipment are you looking to create?",
        "For shipping labels, I'll need some information about your package. What are the dimensions and weight?",
        "I can assist with domestic and international shipping. Where are you shipping to?",
        "Let me help you with that shipping label. Do you have the recipient's address ready?",
        "I can generate shipping labels for various carriers. Which shipping service would you prefer?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

async function sendEmailReply(conversation) {
    const input = document.getElementById('email-reply-input');
    const content = input.value.trim();
    if (!content) return;

    // Find the latest message for message_id and thread_id
    const lastMsg = (conversation.messages && conversation.messages.length > 0)
        ? conversation.messages[conversation.messages.length - 1]
        : {};

    // Prepare payload
    const payload = {
        "to-email": conversation.email || conversation.sender_email || "",
        "message_id": lastMsg.message_id || "",
        "thread_id": conversation.conversation_id || "",
        "from-email": conversation.agent_email || "support@velit.com", // Placeholder, update as needed
        "subject": conversation.subject || "",
        "content": content
    };

    // Placeholder webhook URL
    const webhookUrl = "https://internsss.app.n8n.cloud/webhook/sendEmail";

    showLoading(); // Show loader

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            input.value = '';
            alert('Email sent successfully (placeholder)');
        } else {
            throw new Error('Failed to send email');
        }
    } catch (error) {
        alert('Error sending email: ' + error.message);
    } finally {
        hideLoading(); // Hide loader
    }
}
