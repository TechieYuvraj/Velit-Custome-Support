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
  ticketsCreate: `${BASE_URL}/ticketcreation`
};

export const BUSINESS_ID = 'velit-camping-2027';

export const API_KEY_HEADER = 'x-n8n-apiKey';
export const API_KEY_VALUE = '2025@urikaDeep@km@lik$$'; // TODO: inject real key

export const FROM_ADDRESSES = ["Willy Seattle", 'Deepak LA'];
export const PRODUCT_DIMENSIONS = ['Rooftop AC', 'AC 13000 BTU', 'Gas Heater'];

// Detailed address book entries used to prefill editable inputs for shipping requests
export const FROM_ADDRESS_BOOK = [
  {
    fullName: 'Willy Seattle',
    senderName: 'William',
    address1: 'ABC street',
    address2: '',
    city: 'Seatle',
    state: 'WA',
    country: 'USA',
    zipCode: '12345',
    phoneNumber: '1234567890'
  },
  {
    fullName: 'Deepak LA',
    senderName: 'Deepak',
    address1: 'XYZ street',
    address2: '',
    city: 'Seatle',
    state: 'WA',
    country: 'USA',
    zipCode: '12345',
    phoneNumber: '1234567890'
  }
];

// Product dimension presets used to prefill editable package fields
export const PRODUCT_SPECS = {
  'Rooftop AC': { length: 20, width: 25, height: 12, weight: 120 },
  'AC 13000 BTU': { length: 22, width: 30, height: 20, weight: 140 },
  'Gas Heater': { length: 18, width: 20, height: 10, weight: 130 }
};

export const SHIPPING_REQUEST_STATUSES = ['open', 'in_transit', 'delivered', 'cancelled'];
