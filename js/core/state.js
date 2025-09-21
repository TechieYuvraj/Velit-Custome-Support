// Simple global state store with pub/sub
export const state = {
  conversations: [],
  emailConversations: [],
  crmConversations: [],
  orders: [],
  shippingRequests: [],
  selectedConversation: null,
  currentView: 'customer-support', // 'order-history' | 'shipping-requests' | 'customer-support'
  loaders: {},
};

const listeners = new Set();

export function subscribe(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch){
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function updateArray(key, updater){
  state[key] = updater(state[key] || []);
  listeners.forEach(fn => fn(state));
}
