# Flow Sentinel — Real-Time Fraud & Risk Decisioning

A working prototype of a fraud and risk decisioning system for financial services. Every transaction is scored, explained, and routed to a decision — approve, review, or decline — with full visibility into *why*.

Built for the demo and study. Not audited for production. See "What this is not" at the bottom.

---

## Structure

Every page loads the same `app.js`. Auth is checked on mount; if you're not signed in you're redirected to `index.html`.

---

## Running it

No build step. Open `index.html` in a browser, or serve locally:

```bash
python -m http.server 8000
# then visit http://localhost:8000
