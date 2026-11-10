# Creative Ops — security review

## Summary

The initial review found one MEDIUM issue. A subsequent beta pass found a separate public-file upload path; both are fixed in the current code. The final dependency audit reports zero vulnerabilities.

| # | Severity | File | Lines | Finding | Status |
|---|----------|------|-------|---------|--------|
| 1 | 🟡 MEDIUM | `src/lib/auth.ts` | 17-18, 39 | A demo MANAGER account could access the shared production database if demo sign-in were enabled. | Fixed |
| 2 | 🟡 MEDIUM | `src/components/tasks/create-task-form.tsx` | 86-89 | Reference files were uploaded to public Blob URLs instead of the private storage flow used for task attachments. | Fixed |

## Finding 1 — production demo sign-in

**Impact:** A public demo account with the MANAGER role could expose all tasks, team data, analytics, and history in a production database.

**Remediation:** Demo credentials are rejected by the server in production. The login page also hides demo-account buttons in production. Demo seeding is prohibited in production.

**Verification:** Local demo sign-in and the protected task API were smoke-tested; unauthenticated task access returns `401`. `npm audit`, TypeScript, lint, integration tests, and the production build passed. Production credentials and deployment were not tested.

## Finding 2 — public reference-file uploads

**Impact:** Reference files could be readable by anyone who obtained their public Vercel Blob URL, even though task attachments are intended to be private.

**Remediation:** Reference uploads now use private Blob access, persist the Blob pathname, and are served through the authenticated task-file endpoint. The create-task and settings messages now describe private storage.

**Verification:** TypeScript, lint, unit/integration tests, and production build pass after the change. Local storage contains no existing Vercel Blob URLs. Upload and download were not exercised because no `BLOB_READ_WRITE_TOKEN` is configured.

## Remaining operational considerations

- Private Vercel Blob access is implemented, but upload/download could not be exercised without a `BLOB_READ_WRITE_TOKEN`.
- Production Blob storage, tenant isolation, and access controls still require deployment-specific verification.
- Configure production database backups, monitoring, and rate limiting before deployment.
