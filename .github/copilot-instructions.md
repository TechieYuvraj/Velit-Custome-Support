# Velit Support Dashboard - AI Development Guide

## Project Overview
Vanilla JavaScript customer support dashboard managing Orders, Shipping Requests, Conversations (Email/CRM), and Tickets. **No frameworks** - built with ES6 modules for minimal footprint and clean separation of concerns.

## Architecture Pattern

### Modular Structure (NO Monolithic Files)
```
/js
  /core       → Application lifecycle & cross-cutting concerns
    bootstrap.js   - App initialization, navigation, view switching
    state.js       - Pub/sub state store with setState/subscribe
    api.js         - Centralized API layer with request() helper
  /config     → Static configuration
    endpoints.js   - API endpoints, business constants, presets
  /views      → Feature-specific data loading & rendering
    customerSupportView.js, orderHistoryView.js, shippingRequestsView.js, ticketsView.js
  /components → Reusable interactive UI components
    conversationDetail.js, shippingLabelModal.js, shipRequestModal.js
  /utils      → Shared helpers
    format.js, loader.js, dom.js, errorModal.js
```

**Critical Rule**: Never create or edit `script.js` - it's legacy and removed. All code belongs in the modular structure above.

## State Management

### Central Store Pattern (`core/state.js`)
```javascript
// Single source of truth
state = {
  conversations, emailConversations, crmConversations,
  orders, shippingRequests, tickets,
  selectedConversation, selectedTicket, currentView
}

// Mutation API
setState({ orders: [...] })           // Shallow merge
updateArray('tickets', arr => [...])  // Array transformer
subscribe(fn => {...})                // Reactive listener
```

**Views subscribe to state changes** - rendering is reactive, not imperative.

## Data Normalization & API Layer

### API Request Pattern (`core/api.js`)
- **All requests** auto-inject `business_id: 'velit-camping-2031'`
- **All requests** conditionally add `x-n8n-apiKey` header if configured
- Use named API methods: `api.fetchConversations(from, to)`, `api.createShippingLabel(payload, meta)`
- **Never** construct fetch calls directly - always use `api.*` methods

### Firestore Document Unwrapping
When processing API responses, **always handle both flat and Firestore shapes**:
```javascript
// Firestore shape: { document: { fields: { key: { stringValue: 'val' } } } }
const val = (field) => {
  if (!field || typeof field !== 'object') return field;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return String(field.integerValue);
  if ('timestampValue' in field) return field.timestampValue;
  // ... handle other Firestore types
  return field;
};
```
See `customerSupportView.js:normalizeFirestoreResponse()` and `shippingRequestsView.js:normalizeRequest()` for reference.

### Status Canonicalization
**Always** normalize status fields: lowercase + replace spaces with underscores
```javascript
const status = (rawStatus || 'pending').toString().trim().toLowerCase().replace(/\s+/g,'_');
// "In Transit" → "in_transit"
```

## View Lifecycle & Loading Patterns

### View Initialization (See `bootstrap.js:switchView()`)
1. **Lazy load views** - fetch data only when view becomes active
2. **Show overlay loader** before async operations: `showLoader(section, 'overlay')`
3. **Hide loader** in finally block: `hideLoader(section, 'overlay')`
4. **Background prefetch** - all views load in parallel on app init without blocking UI

### Refresh Pattern
Each view has a refresh button that calls:
```javascript
await loadOrders({ retry: true })        // Force reload
await loadShippingRequests({ force: true })
```

## UI Component Patterns

### Modal Creation (`components/shippingLabelModal.js`, `shipRequestModal.js`)
1. **Ensure container exists**: `ensureModal()` creates if missing
2. **Set display flex**: `modal.style.display='flex'`
3. **Build innerHTML** with full form structure
4. **Attach close handler**: `modal.querySelector('#close-*').onclick`
5. **Form submit**: prevent default, build payload, call API, show feedback

### Button Loading States (`utils/loader.js`)
```javascript
await withButtonLoader(button, async () => {
  await api.someAction();
}, 'Loading...');
// Disables button, shows loader, restores original state after
```

### Sticky Headers & Footers
Conversation detail uses sticky positioning:
```javascript
style="position:sticky;top:0;z-index:5;background:#fff;..."
```

## Status Badge System

