## 2026-08-10T06:09:33Z

<USER_REQUEST>
You are Worker (Iteration 2) for Milestone 2 (Cross-Browser Storage & Messaging Fallbacks).

Working Directory: /Users/shivarampatel/Desktop/shorts-shield/.agents/worker_m2_iter2_1

REQUIRED READING (Read these files immediately):
- /Users/shivarampatel/Desktop/shorts-shield/.agents/challenger_m2_2/handoff.md
- /Users/shivarampatel/Desktop/shorts-shield/utils/storage.js
- /Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md
- /Users/shivarampatel/Desktop/shorts-shield/.agents/sub_orch_m2_storage_messaging/SCOPE.md

INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own and are permitted to edit: `utils/storage.js`.

DEFECT TO FIX IN `utils/storage.js`:
In `StorageUtil.getSettings()` and `StorageUtil.getTracking()`:
- Currently, reading from `chrome.storage.sync` and `chrome.storage.local` wraps promises with `.catch(() => null)`.
- When a storage read operation rejects due to an error (quota error, disk error, missing API, extension context invalidation), `.catch(() => null)` returns `null`.
- The method then treats `null` as if storage was empty, falls into default initialization (`buildMergedSettings(null)` / `DEFAULT_TRACKING`), and overwrites `memorySettingsCache` / `memoryTrackingCache` with default data! This destroys existing user settings and tracking stats stored in memory.

CORRECT IMPLEMENTATION REQUIREMENTS:
1. When `getSettings()` attempts to read from `chrome.storage.sync` and `chrome.storage.local`:
   - Track whether an actual error occurred during storage reading vs. normal retrieval.
   - If storage read throws an error or rejects, AND `memorySettingsCache` is non-null, DO NOT overwrite `memorySettingsCache` with default settings. Return `memorySettingsCache`!
   - Attempt `chrome.storage.sync.get`. If that throws an error, fallback to `chrome.storage.local.get`. If both fail (or sync fails and local fails with errors), and `memorySettingsCache` is non-null, return `memorySettingsCache`.
   - Only overwrite `memorySettingsCache` with `buildMergedSettings(null)` if BOTH storage read returned empty/no data AND `memorySettingsCache` is `null`.

2. Apply the identical memory cache preservation logic to `getTracking()`:
   - Attempt `chrome.storage.local.get`.
   - If `chrome.storage.local.get` throws an error or rejects, and `memoryTrackingCache` is non-null, DO NOT overwrite `memoryTrackingCache` with default tracking. Return `memoryTrackingCache`!
   - Only initialize `memoryTrackingCache` with default tracking if storage read returned empty/no data AND `memoryTrackingCache` is `null`.

VERIFICATION:
1. Run `node scratch/test-storage-bugs.js` to ensure the test passes cleanly:
   - `getSettings()` returns the existing `memorySettingsCache` on storage read failure instead of default settings.
   - `getTracking()` returns the existing `memoryTrackingCache` on storage read failure instead of default tracking.
2. Run `node scratch/adversarial-m2-test.js` to verify all adversarial checks pass.
3. Run `node -c` syntax checks across all repository JS files (`find . -name "*.js" -not -path "*/node_modules/*" -exec node -c {} +`).
4. Run master test suite (`node tests/run-tests.js`).

DELIVERABLE:
Write your handoff report to `/Users/shivarampatel/Desktop/shorts-shield/.agents/worker_m2_iter2_1/handoff.md`.

</USER_REQUEST>
