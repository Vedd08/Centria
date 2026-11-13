import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { PatientDocumentsService } from './patient-documents.service';

/** How long a scanned QR code keeps working. */
const LINK_TTL_MINUTES = 20;
const CATEGORIES = ['LAB_REPORT', 'SCAN_IMAGE', 'PRESCRIPTION_SCAN', 'DISCHARGE_SUMMARY', 'OTHER'];

/**
 * Its own signing key, derived from the app secret. A sign-in token and an upload
 * link must never be interchangeable: the login strategy accepts anything signed
 * with JWT_SECRET, so an upload link signed with it would work as a 20-minute login.
 */
const linkSecret = () => `${process.env.JWT_SECRET || 'dev-fallback-change-in-production'}::patient-document-upload`;

interface UploadLinkClaims {
  typ: 'doc-upload';
  pid: string; // patient
  cid: string; // clinic
  uid: string; // staff member who opened the QR code — the upload is recorded as theirs
  role: string;
  aid?: string; // admission to link uploads to
  vid?: string; // visit to link uploads to
}

/**
 * QR-code upload from a phone: staff on a laptop open a short-lived link scoped to
 * one patient, scan it with a phone, and photos taken there land in that patient's
 * documents without anyone signing in on the phone.
 */
@Injectable()
export class MobileUploadService {
  private readonly jwt = new JwtService({ secret: linkSecret() });

  constructor(
    private prisma: PrismaService,
    private documents: PatientDocumentsService,
  ) {}

  async createLink(clinicId: string, dto: { patientId: string; admissionId?: string; visitId?: string }, user: any) {
    if (!dto?.patientId) throw new BadRequestException('Patient is required');
    if (dto.admissionId && dto.visitId) {
      throw new BadRequestException('A document can be linked to a visit or an admission, not both');
    }
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient not found in this clinic');

    const claims: UploadLinkClaims = {
      typ: 'doc-upload',
      pid: patient.id,
      cid: clinicId,
      uid: user.id,
      role: user.role,
      ...(dto.admissionId ? { aid: dto.admissionId } : {}),
      ...(dto.visitId ? { vid: dto.visitId } : {}),
    };
    const token = await this.jwt.signAsync(claims, { expiresIn: `${LINK_TTL_MINUTES}m` });
    return { token, expiresAt: new Date(Date.now() + LINK_TTL_MINUTES * 60000).toISOString() };
  }

  private async verify(token: string): Promise<UploadLinkClaims & { exp: number }> {
    try {
      const claims = await this.jwt.verifyAsync<UploadLinkClaims & { exp: number }>(token);
      if (claims.typ !== 'doc-upload') throw new Error('wrong token type');
      return claims;
    } catch {
      throw new UnauthorizedException('This upload link has expired. Ask for a new QR code on the computer.');
    }
  }

  /** What the phone shows so staff can confirm they're uploading to the right patient. */
  async describe(token: string) {
    const claims = await this.verify(token);
    const patient = await this.prisma.patient.findFirst({
      where: { id: claims.pid, clinicId: claims.cid },
      select: { name: true, uhid: true, clinic: { select: { name: true } } },
    });
    if (!patient) throw new NotFoundException('This patient no longer exists');
    return {
      patientName: patient.name,
      uhid: patient.uhid,
      clinicName: patient.clinic?.name ?? '',
      expiresAt: new Date(claims.exp * 1000).toISOString(),
    };
  }

  async upload(token: string, body: { category?: string; title?: string }, file: Express.Multer.File) {
    try {
      return await this.saveUpload(token, body, file);
    } catch (error) {
      // Multer has already written the file by now; don't leave an orphan behind
      // when the link is expired or the upload is otherwise refused.
      if (file?.path) fs.promises.unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  private async saveUpload(token: string, body: { category?: string; title?: string }, file: Express.Multer.File) {
    const claims = await this.verify(token);
    // The staff member must still have an account in that clinic.
    const uploader = await this.prisma.user.findFirst({
      where: { id: claims.uid, clinicId: claims.cid },
      select: { id: true, role: true },
    });
    if (!uploader) throw new UnauthorizedException('This upload link is no longer valid');

    const category = body?.category && CATEGORIES.includes(body.category) ? body.category : 'SCAN_IMAGE';
    // Same "Photo dd-mm-yyyy hh:mm" the app uses; the phone normally sends its own.
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const title =
      body?.title?.trim() ||
      `Photo ${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

    return this.documents.create(
      claims.cid,
      { patientId: claims.pid, category, title, admissionId: claims.aid, visitId: claims.vid },
      file,
      uploader,
    );
  }
}