### Consistent CSS Classes
```css
.status-open, .status-closed, .status-pending, .status-in_transit, 
.status-delivered, .status-cancelled
```
Apply to both list items AND detail pills. Use `status-${canonicalStatus}` pattern.

## Error Handling

### Server Error Modal (`utils/errorModal.js`)
```javascript
showServerErrorModal('Failed to load X. Server not responding.', 
  () => retryFunction()
);
```
Displays overlay with retry option. **Use in all catch blocks** for network failures.

### Validation Patterns
- **Check required fields** before API submission
- **Show inline feedback**: `respDiv.innerHTML = '<span style="color:#b00020;">Error</span>'`
- **Disable submit button** during processing: `button.disabled = true`

## Session ID Generation
Time-based session IDs used for remote requests:
```javascript
function buildSessionId(){
  const d=new Date();
  const pad=n=> String(n).padStart(2,'0');
  return pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+
         pad(d.getDate())+pad(d.getMonth()+1)+d.getFullYear();
}
```

## Shipping Request Lifecycle
1. User creates request via modal → API POST
2. **Delayed insertion** (40s) simulates async processing
3. Request appears in list with `status=open` or `status=pending`
4. User can update status via modal

## Conversation Center Specifics

### Channel Separation
- **Email**: `channel_type === 'email'` → shows name, email, subject, status pill, reply box
- **CRM**: `channel_type === 'inapp_public'` → shows session_id, subject (no status toggle)

### Message Fetching
- **Lazy load**: Messages fetched only when conversation selected
- **Cache per session**: `getCachedMessages()` / `setCachedMessages()` prevent re-fetch
- **Sorted chronologically**: Always sort messages by timestamp before render

### Reply Pattern
```javascript
sendButton.onclick = async () => {
  const payload = { 
    business_id: BUSINESS_ID,
    "to-email": conversation.email,
    content: inputValue,
    context: { conversation_id, session_id, status, ... }
  };
  await api.sendEmail(payload);
};
```

## Development Workflow

### Local Server (Optional)
```bash
python -m http.server 8080
# OR
npx serve .
```
Then open `http://localhost:8080`

### Adding New Features
1. **Identify module type**: View, Component, or Util?
2. **Create file** in appropriate `/js` subdirectory
3. **Export public API**: Named exports for functions/constants
4. **Import in bootstrap.js** if new view needs navigation
5. **Update state.js** if new data entities required
6. **Add API method** in `api.js` for new endpoints
7. **Follow normalization patterns** for Firestore responses

### Environment Switching
Edit `config/endpoints.js` BASE_URL:
```javascript
// export const BASE_URL = 'http://localhost:5678/webhook';  // Local
// export const BASE_URL = 'https://staging.app.n8n.cloud/webhook';  // Staging
export const BASE_URL = 'https://primary-production-4a6d8.up.railway.app/webhook';
```

## Key Constants & Presets

**FROM_ADDRESSES**: Sender presets for shipping labels  
**PRODUCT_DIMENSIONS**: Package size presets  
**FROM_ADDRESS_BOOK**: Full address objects with phone, zipcode, etc.  
**PRODUCT_SPECS**: Dimensions (length, width, height, weight) per product  
**BUSINESS_ID**: `'velit-camping-2031'` - injected in all API requests

## Testing & Debugging

- **Console logs**: Extensive logging in normalization functions - check browser console
- **Network tab**: Verify `business_id` and `x-n8n-apiKey` in request headers
- **State inspection**: `window.state` available in console (import in dev)
- **Mock fallback**: Order History falls back to mock data on API failure (see `orderHistoryView.js`)

## Common Gotchas

1. **Don't use inline fetch** - Always use `api.*` methods
2. **Don't mutate state directly** - Use `setState()` or `updateArray()`
3. **Don't skip Firestore unwrapping** - Always check for `document.fields` shape
4. **Don't forget loader cleanup** - Use `finally` blocks
5. **Don't reuse monolithic patterns** - Keep separation: view owns data, component owns UI
6. **Always escape HTML** in user-generated content: `escapeHtml(str)`
7. **Check for duplicate shipping requests** before creation (by `orderId`)

## Future Enhancements (Roadmap)
- **Accessibility**: ARIA roles for tabs, focus management, keyboard navigation
- **Retry blocks**: Reusable error component with structured schema
- **Real-time updates**: WebSocket integration for live conversation updates
- **Test coverage**: Unit tests for normalization & state mutations
