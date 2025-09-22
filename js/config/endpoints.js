// Central API endpoint definitions and constants
export const ENDPOINTS = {
  conversations: 'https://internsss.app.n8n.cloud/webhook/fetchFromDB',
  ordersByEmail: 'https://internsss.app.n8n.cloud/webhook/FetchOrderByEmail',
  shippingLabel: 'https://internsss.app.n8n.cloud/webhook/ShippingLabel',
  labelHistory: 'https://internsss.app.n8n.cloud/webhook/LabelHistory',
  updateStatus: 'https://internsss.app.n8n.cloud/webhook/UpdateStatus',
  sendEmail: 'https://internsss.app.n8n.cloud/webhook/sendEmail',
  shipmentStatus: 'https://internsss.app.n8n.cloud/webhook/ShipmentStatus', // assumed new endpoint for shipping request list
  orderHistory: 'https://internsss.app.n8n.cloud/webhook/FetchOrderHistory'
};

export const BUSINESS_ID = 'velit-camping-2027';

export const API_KEY_HEADER = 'x-n8n-apiKey';
export const API_KEY_VALUE = '2025@urikaDeep@km@lik$$'; // TODO: inject real key

export const FROM_ADDRESSES = ["Willy's Seattle", 'Deepak LA'];
export const PRODUCT_DIMENSIONS = ['Rooftop AC', 'AC 13000 BTU', 'Gas Heater'];

export const SHIPPING_REQUEST_STATUSES = ['open', 'in_transit', 'delivered', 'cancelled'];
