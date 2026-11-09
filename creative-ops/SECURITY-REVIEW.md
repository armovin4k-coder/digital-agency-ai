# Creative Ops — security review

## Summary

The review found one MEDIUM issue. It has been fixed in the current code. The final dependency audit reports zero vulnerabilities.

| # | Severity | File | Lines | Finding | Status |
|---|----------|------|-------|---------|--------|
| 1 | 🟡 MEDIUM | `src/lib/auth.ts` | 17-18, 39 | A demo MANAGER account could access the shared production database if demo sign-in were enabled. | Fixed |

## Finding 1 — production demo sign-in

**Impact:** A public demo account with the MANAGER role could expose all tasks, team data, analytics, and history in a production database.

**Remediation:** Demo credentials are rejected by the server in production. The login page also hides demo-account buttons in production. Demo seeding is prohibited in production.

**Verification:** Local demo sign-in and the protected task API were smoke-tested; unauthenticated task access returns `401`. `npm audit`, TypeScript, lint, integration tests, and the production build passed. Production credentials and deployment were not tested.

## Remaining operational considerations

- Private Vercel Blob access is implemented, but upload/download could not be exercised without a `BLOB_READ_WRITE_TOKEN`.
- Files uploaded before the private-storage migration are not automatically moved; inventory and migrate them before relying on authenticated delivery.
- Configure production database backups, monitoring, and rate limiting before deployment.
