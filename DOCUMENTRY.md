# Velit Support Dashboard Documentary

## 1. Project Overview
The Velit Support Dashboard is a modular, framework-free front-end built with vanilla JavaScript, HTML, and CSS. It centralizes Velits operational workflows across four primary surfaces:

- **Channels:** Email and CRM conversation center with real-time message retrieval, inline replying, and status controls.
- **Order History:** Remote-first order catalogue that normalizes Firestore and webhook payloads, supporting search and shipping workflows.
- **Shipping Requests:** Shipping label pipeline with async fulfilment simulation, status tracking, and webhook updates.
- **Tickets:** Multi-entity ticket workspace tying orders, shipments, and conversations together with creation/update tooling.

The application encourages small, composable modules, predictable state transitions, and resilient fetch strategies. Every domain operates from a shared state store and an opinionated API wrapper that adds authentication, business metadata, and graceful failure handling.

---

## 2. High-Level Goals
- Provide a **single-pane** support console without taking on the bulk of a modern framework.
- Demonstrate **remote-first** data loading with safe fallbacks, avoiding blank states when services are degraded.
- Keep **concerns separated**: views control orchestration, components encapsulate interactivity, and utilities abstract cross-cutting logic.
- Ensure future features (polling, retry UX, accessibility upgrades) can fit without re-architecting core primitives.

---

## 3. Architecture Snapshot
```
index.html                # Layout shell and top-level view containers
styles.css                # Global styling, variants, modal layouts

js/
  core/
    bootstrap.js          # App init, navigation orchestration
    state.js              # Global state store with pub/sub
    api.js                # Fetch wrapper, endpoint helpers

  config/
    endpoints.js          # Environment URLs, auth, static option lists

  views/
    customerSupportView.js    # Channels surface: Email + CRM
    orderHistoryView.js       # Order cards, search, shipping modal launch
    shippingRequestsView.js   # Label history, filters, status modal
    ticketsView.js            # Ticket hub with linking & modals

  components/
    conversationDetail.js     # Detail pane, message caching, status toggles
    shippingLabelModal.js     # Advanced shipping modal (order-driven)
    shipRequestModal.js       # Standalone shipping request form

  utils/
    format.js                 # Date/name formatting helpers
    dom.js                    # Minimal DOM utilities
    loader.js                 # Overlay/section/button loaders
    errorModal.js             # Server error modal with retry hook
```

**Key Traits**
- All scripts are ES modules imported from `index.html` via `js/core/bootstrap.js`.
- Views own data fetching and rendering; components enhance localized UI areas.
- `state.js` is the single source of truth; consumers subscribe via `subscribe` to react to mutations.
- `api.js` attaches authentication, business identifiers, and shapes request bodies without leaking secrets into call sites.

---

## 4. State & Data Flow
### 4.1 Global State Shape
```js
{
  conversations, emailConversations, crmConversations,
  orders, shippingRequests, tickets,
  selectedConversation, selectedTicket,
  currentView, loaders
}
```

### 4.2 Example Flow (Customer Support)
1. `bootstrap.switchView('customer-support')` triggers initial load once.
2. `loadCustomerSupport()` fetches conversations (`api.fetchConversations`).
3. Response is normalized to a uniform schema and split by channel.
4. `setState({ conversations, emailConversations, crmConversations })` updates the store.
5. `renderEmailList()` / `renderCRMList()` rebuild DOM; stats update via derived counts.
6. Selecting a conversation defers message fetch to `conversationDetail.js`, caching responses in `localStorage` for future sessions.

### 4.3 Shipping Request Lifecycle
1. User opens shipping modal (`openShippingLabelModal` or `openShipRequestModal`).
2. Payload is validated, metadata appended (service type, Name, Email, orderId).
3. `api.createShippingLabel()` sends request to webhook.
4. Interim placeholder with `status: 'pending'` is inserted into `state.shippingRequests`.
5. After 40 seconds (`scheduleDelayedInsert`), placeholder is replaced with a normalized record simulating asynchronous fulfilment.

---

## 5. Core Features
### Channels (Email & CRM)
- Normalizes legacy Firestore document wrappers and flat responses.
- Email panel includes sticky header, status pill, open/close toggle (PATCH via `api.updateStatus`), inline reply form (`api.sendEmail`), and message sorting.
- CRM panel renders session summaries with read-only message history.
- Error handling surfaces both view-level placeholders and modal retries.

### Order History
- Derives a session ID per fetch to satisfy webhook requirements.
- Handles multiple payload shapes, producing consistent card models with product, contact, and address info.
- Inline search filters by order id, customer identity, or location.
- Launches shipping modal with context-aware defaults and duplicate guardrails.

### Shipping Requests
- Fetches Label History, normalizing into stable IDs and statuses.
- Supports search, status filtering, stat cards, download links, and countdown timers for pending inserts.
- Update status modal issues PATCH requests with order, tracking, and creation metadata.

### Tickets
- Extensive view with Firestore normalization, stat tiles, list ordering, and a detail pane showing badges, timestamps, and internal note formatting.
- Linked entity chips open modal overlays with richer information (orders, shipments, conversations, tickets).
- Ticket creation modal offers guided dropdowns filtered by selected email, manual overrides, and multi-select linking of related entities.
- Ticket update modal allows editing of core fields plus linked references.

