# Dispatch: Final Forensic Integrity Auditor

**Identity**: `final_verifier_auditor_1`
**Role**: `teamwork_preview_auditor`
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/final_verifier_auditor_1`
**Project Root**: `/Users/shivarampatel/Desktop/shorts-shield`
**Original Request**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md`

## Task Instructions
1. Read `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md`.
2. Conduct full Forensic Integrity Audit across all 19 JS source files (and all 78 project JS files) and 12 extension modules.
3. Check static syntax (`node -c`) and test suite execution (`npm test` / `node run-tests.js`).
4. Perform hardcoded output detection, dummy facade detection, pre-populated artifact checks, and dependency audit.
5. Render binary verdict (`CLEAN` or `INTEGRITY VIOLATION`) in `/Users/shivarampatel/Desktop/shorts-shield/.agents/final_verifier_auditor_1/handoff.md`.
