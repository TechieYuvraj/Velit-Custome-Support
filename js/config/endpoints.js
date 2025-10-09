// Central API endpoint definitions and constants
// export const BASE_URL = 'http://localhost:5678/webhook';  // Local dev
// export const BASE_URL = 'https://staging.app.n8n.cloud/webhook';  // Staging
export const BASE_URL = 'https://primary-production-4a6d8.up.railway.app/webhook';  // Production

export const ENDPOINTS = {
  conversations: `${BASE_URL}/fetchfromDB`,
  messages: `${BASE_URL}/fetchMessages`,
  ordersByEmail: `${BASE_URL}/FetchOrderByEmail`,
  shippingLabel: `${BASE_URL}/ShippingLabel`,
  labelHistory: `${BASE_URL}/LabelHistory`,
  updateStatus: `${BASE_URL}/UpdateStatus`,
  sendEmail: `${BASE_URL}/sendEmail`,
  orderHistory: `${BASE_URL}/FetchOrderHistory`,
  shipmentStatus: `${BASE_URL}/ShipmentStatus`,
  ticketsFetch: `${BASE_URL}/fetchTickets`,
  ticketsCreate: `${BASE_URL}/fetchTickets`
};

export const BUSINESS_ID = 'velit-camping-2027';

export const API_KEY_HEADER = 'x-n8n-apiKey';
export const API_KEY_VALUE = '2025@urikaDeep@km@lik$$'; // TODO: inject real key

export const FROM_ADDRESSES = ["Willy Seattle", 'Deepak LA'];
export const PRODUCT_DIMENSIONS = ['Rooftop AC', 'AC 13000 BTU', 'Gas Heater'];

export const SHIPPING_REQUEST_STATUSES = ['open', 'in_transit', 'delivered', 'cancelled'];
