import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { join } from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDocumentDto } from './dto/create-patient-document.dto';
import { PATIENT_DOCUMENTS_UPLOAD_DIR } from './multer.config';

const DOCUMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true, role: true } },
} as const;

@Injectable()
export class PatientDocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreatePatientDocumentDto, file: Express.Multer.File, requestingUser: any) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    if (dto.visitId && dto.admissionId) {
      throw new BadRequestException('A document can be linked to a visit or an admission, not both');
    }
    if (requestingUser.role === 'NURSE' && dto.visitId) {
      throw new ForbiddenException('Nurses can only attach documents to IPD admissions, not OPD visits');
    }

    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${dto.patientId} not found in this clinic`);
    }

    if (dto.visitId) {
      const visit = await this.prisma.visit.findFirst({ where: { id: dto.visitId, clinicId } });
      if (!visit) {
        throw new NotFoundException(`Visit ID ${dto.visitId} not found`);
      }
    }
    if (dto.admissionId) {
      const admission = await this.prisma.admission.findFirst({ where: { id: dto.admissionId, clinicId } });
      if (!admission) {
        throw new NotFoundException(`Admission ID ${dto.admissionId} not found`);
      }
    }

    return this.prisma.patientDocument.create({
      data: {
        clinicId,
        patientId: patient.id,
        visitId: dto.visitId,
        admissionId: dto.admissionId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        fileName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedById: requestingUser.id,
      },
      include: DOCUMENT_INCLUDE,
    });
  }

  async findAll(
    clinicId: string,
    filters: { patientId?: string; category?: string; visitId?: string; admissionId?: string },
    requestingUser: any,
  ) {
    const where: Prisma.PatientDocumentWhereInput = { clinicId };
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.category) where.category = filters.category;
    if (filters.visitId) where.visitId = filters.visitId;
    if (filters.admissionId) where.admissionId = filters.admissionId;

    // NURSE is IPD-only — OPD (visit-linked) documents are excluded from their reads.
    if (requestingUser.role === 'NURSE') {
      where.visitId = null;
    }

    return this.prisma.patientDocument.findMany({
      where,
      include: DOCUMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const doc = await this.prisma.patientDocument.findFirst({ where: { id, clinicId }, include: DOCUMENT_INCLUDE });
    if (!doc) {
      throw new NotFoundException(`Document ID ${id} not found`);
    }
    return doc;
  }

  async remove(clinicId: string, id: string) {
    const doc = await this.findOne(clinicId, id);
    await this.prisma.patientDocument.delete({ where: { id } });

    try {
      fs.unlinkSync(join(PATIENT_DOCUMENTS_UPLOAD_DIR, doc.storedFileName));
    } catch {
      // File already missing on disk — the DB row is still the source of truth, so this
      // is not fatal.
    }

    return { id, deleted: true };
  }
}
