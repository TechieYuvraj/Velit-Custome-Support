// Shipping Label Modal Logic
function openShippingLabelModal(conversation) {
    const modal = document.getElementById('shipping-label-modal');
    modal.style.display = 'flex';
    // Pre-fill order no and address if available
    document.getElementById('modal-order-no').value = conversation.order_no || '';
    document.getElementById('modal-from-address').value = conversation.sender_address || conversation.from_address || '';
    document.getElementById('modal-product-dimensions').value = '';
    document.getElementById('modal-shipping-label-response').innerHTML = '';
}

document.getElementById('close-shipping-label-modal').onclick = function() {
    document.getElementById('shipping-label-modal').style.display = 'none';
};

document.getElementById('modal-shipping-label-form').onsubmit = async function(e) {
    e.preventDefault();
    const orderNo = document.getElementById('modal-order-no').value.trim();
    const productDimensions = document.getElementById('modal-product-dimensions').value.trim();
    const fromAddress = document.getElementById('modal-from-address').value.trim();
    const responseDiv = document.getElementById('modal-shipping-label-response');
    responseDiv.innerHTML = 'Generating label...';
    try {
        const payload = {
            order_no: orderNo,
            product_dimensions: productDimensions,
            from_address: fromAddress
        };
        const response = await fetch(CONFIG.webhooks.shipping, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            const data = await response.json();
            responseDiv.innerHTML = formatLabelResponse(data);
        } else {
            responseDiv.innerHTML = '<span class="error">Failed to generate label. Please try again.</span>';
        }
    } catch (error) {
        responseDiv.innerHTML = '<span class="error">Error: ' + error.message + '</span>';
    }
};
// Dashboard Configuration
const CONFIG = {
    webhooks: {
        email: 'https://internsss.app.n8n.cloud/webhook/fetchFromDB', // Unified webhook for both
        crm: 'https://internsss.app.n8n.cloud/webhook/fetchFromDB',   // Same as email
        shipping: 'https://internsss.app.n8n.cloud/webhook-test/ShippingLabel'
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
    // Shipping Label Assistant Functions
    const shippingForm = document.getElementById('shipping-label-form');
    if (shippingForm) {
        shippingForm.addEventListener('submit', handleShippingLabelSubmit);
        fetchLabelHistory();
    }
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

    if (type === 'email') {
        // EMAIL SECTION UI
        const senderName = conversation.name || extractNameFromEmail(conversation.sender_email || conversation.email || 'Unknown');
        const contactInfo = conversation.sender_email || conversation.email || 'No email';
        const subjectOrTopic = conversation.subject || 'No subject';
        const isOpen = (conversation.status || '').toLowerCase() === 'open';

        container.innerHTML = `
            <div class="detail-header">
                <div class="detail-title">${subjectOrTopic}</div>
                <div class="detail-info">
                    <strong>${senderName}</strong> • ${contactInfo}
                    <span style="margin-left:16px;">
                        <label class="status-toggle-label">
                            <span style="margin-right:8px;">Open</span>
                            <input type="checkbox" id="status-toggle" ${isOpen ? 'checked' : ''} />
                            <span class="status-toggle-slider"></span>
                            <span style="margin-left:8px;">Closed</span>
                        </label>
                    </span>
                </div>
            </div>
            <div class="messages-container">
                ${renderMessages(conversation.messages || [])}
            </div>
            <div class="email-reply-box" style="margin-top:16px;display:flex;gap:8px;">
                <input id="email-reply-input" type="text" placeholder="Type your reply..." style="flex:1;padding:8px;border-radius:6px;border:1px solid #ccc;">
                <button id="email-reply-send" style="padding:8px 18px;border-radius:6px;background:#3a7bd5;color:#fff;border:none;cursor:pointer;">Send</button>
            </div>
            <div style="margin-top:16px;display:flex;justify-content:flex-end;">
                <button id="create-shipping-label-btn" style="padding:8px 18px;border-radius:6px;background:#195744;color:#fff;border:none;cursor:pointer;">
                    <i class="fas fa-shipping-fast"></i> Create Shipping Label
                </button>
            </div>
        `;
        // Add event listener for shipping label button
        document.getElementById('create-shipping-label-btn').onclick = function() {
            openShippingLabelModal(conversation);
        };

        // Add event listeners for sending email reply
        document.getElementById('email-reply-send').onclick = function() {
            sendEmailReply(conversation);
        };
        document.getElementById('email-reply-input').onkeypress = function(e) {
            if (e.key === 'Enter') sendEmailReply(conversation);
        };

        // Add event listener for status toggle
        document.getElementById('status-toggle').onchange = function() {
            const newStatus = this.checked ? 'Open' : 'Closed';
            sendStatusUpdate(conversation.session_id, CONFIG.businessId, newStatus, conversation.from_email || conversation.email || '');
        };
    } else if (type === 'crm') {
        // CRM SECTION UI
        const subjectOrTopic = conversation.session_id || 'General inquiry';

        container.innerHTML = `
            <div class="detail-header">
                <div class="detail-title">${subjectOrTopic}</div>
            </div>
            <div class="messages-container">
                ${renderMessages(conversation.messages || [])}
            </div>
        `;
    }
}

// Add this function to send status update to the webhook
async function sendStatusUpdate(session_id, status) {
    showLoading();
    // Only allow 'open' or 'closed' status
    const normalizedStatus = (status && status.toLowerCase() === 'closed') ? 'closed' : 'open';
    const payload = {
        session_id: session_id,
        status: normalizedStatus,
        business_id: CONFIG.businessId,
        from_email: selectedConversation.from_email || selectedConversation.email || ''
    };
    try {
        await fetch("https://internsss.app.n8n.cloud/webhook/UpdateStatus", {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        // Optionally show a toast or update UI
    } catch (error) {
        showError('Failed to update status');
    } finally {
        hideLoading();
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
            image_link: msg.fields.image_link?.stringValue,
            imagelink: msg.fields.imagelink?.stringValue,
            timestamp: msg.fields.timestamp?.timestampValue || msg.fields.timestamp?.stringValue,
        } : msg;

        // User messages on left, admin/support on right
        const isUser = message.sender === 'user' || message.sender === 'customer';
        const alignClass = isUser ? 'message-left' : 'message-right';
        const bubbleClass = isUser ? 'message-bubble-user' : 'message-bubble-admin';
        const textContent = message.message || message.content || 'No content';

        // Handle Google Drive link conversion for image preview
        let imageUrl = message.image_link || message.imagelink || '';
        if (imageUrl.includes('drive.google.com/file/d/')) {
            const match = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)\//);
            if (match && match[1]) {
                imageUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
            }
        }

        // Render both text and image in the same bubble
        const imageContent = imageUrl
            ? `<div class="message-image"><img src="${imageUrl}" alt="attachment" style="max-width:220px;max-height:160px;border-radius:8px;margin-top:8px;" onerror="this.onerror=null;this.src='https://via.placeholder.com/220x160.png?text=Image+not+found';"></div>`
            : '';

        return `
            <div class="message-row ${alignClass}">
                <div class="${bubbleClass}">
                    <div>${textContent}</div>
                    ${imageContent}
                    <span class="message-time">${formatDate(message.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ...existing code...

async function handleShippingLabelSubmit(event) {
    event.preventDefault();
    const orderNo = document.getElementById('order-no').value.trim();
    const productDimensions = document.getElementById('product-dimensions').value.trim();
    const fromAddress = document.getElementById('from-address').value.trim();

    if (!orderNo || !productDimensions || !fromAddress) {
        showShippingLabelResponse('Please fill in all fields.', true);
        return;
    }

    showShippingLabelResponse('Generating label...', false);

    try {
        const payload = {
            order_no: orderNo,
            product_dimensions: productDimensions,
            from_address: fromAddress
        };
        const response = await fetch('https://internsss.app.n8n.cloud/webhook/ShippingLabel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            const data = await response.json();
            showShippingLabelResponse(formatLabelResponse(data), false);
            fetchLabelHistory(); // Refresh history after new label
        } else {
            showShippingLabelResponse('Failed to generate label. Please try again.', true);
        }
    } catch (error) {
        showShippingLabelResponse('Error: ' + error.message, true);
    }
}

function showShippingLabelResponse(message, isError) {
    const responseDiv = document.getElementById('shipping-label-response');
    if (responseDiv) {
        if (isError) {
            responseDiv.innerHTML = `<div class="error">${message}</div>`;
        } else {
            // If message is an object, render as horizontal bar
            if (typeof message === 'object' && message !== null) {
                responseDiv.innerHTML = renderShippingLabelBar(message);
            } else {
                // Try to parse JSON string
                try {
                    const obj = JSON.parse(message);
                    responseDiv.innerHTML = renderShippingLabelBar(obj);
                } catch {
                    responseDiv.innerHTML = `<div class="success">${message}</div>`;
                }
            }
        }
    }

function renderShippingLabelBar(label) {
    const tracking = label.trackingNumber ? label.trackingNumber : 'N/A';
    const url = label.url ? label.url : null;
    return `<div class="label-history-bar">
        <span class="tracking-number">Tracking: <strong>${tracking}</strong></span>
        ${url ? `<button class="label-url-btn" onclick="window.open('${url}', '_blank')">View Label</button>` : ''}
    </div>`;
}
}

function formatLabelResponse(data) {
    if (!data) return 'No label data.';
    // If response is an array, use the first item
    const obj = Array.isArray(data) ? data[0] : data;
    // Render only the required fields
    return `
        <div class="label-history-bar">
        <ul>
            <li><strong>Status:</strong> ${obj.status || 'N/A'}</li>
            <li><strong>Request ID:</strong> ${obj.requestId || 'N/A'}</li>
            <li><strong>Order ID:</strong> ${obj.orderId || 'N/A'}</li>
            <li><strong>Carrier:</strong> ${obj.carrier || 'N/A'}</li>
            <li><strong>Channel:</strong> ${obj.channel || 'N/A'}</li>
            <li><strong>Tracking Number:</strong> ${obj.trackingNumber || 'N/A'}</li>
            <li><strong>Label URL:</strong> ${obj.url ? `<a href="${obj.url}" target="_blank">View PDF</a>` : 'N/A'}</li>
        </ul>
        </div>
    `;
}

function renderJsonObject(obj) {
    // Recursively render JSON as HTML, preview image_link if present
    if (typeof obj !== 'object' || obj === null) {
        return `<span>${String(obj)}</span>`;
    }
    if (Array.isArray(obj)) {
        return `<ul>${obj.map(item => `<li>${renderJsonObject(item)}</li>`).join('')}</ul>`;
    }
    return `<ul>${Object.entries(obj).map(([key, value]) => {
        if (key === 'image_link' && typeof value === 'string' && value.startsWith('http')) {
            return `<li><strong>${key}:</strong><br><img src="${value}" alt="Label Image" style="max-width:220px;max-height:120px;border-radius:8px;margin:8px 0;" /></li>`;
        }
        return `<li><strong>${key}:</strong> ${renderJsonObject(value)}</li>`;
    }).join('')}</ul>`;
}

async function fetchLabelHistory() {
    const historyDiv = document.getElementById('label-history-list');
    if (!historyDiv) return;
    historyDiv.innerHTML = 'Loading history...';
    try {
        const response = await fetch('https://internsss.app.n8n.cloud/webhook/LabelHistory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        if (response.ok) {
            const data = await response.json();
            historyDiv.innerHTML = renderLabelHistory(data);
        } else {
            historyDiv.innerHTML = 'Failed to load label history.';
        }
    } catch (error) {
        historyDiv.innerHTML = 'Error loading label history.';
    }
}

function renderLabelHistory(history) {
    if (!history || !Array.isArray(history) || history.length === 0) {
        return '<p>No label history found.</p>';
    }
    return history.map(label => {
        const tracking = label.trackingNumber ? label.trackingNumber : 'N/A';
        const url = label.url ? label.url : null;
        return `<div class="label-history-bar">
            <span class="tracking-number">Tracking: <strong>${tracking}</strong></span>
            ${url ? `<button class="label-url-btn" onclick="window.open('${url}', '_blank')">View Label</button>` : ''}
        </div>`;
    }).join('');
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
