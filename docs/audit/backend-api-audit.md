# Backend & IPC Messaging Audit Report

> **Auditor**: Backend & API Specialist  
> **Target**: Chrome Service Worker (`background/background.js`) & IPC Messaging Flow

---

## Executive Summary

Audited Chrome MV3 service worker messaging lifecycle, tab update listeners, history state updates, web navigation filtering, and options tab deduplication router.

---

## Messaging & API Matrix

| Message Type / Action | Sender | Receiver | Payload | Validation & Handling |
|---|---|---|---|---|
| `openOptionsPage` | Popup / HUD / Content | Service Worker | `{ action: "openOptionsPage" }` | Queries existing options tabs. If found, activates tab and focuses window; if none, creates new options tab. |
| `storage.onChanged` | Chrome Storage | Content / Popup / Options | Settings / Tracking Delta | Asynchronously broadcasts changes to all active views and updates in-memory caches. |
| `onBeforeNavigate` | Web Navigation API | Service Worker | `{ url, tabId, frameId }` | Intercepts main frame (frameId: 0) `/shorts/` or `/playables/` and redirects to YouTube Home. |
| `onHistoryStateUpdated` | Web Navigation API | Service Worker | `{ tabId, url }` | Replaces browser history state for redirected shorts navigation to prevent back-button loops. |
| `tabs.onRemoved` | Chrome Tabs API | Service Worker | `tabId` | Cleans up pending session replacement entries in `chrome.storage.session`. |