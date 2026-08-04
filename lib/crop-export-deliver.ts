// Kept as the crop plan's door onto the shared file-delivery helper.
//
// This module used to hold its own copy of the share-then-download logic, and
// lib/report-pdf.ts held a second copy of the same thing — both carrying the
// same bug (share sheet first on a desktop, where the sheet cannot save a
// file at all). Its own comment already said "worth merging into one helper
// once the report work lands". It landed; the merged helper is
// lib/file-delivery.ts, which also explains what went wrong.
//
// The re-export stays so crop-plan code keeps importing from the module that
// reads as its own, and so this filename still turns up in a search for "how
// does the crop plan export".

export {
  deliverFile,
  downloadFile,
  shareFile,
  openFileInTab,
  canShareFiles,
  prefersShareSheet,
  type FileDelivery,
} from '@/lib/file-delivery';
