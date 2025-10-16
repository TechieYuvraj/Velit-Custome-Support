import { ENDPOINTS, API_KEY_HEADER, API_KEY_VALUE, BUSINESS_ID } from '../config/endpoints.js';

async function request(url, { method = 'POST', body = {}, headers = {} } = {}) {
  const finalHeaders = Object.assign({ 'Content-Type': 'application/json' }, headers);
  if (API_KEY_VALUE && API_KEY_VALUE !== '<REPLACE_WITH_KEY>') {
    finalHeaders[API_KEY_HEADER] = API_KEY_VALUE;
  }
  // Auto-inject business_id for all requests
  let finalUrl = url;
  let finalBody = body || {};
  if (String(method).toUpperCase() === 'GET') {
    // Append businessid to query if not present
    const hasBiz = /[?&](businessid|business_id)=/i.test(finalUrl);
    if (!hasBiz) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}businessid=${encodeURIComponent(BUSINESS_ID)}`;
    }
  } else {
    // Ensure body carries business_id unless explicitly provided
    if (finalBody && typeof finalBody === 'object' && !('business_id' in finalBody)) {
      finalBody = { business_id: BUSINESS_ID, ...finalBody };
    }
  }
  const res = await fetch(finalUrl, {
    method,
    headers: finalHeaders,
    body: String(method).toUpperCase() === 'GET' ? undefined : JSON.stringify(finalBody)
  });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  try { return await res.json(); } catch { return null; }
}

export const api = {
  fetchConversations: (from_date, to_date) => request(ENDPOINTS.conversations, { body: { from_date, to_date } }),
  fetchMessages: (conversationId) => request(`${ENDPOINTS.messages}?conversation_id=${encodeURIComponent(conversationId)}`, { method: 'GET' }),
  fetchOrdersByEmail: (email) => request(ENDPOINTS.ordersByEmail, { body: { email } }),
  createShippingLabel: (payload, meta = {}) => {
    const params = [];
    if (meta.date) params.push(`date=${encodeURIComponent(meta.date)}`);
    if (meta.product) params.push(`product=${encodeURIComponent(meta.product)}`);
    if (meta.orderId) params.push(`orderId=${encodeURIComponent(meta.orderId)}`);
    if (meta.Name) params.push(`Name=${encodeURIComponent(meta.Name)}`);
    if (meta.Email) params.push(`Email=${encodeURIComponent(meta.Email)}`);
    const url = params.length ? `${ENDPOINTS.shippingLabel}?${params.join('&')}` : ENDPOINTS.shippingLabel;
    return request(url, { body: payload });
  },
  fetchLabelHistory: (email) => request(ENDPOINTS.labelHistory, { body: email ? { email } : {} }),
  updateStatus: (session_id, status, from_email) => request(ENDPOINTS.updateStatus, { method: 'PATCH', body: { session_id, status, from_email } }),
  sendEmail: (payload) => request(ENDPOINTS.sendEmail, { body: payload }),
  fetchOrderHistory: (sessionId, chatInput='Order History') => request(ENDPOINTS.orderHistory, { body: { chatInput, sessionId } }),
  fetchShippingRequests: (sessionId, chatInput='ShippingRequests') => request(ENDPOINTS.labelHistory, { body: { chatInput, sessionId } }),
  updateShipmentStatus: (payload) => request(ENDPOINTS.shipmentStatus, { body: payload }),
  fetchTickets: () => request(ENDPOINTS.ticketsFetch, { body: { chatInput: 'FetchTickets' } }),
  createTicket: (payload) => request(ENDPOINTS.ticketsCreate, { body: payload }),
  updateTicket: (payload) => request(ENDPOINTS.ticketsUpdate, { body: payload })
};
