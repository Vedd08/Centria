import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService) {}

  async findAllRules(clinicId: string) {
    return this.prisma.commissionRule.findMany({
      where: { clinicId },
      orderBy: { role: 'asc' },
    });
  }

  async upsertRule(clinicId: string, dto: UpdateCommissionRuleDto) {
    // Note: The unique constraint must be on (role, clinicId) for true multi-tenancy.
    // If not, we might need a composite unique constraint or query first.
    // For now, assume Prisma handles role correctly, or we update rule by fetching it.
    let rule = await this.prisma.commissionRule.findFirst({ where: { role: dto.role, clinicId } });
    if (rule) {
      return this.prisma.commissionRule.update({
        where: { id: rule.id },
        data: { shareType: dto.shareType, value: dto.value },
      });
    } else {
      return this.prisma.commissionRule.create({
        data: { clinicId, role: dto.role, shareType: dto.shareType, value: dto.value },
      });
    }
  }

  async findAllRecords(clinicId: string, role?: string) {
    return this.prisma.commissionRecord.findMany({
      where: {
        clinicId,
        ...(role ? { role } : {}),
      },
      include: {
        visit: {
          include: {
            patient: true,
            doctor: true,
            rm: true,
            treatment: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Re-runs Business Rule 3 for a visit whose status or treatment changed, discarding
   * the records calculated previously. Without the delete, flipping a visit
   * New -> Follow Up would leave commissions the rule says should not exist, and
   * flipping back would duplicate them.
   */
  async recalculateForVisit(clinicId: string, visitId: string) {
    await this.prisma.commissionRecord.deleteMany({ where: { visitId, clinicId } });
    return this.calculateForVisit(clinicId, visitId);
  }

  /**
   * BUSINESS RULE 3 ENGINE:
   * Auto-calculates commission for each role from CommissionRule ONLY when visit.status === "New".
   * NEVER calculates for "Follow Up".
   */
  async calculateForVisit(clinicId: string, visitId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, clinicId },
      include: {
        patient: true,
        doctor: true,
        rm: true,
        treatment: true,
      },
    });

    if (!visit) {
      throw new NotFoundException(`Visit ID ${visitId} not found`);
    }

    if (visit.status !== 'New') {
      return {
        message: 'Business Rule 3: Visit status is Follow Up. No commission generated.',
        records: [],
      };
    }

    const rules = await this.prisma.commissionRule.findMany({ where: { clinicId } });
    const rulesMap = new Map(rules.map((r) => [r.role, r]));

    const basePriceNum = Number(visit.treatment?.price || visit.treatmentPrice || 3000.0);
    const recordsToCreate: any[] = [];

    // 1. Doctor Commission
    const doctorName = visit.doctor?.name;
    if (rulesMap.has('Doctor') && doctorName) {
      const rule = rulesMap.get('Doctor')!;
      const ruleValNum = Number(rule.value);
      const amount = rule.shareType === 'percentage' ? (basePriceNum * ruleValNum) / 100 : ruleValNum;
      recordsToCreate.push({
        clinicId,
        visitId: visit.id,
        role: 'Doctor',
        beneficiaryName: doctorName,
        visitStatus: visit.status,
        treatmentPrice: basePriceNum,
        shareType: rule.shareType,
        ruleValue: ruleValNum,
        calculatedAmount: amount,
      });
    }

    // 2. RM Commission
    const rmName = visit.rm?.name;
    if (rulesMap.has('RM') && rmName) {
      const rule = rulesMap.get('RM')!;
      const ruleValNum = Number(rule.value);
      const amount = rule.shareType === 'percentage' ? (basePriceNum * ruleValNum) / 100 : ruleValNum;
      recordsToCreate.push({
        clinicId,
        visitId: visit.id,
        role: 'RM',
        beneficiaryName: rmName,
        visitStatus: visit.status,
        treatmentPrice: basePriceNum,
        shareType: rule.shareType,
        ruleValue: ruleValNum,
        calculatedAmount: amount,
      });
    }

    // 3. Operator Commission (Free text)
    if (rulesMap.has('Operator') && visit.operator) {
      const rule = rulesMap.get('Operator')!;
      const ruleValNum = Number(rule.value);
      const amount = rule.shareType === 'percentage' ? (basePriceNum * ruleValNum) / 100 : ruleValNum;
      recordsToCreate.push({
        clinicId,
        visitId: visit.id,
        role: 'Operator',
        beneficiaryName: visit.operator,
        visitStatus: visit.status,
        treatmentPrice: basePriceNum,
        shareType: rule.shareType,
        ruleValue: ruleValNum,
        calculatedAmount: amount,
      });
    }

    // 4. Referring Doctor Commission
    if (rulesMap.has('ReferringDoctor') && visit.patient?.referringDoctor && visit.patient.referringDoctor.toLowerCase() !== 'self walk-in') {
      const rule = rulesMap.get('ReferringDoctor')!;
      const ruleValNum = Number(rule.value);
      const amount = rule.shareType === 'percentage' ? (basePriceNum * ruleValNum) / 100 : ruleValNum;
      recordsToCreate.push({
        clinicId,
        visitId: visit.id,
        role: 'ReferringDoctor',
        beneficiaryName: visit.patient.referringDoctor,
        visitStatus: visit.status,
        treatmentPrice: basePriceNum,
        shareType: rule.shareType,
        ruleValue: ruleValNum,
        calculatedAmount: amount,
      });
    }

    if (recordsToCreate.length > 0) {
      await this.prisma.commissionRecord.createMany({
        data: recordsToCreate,
      });
    }

    return {
      message: 'Business Rule 3: Commission auto-calculated successfully for New visit.',
      records: recordsToCreate,
    };
  }
}
