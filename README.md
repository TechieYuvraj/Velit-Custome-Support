# Velit Customer Support Dashboard

A lightweight, modular, vanilla JavaScript dashboard for managing Orders, Shipping Requests, and Customer Support Conversations (Email + CRM/In-App channels). Built without frameworks to keep the footprint minimal while demonstrating a clean separation of concerns, remote-first data fetching with graceful fallback, and evolving UI/UX patterns.

---
## Table of Contents
1. Overview
2. Core Features
3. Architecture & Modules
4. Data Flow & State Management
5. API Layer & Endpoints
6. Webhook Payload Shapes
7. Normalization & Mapping Strategies
8. UI / UX Conventions
9. Shipping Label Request Lifecycle
10. Conversation Center (Email & CRM)
11. Status Handling & Badge System
12. Error Handling (Planned Enhancements)
13. Accessibility Roadmap (Planned)
14. Development & Project Structure
15. Setup & Running Locally
16. Extensibility Guidelines
17. Roadmap / TODO Summary
18. Glossary

---
## 1. Overview
The dashboard provides three primary operational views:
- Order History: Remote-first retrieval of customer orders with fallback to mock dataset.
- Shipping Requests: Normalized view of shipping label requests via webhook, including delayed insertion of newly created requests.
- Customer Support: Unified access to Email and CRM (in-app public) conversations with message viewing and status control.

The system emphasizes resilience, modularity, and an iterative build style. Every evolution (layout refactor, data source change, new component) preserved separation through dedicated modules (`/js/views`, `/js/components`, `/js/core`).

---
## 2. Core Features
- Remote-first Order History fetch with mock fallback + source indicator + retry.
- Shipping Request management with status aggregation, delayed injection (simulated async processing), and label action.
- Create Shipping Label modal with validation, structured payload, and request simulation.
- Unified conversation center with split Email vs CRM channel filtering.
- Sticky conversation header + status pill + reopen/close toggle.
- Status badge theming with consistent variants across lists and detail views.
- Central state store with pub/sub and minimal mutation surface.
- Normalized heterogeneous webhook payloads into stable internal models.

---
## 3. Architecture & Modules
```
/js
  /config        -> Endpoint constants, static option lists
  /core          -> api.js, state.js, bootstrap.js (app init + navigation)
  /utils         -> format helpers (date formatting, name extraction)
  /views         -> orderHistoryView.js, shippingRequestsView.js, customerSupportView.js
  /components    -> conversationDetail.js, shippingLabelModal.js
index.html       -> Root layout + view containers + sub navigation
styles.css       -> Global styles + component + variant styling
script.js        -> Legacy monolithic (retained for reference; superseded)
```
Key principles:
- Views own data loading & high-level rendering.
- Components encapsulate modular interactive units (modal, detail pane).
- Core layer abstracts platform concerns (network + state + bootstrap).

---
## 4. Data Flow & State Management
State lives in `state.js` with a simple object + `setState` and `subscribe` pub/sub.
```
state = {
  conversations, emailConversations, crmConversations,
  orders, ordersSource, shippingRequests,
  selectedConversation, currentView, loaders
}
```
Flow Example (Order History):
1. `orderHistoryView.loadOrders()` calls `api.fetchOrderHistory()`.
2. On success: normalize + `setState({ orders, ordersSource: 'live' })`.
3. On failure: use mocks + `ordersSource: 'mock'`.
4. View re-renders reactive elements (source badge, retry button).

Shipping Requests lifecycle includes a delayed insertion (40s) of newly created labels to simulate asynchronous fulfillment.

---
## 5. API Layer & Endpoints
Implemented in `core/api.js` with a generic `request()` helper adding conditional API key header.
Endpoints (from `config/endpoints.js`):
- `fetchFromDB` (Conversations)
- `FetchOrderHistory` (Order history by chatInput + sessionId)
- `LabelHistory` (Shipping requests + reused for list refresh)
- `ShippingLabel` (Create label request)
- `FetchOrderByEmail`
- `UpdateStatus` (Conversation open/close)
- `sendEmail`
- (Legacy) `ShipmentStatus` (replaced by `LabelHistory`)

Invocation Patterns:
```
api.fetchConversations(fromISO, toISO)
api.fetchOrderHistory(sessionId, chatInput)
api.fetchShippingRequests(sessionId, chatInput)
api.createShippingLabel(payload)
api.updateStatus(session_id, status, from_email)
```

---
## 6. Webhook Payload Shapes
### Conversations (example excerpt)
```
{
  conversation_id, channel_type, session_id,
  name, email, subject, started_at, status,
  messages: [ { message_id, sender, sender_id, timestamp, message, image_link } ]
}
```
- `channel_type`: `email` or `inapp_public` (CRM bucket)
- Some CRM rows have empty `name` & `status` (handled gracefully).

### Shipping Requests (LabelHistory normalized)
```
{
  requestId, orderId, product, status, trackingNumber,
  name, email, url, createdAt, address
}
```
### Orders (FetchOrderHistory abstraction)
Flexible mapping with address + contact normalization; date fallback when absent.

