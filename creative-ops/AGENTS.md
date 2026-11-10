# Creative Ops engineering rules

- Keep the Next.js App Router, TypeScript, PostgreSQL, Prisma, NextAuth Credentials, Zod, dnd-kit, Recharts, Vercel Blob, Vitest, and Vercel architecture.
- Enforce BUYER, CREATIVE, and MANAGER permissions in server services; client visibility is not authorization.
- Keep status mutations and their ActivityLog records in the same Prisma transaction. Use conditional updates/serializable transactions for concurrent transitions.
- Keep private task files behind authenticated routes and task-level authorization. Never expose Blob tokens or enable production demo sign-in against a database containing real data.
- Preserve existing data with additive Prisma migrations; only run the demo seed in production against a dedicated demo database after explicitly setting `SEED_ISOLATED_DEMO_DATABASE=true` and `DEMO_DATABASE_ISOLATED=true`.
- Update the relevant Russian documentation and tests with behavior changes.
- Validate changes with Prisma generate/validate, TypeScript, ESLint, Vitest, production build, and PostgreSQL migration/API checks where available.
