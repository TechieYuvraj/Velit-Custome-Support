import { ENDPOINTS, API_KEY_HEADER, API_KEY_VALUE, BUSINESS_ID } from '../config/endpoints.js';

async function request(url, { method = 'POST', body = {}, headers = {} } = {}) {
  const finalHeaders = Object.assign({ 'Content-Type': 'application/json' }, headers);
  if (API_KEY_VALUE && API_KEY_VALUE !== '<REPLACE_WITH_KEY>') {
    finalHeaders[API_KEY_HEADER] = API_KEY_VALUE;
  }
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: method === 'GET' ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  try { return await res.json(); } catch { return null; }
}

export const api = {
  fetchConversations: (from_date, to_date) => request(ENDPOINTS.conversations, { body: { business_id: BUSINESS_ID, from_date, to_date } }),
  fetchMessages: (conversationId) => request(`${ENDPOINTS.messages}?businessid=${BUSINESS_ID}&conversation_id=${conversationId}`, { method: 'GET' }),
  fetchOrdersByEmail: (email) => request(ENDPOINTS.ordersByEmail, { body: { email } }),
  createShippingLabel: (payload) => request(ENDPOINTS.shippingLabel, { body: payload }),
  fetchLabelHistory: (email) => request(ENDPOINTS.labelHistory, { body: email ? { email } : {} }),
  updateStatus: (session_id, status, from_email) => request(ENDPOINTS.updateStatus, { method: 'PATCH', body: { session_id, status, business_id: BUSINESS_ID, from_email } }),
  sendEmail: (payload) => request(ENDPOINTS.sendEmail, { body: payload }),
  fetchOrderHistory: (sessionId, chatInput='Order History') => request(ENDPOINTS.orderHistory, { body: { chatInput, sessionId } }),
  fetchShippingRequests: (sessionId, chatInput='ShippingRequests') => request(ENDPOINTS.labelHistory, { body: { chatInput, sessionId } })
};
