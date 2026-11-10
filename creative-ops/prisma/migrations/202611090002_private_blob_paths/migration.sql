-- Store private Vercel Blob paths separately from external reference URLs.
ALTER TABLE "Attachment" ADD COLUMN "storagePath" TEXT;
