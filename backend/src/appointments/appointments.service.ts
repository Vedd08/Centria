import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  public buildSlotKey(doctorId: string, startTime: Date): string {
    return `${doctorId}|${startTime.toISOString()}`;
  }

  private _computeSlots(sessions: any[], existingAppointments: any[]) {
    const bookedMinutes = new Set(
      existingAppointments.map(a => {
        const d = new Date(a.startTime);
        return d.getHours() * 60 + d.getMinutes();
      })
    );

    const slotDurationMap: Record<string, number> = {};
    const slots = [];
    
    for (const session of sessions) {
      const [startH, startM] = session.startTime.split(':').map(Number);
      const [endH, endM] = session.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const duration = session.slotDurationInMinutes;

      for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
        const hStr = Math.floor(m / 60).toString().padStart(2, '0');
        const mStr = (m % 60).toString().padStart(2, '0');
        const timeStr = `${hStr}:${mStr}`;
        if (!bookedMinutes.has(m)) {
          slots.push(timeStr);
        }
        slotDurationMap[timeStr] = duration;
      }
    }
    
    const uniqueSlots = [...new Set(slots)].sort();
    return { slots: uniqueSlots, slotDurationMap };
  }

  async create(createAppointmentDto: CreateAppointmentDto, clinicId: string) {
    const { endTime: _dropped, ...rest } = createAppointmentDto;

    return this.prisma.$transaction(async (tx) => {
      const startTimeDate = new Date(rest.startTime);
      const dayOfWeek = startTimeDate.getDay();
      const doc = await tx.user.findFirst({ where: { id: rest.doctorId } });
      const doctorName = doc ? doc.name : 'Unknown';
      
      const sessions = await tx.doctorSchedule.findMany({
        where: { clinicId, doctorId: rest.doctorId, dayOfWeek }
      });

      if (sessions.length === 0) {
        throw new BadRequestException(`Dr. ${doctorName} has no session on this weekday`);
      }

      const startOfDay = new Date(startTimeDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startTimeDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointments = await tx.appointment.findMany({
        where: { clinicId, doctorId: rest.doctorId, startTime: { gte: startOfDay, lte: endOfDay }, status: { notIn: ['Cancelled', 'No-Show'] } }
      });

      const { slots, slotDurationMap } = this._computeSlots(sessions, existingAppointments);
      const targetH = startTimeDate.getHours().toString().padStart(2, '0');
      const targetM = startTimeDate.getMinutes().toString().padStart(2, '0');
      const targetTimeStr = `${targetH}:${targetM}`;

      if (!slots.includes(targetTimeStr)) {
        throw new BadRequestException(`${targetTimeStr} is not a valid open slot in this session`);
      }

      const slotDuration = slotDurationMap[targetTimeStr] || sessions[0].slotDurationInMinutes;
      const endTimeDate = new Date(startTimeDate.getTime() + slotDuration * 60000);
      const slotKey = this.buildSlotKey(rest.doctorId, startTimeDate);

      try {
        return await tx.appointment.create({
          data: {
            ...rest,
            endTime: endTimeDate,
            slotKey,
            clinicId,
          },
          include: {
            patient: true,
            doctor: { select: { id: true, name: true, email: true } },
          }
        });
      } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('slotKey')) {
          throw new ConflictException('That slot was just taken — pick another');
        }
        throw error;
      }
    }, TRANSACTION_OPTIONS);
  }

  async findAll(clinicId: string, params: { date?: string, from?: string, to?: string, doctorId?: string, status?: string }) {
    const where: any = { clinicId };
    
    if (params.doctorId) where.doctorId = params.doctorId;
    if (params.status) where.status = params.status;
    
    if (params.from || params.to) {
      where.startTime = {};
      if (params.from) where.startTime.gte = new Date(params.from);
      if (params.to) where.startTime.lte = new Date(params.to);
    } else {
      const now = new Date();
      let targetDate = params.date ? new Date(params.date) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (params.date) {
        const [y, m, d] = params.date.split('-').map(Number);
        targetDate = new Date(y, m - 1, d);
      }
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.startTime = { gte: startOfDay, lte: endOfDay };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string, clinicId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, clinicId: string) {
    const existing = await this.findOne(id, clinicId);
    const { endTime: _dropped, ...rest } = updateAppointmentDto;

    return this.prisma.$transaction(async (tx) => {
      const finalData: any = { ...rest };
      
      const isStatusCancelledOrNoShow = (status?: string) => status === 'Cancelled' || status === 'No-Show';
      const wasCancelledOrNoShow = isStatusCancelledOrNoShow(existing.status);
      const isNowCancelledOrNoShow = isStatusCancelledOrNoShow(rest.status || existing.status);
      
      const startTimeStr = rest.startTime || existing.startTime.toISOString();
      const doctorId = rest.doctorId || existing.doctorId;
      
      const timeOrDoctorChanged = (rest.startTime && new Date(rest.startTime).getTime() !== existing.startTime.getTime()) || (rest.doctorId && rest.doctorId !== existing.doctorId);
      const unCancelled = wasCancelledOrNoShow && !isNowCancelledOrNoShow;
      
      if (timeOrDoctorChanged || unCancelled) {
        const startTimeDate = new Date(startTimeStr);
        const dayOfWeek = startTimeDate.getDay();
        const doc = await tx.user.findFirst({ where: { id: doctorId } });
        
        const sessions = await tx.doctorSchedule.findMany({
          where: { clinicId, doctorId, dayOfWeek }
        });

        if (sessions.length === 0) {
          throw new BadRequestException(`Dr. ${doc?.name || 'Unknown'} has no session on this weekday`);
        }
        
        const startOfDay = new Date(startTimeDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startTimeDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingAppointments = await tx.appointment.findMany({
          where: { clinicId, doctorId, startTime: { gte: startOfDay, lte: endOfDay }, status: { notIn: ['Cancelled', 'No-Show'] }, id: { not: id } }
        });
        
        const { slots, slotDurationMap } = this._computeSlots(sessions, existingAppointments);
        const targetH = startTimeDate.getHours().toString().padStart(2, '0');
        const targetM = startTimeDate.getMinutes().toString().padStart(2, '0');
        const targetTimeStr = `${targetH}:${targetM}`;
        
        if (!slots.includes(targetTimeStr)) {
          throw new BadRequestException(`${targetTimeStr} is not a valid open slot in this session`);
        }
        
        const slotDuration = slotDurationMap[targetTimeStr] || sessions[0].slotDurationInMinutes;
        const endTimeDate = new Date(startTimeDate.getTime() + slotDuration * 60000);
        
        finalData.endTime = endTimeDate;
        finalData.slotKey = this.buildSlotKey(doctorId, startTimeDate);
      }
      
      if (isNowCancelledOrNoShow) {
        finalData.slotKey = null;
      }
      
      try {
        return await tx.appointment.update({
          where: { id },
          data: finalData,
          include: {
            patient: true,
            doctor: { select: { id: true, name: true, email: true } },
          }
        });
      } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('slotKey')) {
          throw new ConflictException('That slot was just taken — pick another');
        }
        throw error;
      }
    }, TRANSACTION_OPTIONS);
  }

  async remove(id: string, clinicId: string) {
    const { count } = await this.prisma.appointment.deleteMany({
      where: { id, clinicId },
    });
    if (count === 0) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return { success: true };
  }

  async getAvailableSlots(clinicId: string, doctorId: string, dateStr: string) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    if (isNaN(date.getTime())) throw new Error("Invalid date string");
    
    const dayOfWeek = date.getDay();
    const sessions = await this.prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId, dayOfWeek },
      orderBy: { startTime: 'asc' }
    });
    
    if (sessions.length === 0) {
      return { slots: [], slotDuration: 15, sessions: [] };
    }
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['Cancelled', 'No-Show'] }
      }
    });
    
    const { slots } = this._computeSlots(sessions, existingAppointments);
    const slotDuration = sessions[0].slotDurationInMinutes;
    return { slots, slotDuration, sessions };
  }

  async getDaySlots(clinicId: string, dateStr: string) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    if (isNaN(date.getTime())) throw new Error("Invalid date string");
    
    const dayOfWeek = date.getDay();
    const sessions = await this.prisma.doctorSchedule.findMany({
      where: { clinicId, dayOfWeek },
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: [{ doctorId: 'asc' }, { startTime: 'asc' }]
    });

    if (sessions.length === 0) return [];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: { clinicId, startTime: { gte: startOfDay, lte: endOfDay }, status: { notIn: ['Cancelled', 'No-Show'] } }
    });

    // Group sessions by doctor
    const docMap = new Map<string, any>();
    for (const s of sessions) {
      if (!docMap.has(s.doctorId)) {
        docMap.set(s.doctorId, { doctorId: s.doctorId, doctorName: s.doctor.name, sessions: [] });
      }
      docMap.get(s.doctorId).sessions.push(s);
    }

    const now = new Date();

    const result = [];
    for (const doc of docMap.values()) {
      const docAppts = appointments.filter(a => a.doctorId === doc.doctorId);
      const { slots, slotDurationMap } = this._computeSlots(doc.sessions, docAppts);
      
      const capacity = Object.keys(slotDurationMap).length;
      const bookedCount = docAppts.length;
      
      // next free slot is the first slot in `slots` that is in the future
      let nextFree = null;
      for (const timeStr of slots) {
        const [h, m] = timeStr.split(':').map(Number);
        const slotTime = new Date(date);
        slotTime.setHours(h, m, 0, 0);
        if (slotTime > now) {
          nextFree = timeStr;
          break;
        }
      }

      result.push({
        doctorId: doc.doctorId,
        doctorName: doc.doctorName,
        sessions: doc.sessions,
        slots,
        capacity,
        bookedCount,
        nextFree,
      });
    }

    return result;
  }

  async getDoctorSchedule(clinicId: string, doctorId: string, user: any) {
    return this.prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId },
      orderBy: { dayOfWeek: 'asc' }
    });
  }

  async updateDoctorSchedule(clinicId: string, doctorId: string, schedules: any[], user: any) {
    if (user.role === 'DOCTOR' && user.id !== doctorId) {
      throw new ForbiddenException('Doctors can only edit their own schedule');
    }
    
    for (const s of schedules) {
      if (!s.startTime || !s.endTime || !s.slotDurationInMinutes) continue;
      if (s.dayOfWeek < 0 || s.dayOfWeek > 6) throw new BadRequestException(`Invalid dayOfWeek: ${s.dayOfWeek}`);
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(s.startTime) || !timeRegex.test(s.endTime)) {
        throw new BadRequestException(`Times must be HH:mm (got ${s.startTime} - ${s.endTime})`);
      }
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      
      if (endMins <= startMins) {
        throw new BadRequestException(`endTime must be after startTime (${s.startTime} - ${s.endTime})`);
      }
      if (endMins - startMins < Number(s.slotDurationInMinutes)) {
        throw new BadRequestException(`Session ${s.startTime}-${s.endTime} is shorter than slot duration ${s.slotDurationInMinutes}m`);
      }
    }
    
    const days = [0,1,2,3,4,5,6];
    for (const d of days) {
      const dayScheds = schedules.filter(s => Number(s.dayOfWeek) === d && s.startTime && s.endTime);
      dayScheds.sort((a,b) => {
        const aMins = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]);
        const bMins = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
        return aMins - bMins;
      });
      for (let i = 0; i < dayScheds.length - 1; i++) {
        const currEnd = parseInt(dayScheds[i].endTime.split(':')[0]) * 60 + parseInt(dayScheds[i].endTime.split(':')[1]);
        const nextStart = parseInt(dayScheds[i+1].startTime.split(':')[0]) * 60 + parseInt(dayScheds[i+1].startTime.split(':')[1]);
        if (currEnd > nextStart) {
          const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];
          throw new BadRequestException(`${dayName} ${dayScheds[i].startTime}-${dayScheds[i].endTime} overlaps ${dayScheds[i+1].startTime}-${dayScheds[i+1].endTime}`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({ where: { clinicId, doctorId } });
      const created = [];
      for (const s of schedules) {
        if (s.startTime && s.endTime && s.slotDurationInMinutes) {
          const newSched = await tx.doctorSchedule.create({
            data: {
              clinicId,
              doctorId,
              dayOfWeek: Number(s.dayOfWeek),
              startTime: s.startTime,
              endTime: s.endTime,
              slotDurationInMinutes: Number(s.slotDurationInMinutes)
            }
          });
          created.push(newSched);
        }
      }
      return created;
    });
  }
}
