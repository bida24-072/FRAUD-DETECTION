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

---

## What actually changed

**Real multi-page structure.** Six HTML files, one shared CSS, one shared JS. Every page pulls the same `app.js` so state, auth, and the scoring engine are consistent — open Dashboard, click through to Alerts, and the alerts are there. Open Analytics and the transaction history is intact.

**Shared shell.** The sidebar, topbar, live/pause status, and burst button are rendered by `shellHTML()` and used everywhere. Only the content area changes.

**Auth guard.** `App.mount()` calls `Auth.guard()` on every page — if there's no session you're bounced to `index.html`. Sign out clears the session and redirects.

**LocalStorage persistence.** Transactions, metrics, rules, and customer history survive navigation between pages and browser refreshes. That's what makes the Alerts page useful — it shows what the Dashboard actually scored.

**README that tells the truth.** No pretending this is production. The "What this is not" section lists the seven things you'd need to make it real (backend, trained model, event bus, case management, audit trail, feedback pipeline, regulatory alignment) because that's what a serious reader will look for.

Want me to add a **seventh page** — a case management screen where clicked alerts turn into tracked cases with notes and status history?
