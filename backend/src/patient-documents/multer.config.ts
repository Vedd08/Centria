import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import * as fs from 'fs';

// Computed with process.cwd() (not __dirname) so this resolves identically whether the
// backend is launched via `nest start`, `node dist/main`, or `ts-node prisma/seed.ts` —
// all of which run with cwd = backend/ per the existing npm scripts.
export const PATIENT_DOCUMENTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'patient-documents');

fs.mkdirSync(PATIENT_DOCUMENTS_UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const patientDocumentMulterOptions = {
  storage: diskStorage({
    destination: PATIENT_DOCUMENTS_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, WEBP images and PDF files are allowed'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
};