---
## 7. Normalization & Mapping Strategies
- Canonical status tokens: lowercased + spaces replaced with `_` (e.g., "In Transit" -> `in_transit`).
- Addresses flattened & multiline preserved for modal preview.
- Unknown / missing fields receive safe defaults (`''`, `Unknown`, or `[]`).
- Conversations separate channel grouping at load to reduce per-render filtering.

---
## 8. UI / UX Conventions
- Remote-first → fallback → user-notified (Order History only currently, planned generalization).
- Sticky header & sticky reply region ensure context while scrolling.
- Sub navigation (Email/CRM) uses active class toggling + accessible color contrast.
- Minimal inline styles: gradually migrated to central CSS (ongoing refactor target).
- Stats components: consistent small-caps label + bold numeric value.

---
## 9. Shipping Label Request Lifecycle
1. User opens modal (prefilled when launched from conversation context if future integration reintroduced).
2. User selects from-address & product dimensions.
3. Form POSTs via `api.createShippingLabel()` (response body ignored intentionally for decoupling).
4. Immediate success message + optimistic feedback.
5. After 40s timer, synthetic pending record inserted into `shippingRequests` with `status=open` if still absent.

---
## 10. Conversation Center (Email & CRM)
- Conversations fetched once per app load (fixed ISO range constants currently).
- Email list rows: Name, Email, Date (right), Status (under Date), Subject.
- CRM list rows: Session ID, Date (right), Subject.
- Detail panel (Email): Subject, status pill, reopen/close button, messages, reply bar.
- Detail panel (CRM): Session-based heading + messages (read-only for now).
- Images gracefully fallback to placeholder if invalid.

---
## 11. Status Handling & Badge System
Classes:
```
.status-open
.status-closed
.status-pending (and .status-na)
```
Applied to both list items and detail header pills. Unified style via `.conversation-status, .conv-status-pill` base styling (rounded pill, color-coded backgrounds).

---
## 12. Error Handling (Planned Enhancements)
Current: Basic console warnings + empty-state / error placeholders.
Planned:
- Reusable `<RetryBlock>` component.
- Standard schema: `{ title, message, actionLabel, onRetry }`.
- Distinct visual states: loading → error → empty.

---
## 13. Accessibility Roadmap (Planned)
- ARIA roles for tablist (Email/CRM) and status toggles.
- Focus management when switching conversations (scroll + focus the first unread message / header).
- Keyboard navigation: Up/Down to move conversation selection.
- Modal focus trap for Shipping Label creation.

---
## 14. Development & Project Structure
Single-page static asset pattern: open `index.html` directly or serve via any static server. No bundler required.

Suggested local server (optional):
```
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

---
## 15. Setup & Running Locally
1. Clone repository.
2. (Optional) Provide API key: edit `js/config/endpoints.js` replacing `<REPLACE_WITH_KEY>`.
3. Open `index.html` in a browser (Chrome recommended).
4. Inspect network calls to confirm webhook accessibility (CORS must permit origin).

Environment Variables (future enhancement): Could migrate API key to build step or `.env` with bundler introduction.

---
## 16. Extensibility Guidelines
When adding new functionality:
- Place fetch + list rendering in a new View module when it represents a top-level surface.
- Extract repeated DOM logic into Components (e.g., future loaders, retry blocks).
- Extend `state` cautiously; prefer arrays keyed by domain (e.g., `tickets`, `notifications`).
- Normalize external payloads at the boundary (API layer or view loader) to insulate renderers.
- Avoid coupling components to fetch logic—pass data or read from state.

Code Style Preferences:
- ES Modules only.
- No global function declarations (except bootstrap init).
- Minimal comments unless clarifying non-obvious normalization logic.

---
## 17. Roadmap / TODO Summary
Remaining (planned / not started):
- Global loaders & per-button spinners.
- Unified search + status filtering abstraction.
- Error & retry UX standardization.
- Accessibility (ARIA roles, keyboard nav, focus management, modal trap).
- Potential conversation auto-refresh / polling or manual refresh button.
- Extract inline style remnants into `styles.css` fully.
- Add conversation send confirmation + optimistic append.
- Dark mode (theming via CSS variables) – candidate future enhancement.

Completed Highlights:
- Multi-view modularization
- Order History remote-first with fallback & source indicator
- Shipping Requests normalization + card redesign
- Shipping Label modal refactor (lean request form)
- Conversation center with channel segmentation and sticky UI improvements

---
## 18. Glossary
- Conversation: A thread of messages associated with a `conversation_id` (Email or CRM channel).
- Shipping Request: A pending or fulfilled label creation record derived from the LabelHistory webhook.
- Remote-first: Attempt live fetch before falling back to mock static dataset.
- Normalization: Transforming external payloads to internal, predictable structures before rendering.
- Status Pill: Visual tag representing entity lifecycle state (open/closed/pending/etc.).

---
## License
Currently unspecified (internal use). Add an OSS license (MIT/Apache-2.0) if external distribution is intended.

---
## Contact / Ownership
Owner: Internal (Velit / TechieYuvraj). For enhancements or integration queries, open an issue or extend the TODO roadmap.

---
*This README will evolve alongside upcoming loader, accessibility, and error handling implementations.*