---

## 6. API Surface
All endpoints live under the base URL defined in `js/config/endpoints.js` (currently Railway production). Requests use POST/JSON by default, with GET for message retrieval. `api.js` injects:

- `business_id = 'velit-camping-2031'` for every request.
- `x-n8n-apiKey` header when `API_KEY_VALUE` is not the placeholder.

| Function | HTTP | Endpoint | Notes |
| --- | --- | --- | --- |
| `api.fetchConversations(from, to)` | POST | `/fetchfromDB` | Returns conversation metadata (Email + CRM). |
| `api.fetchMessages(conversationId)` | GET | `/fetchMessages` | Conversation transcript. |
| `api.fetchOrderHistory(sessionId, chatInput)` | POST | `/FetchOrderHistory` | Order list by session. |
| `api.fetchShippingRequests(sessionId, chatInput)` | POST | `/LabelHistory` | Shipping request history. |
| `api.createShippingLabel(payload, meta)` | POST | `/ShippingLabel` | Submits shipping request; `meta` becomes query string. |
| `api.updateShipmentStatus(payload)` | POST | `/ShipmentStatus` | Updates shipping request status. |
| `api.updateStatus(sessionId, status, fromEmail)` | PATCH | `/UpdateStatus` | Toggle conversation open/closed. |
| `api.sendEmail(payload)` | POST | `/sendEmail` | Replies to conversation threads. |
| `api.fetchTickets()` | POST | `/fetchTickets` | Ticket list retrieval. |
| `api.createTicket(payload)` | POST | `/ticketcreation` | New ticket with linked entities. |
| `api.updateTicket(payload, meta)` | PATCH | `/updatetickets` | Ticket edits, optionally annotated by creationId. |

---

## 7. UI & UX Conventions
- **Navigation:** Primary tabs align with view modules; sub-nav toggles Channel panes without re-fetching.
- **Loaders:** `utils/loader.js` produces overlay, section, and button spinners, maintaining relative positioning automatically.
- **Status Badges:** Shared CSS classes (`status-open`, `status-pending`, etc.) keep color semantics consistent across lists and detail views.
- **Sticky Elements:** Conversation headers, reply boxes, and modal headers remain visible during scroll for context retention.
- **Forms:** Shipping modals and ticket modals presupply data from address books or state slices; duplicate detection prevents redundant submissions.
- **Error Feedback:** Each view swaps to descriptive fallback messaging and optionally triggers `showServerErrorModal()` for retry.

---

## 8. Error Handling Strategy
1. **Network Failures:** Wrapped in `try/catch`; failures log diagnostic output, reset state to safe defaults, and show user-facing alerts.
2. **Global Modal:** `showServerErrorModal(message, onRetry)` provides consistent retry behavior across views.
3. **Optimistic Updates:** Actions like sending emails or toggling statuses render local changes immediately after successful API calls, with loader wrappers preventing double submits.
4. **Duplicate Guards:** Shipping request and order flows check existing state to avoid duplicate label creation or conflicting entries.

---

## 9. Extensibility Guidelines
- Add new top-level surfaces under `js/views/`, expose `init*` APIs, and register them in `bootstrap.js` navigation.
- Extend `state.js` cautiously: maintain flat keys per domain; use `updateArray` helper for atomic array mutations.
- Normalize external payloads at entry points (View loaders) to protect render logic from schema shifts.
- Reuse loader/error utilities for consistent UX; prefer small, reusable modal helpers for future dialogs.
- Keep CSS declarative; avoid inline styles unless dynamically generated values are required.

---

## 10. Setup & Runbook
1. Clone repository.
2. Update `API_KEY_VALUE` in `js/config/endpoints.js` with environment-specific credentials.
3. Open `index.html` directly or via static server (e.g., `python -m http.server 8080`).
4. Verify network calls in DevTools; ensure CORS allows the chosen origin.
5. For mock/offline mode, comment out `BASE_URL` or stub fetch responses in `api.js` as needed.

---

## 11. Roadmap & Known Gaps
- **Accessibility:** Add ARIA roles for tab controls, keyboard navigation between lists, focus management for modals.
- **Loader Standardization:** Promote loaders to reusable components, ensuring consistent placement and removal across views.
- **Retry Components:** Introduce reusable retry blocks for inline errors beyond the global modal.
- **Auto-refresh:** Optional polling or manual refresh for conversations and tickets.
- **Styling Cleanup:** Consolidate inline style fragments into `styles.css`; consider CSS variables for theming/dark mode.

---

## 12. Glossary
- **Remote-first:** Attempt live API fetch before falling back to cached or mock data.
- **Normalization:** Transforming heterogeneous webhook or Firestore documents into uniform in-app models.
- **Status Pill:** Rounded badge indicating entity state (open, closed, pending, etc.).
- **Ticket Nugget:** Small linked-entity chip that opens contextual modal details.
- **CreationId:** Firestore document ID captured for mutation correlation.

---

## 13. Contact
Project owner: **TechieYuvraj**. For enhancements, issues, or integrations, leverage the repos issue tracker or extend the roadmap outlined above.
