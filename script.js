// Dashboard Configuration
const CONFIG = {
    webhooks: {
        email: 'https://internss.app.n8n.cloud/webhook/fetchFromDB',
        crm: 'https://webhook.site/placeholder-crm-webhook',
        shipping: 'https://internss.app.n8n.cloud/webhook/ShippingLabel'
    },
    businessId: 'velit-camping-2029'
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
    // Load initial data
    loadEmailData();
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

    currentTab = tabName;

    // Load data for the selected tab
    switch(tabName) {
        case 'emails':
            loadEmailData();
            break;
        case 'crm':
            loadCRMData();
            break;
        case 'shipping':
            // Shipping tab doesn't need to load data, it's a chatbot
            break;
    }
}

function refreshCurrentTab() {
    switch(currentTab) {
        case 'emails':
            loadEmailData();
            break;
        case 'crm':
            loadCRMData();
            break;
        case 'shipping':
            // Reset chat if needed
            break;
    }
}

// Email Section Functions
async function loadEmailData() {
    showLoading();
    
    const fromDate = document.getElementById('from-date').value;
    const toDate = document.getElementById('to-date').value;
    
    const payload = {
        business_id: CONFIG.businessId,
        from_date: `${fromDate}T00:00:00Z`,
        to_date: `${toDate}T23:59:59Z`
    };

    try {
        // For development, using mock data
        const mockData = generateMockEmailData();
        currentConversations = mockData;
        renderEmailConversations(mockData);
        updateTicketCounts(mockData);
        
        // Uncomment below for actual webhook integration
        
        const response = await fetch(CONFIG.webhooks.email, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const data = await response.json();
            currentConversations = Array.isArray(data) ? data : [data];
            renderEmailConversations(currentConversations);
            updateTicketCounts(currentConversations);
        } else {
            throw new Error('Failed to fetch email data');
        }
        
    } catch (error) {
        console.error('Error loading email data:', error);
        showError('Failed to load email conversations');
    } finally {
        hideLoading();
    }
}

function filterEmailConversations() {
    loadEmailData();
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
                <div class="conversation-name">${extractNameFromEmail(conv.sender_email || 'Unknown')}</div>
                <div class="conversation-status status-${conv.status.toLowerCase()}">${conv.status}</div>
            </div>
            <div class="conversation-email">${conv.sender_email || 'No email'}</div>
            <div class="conversation-subject">${conv.subject || 'No subject'}</div>
            <div class="conversation-dates">
                <span>Opened: ${formatDate(conv.started_at)}</span>
                <span>Updated: ${formatDate(conv.updated_at || conv.started_at)}</span>
            </div>
        </div>
    `).join('');
}

// CRM Section Functions
async function loadCRMData() {
    showLoading();
    
    const payload = {
        business_id: CONFIG.businessId
    };

    try {
        // For development, using mock data
        const mockData = generateMockCRMData();
        currentConversations = mockData;
        renderCRMConversations(mockData);
        
        // Uncomment below for actual webhook integration
        /*
        const response = await fetch(CONFIG.webhooks.crm, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const data = await response.json();
            currentConversations = Array.isArray(data) ? data : [data];
            renderCRMConversations(currentConversations);
        } else {
            throw new Error('Failed to fetch CRM data');
        }
        */
    } catch (error) {
        console.error('Error loading CRM data:', error);
        showError('Failed to load CRM conversations');
    } finally {
        hideLoading();
    }
}

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
                <div class="conversation-name">${conv.customer_name || 'Unknown Customer'}</div>
                <div class="conversation-status status-${conv.status.toLowerCase()}">${conv.status}</div>
            </div>
            <div class="conversation-email">${conv.contact_info || 'No contact info'}</div>
            <div class="conversation-subject">${conv.topic || 'General inquiry'}</div>
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
    
    const conversation = currentConversations.find(conv => conv.conversation_id === conversationId);
    if (conversation) {
        selectedConversation = conversation;
        renderConversationDetail(conversation, type);
    }
}

function renderConversationDetail(conversation, type) {
    const containerId = type === 'email' ? 'email-detail' : 'crm-detail';
    const container = document.getElementById(containerId);
    
    const senderName = type === 'email' 
        ? extractNameFromEmail(conversation.sender_email || 'Unknown')
        : conversation.customer_name || 'Unknown Customer';
    
    const contactInfo = type === 'email'
        ? conversation.sender_email
        : conversation.contact_info;
    
    container.innerHTML = `
        <div class="detail-header">
            <div class="detail-title">${conversation.subject || conversation.topic || 'Conversation'}</div>
            <div class="detail-info">
                <strong>${senderName}</strong> • ${contactInfo} • Status: ${conversation.status}
            </div>
        </div>
        <div class="messages-container">
            ${renderMessages(conversation.messages || [])}
        </div>
    `;
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        return '<p style="text-align: center; color: #888; padding: 20px;">No messages in this conversation</p>';
    }

    return messages.map(message => {
        const isUser = message.sender === 'user' || message.sender === 'customer';
        const messageClass = isUser ? 'message-user' : 'message-agent';
        
        return `
            <div class="message-bubble ${messageClass}">
                ${message.message || message.content || 'No content'}
                <span class="message-time">${formatDate(message.timestamp)}</span>
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
    const messageClass = sender === 'user' ? 'user-message' : 'bot-message';
    const avatarIcon = sender === 'user' ? 'fa-user' : 'fa-robot';
    
    const messageElement = document.createElement('div');
    messageElement.className = messageClass;
    messageElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <p>${message}</p>
            <span class="message-time">${formatTime(new Date())}</span>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
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
