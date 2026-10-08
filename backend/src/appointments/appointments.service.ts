import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAppointmentDto: CreateAppointmentDto, clinicId: string) {
    return this.prisma.appointment.create({
      data: {
        ...createAppointmentDto,
        clinicId,
      },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findAll(clinicId: string) {
    return this.prisma.appointment.findMany({
      where: { clinicId },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true },
        },
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
    await this.findOne(id, clinicId);
    return this.prisma.appointment.update({
      where: { id },
      data: updateAppointmentDto,
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true },
        },
      },
    });
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
    // dateStr is YYYY-MM-DD
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date string");
    }
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const schedule = await this.prisma.doctorSchedule.findFirst({
      where: { clinicId, doctorId, dayOfWeek }
    });

    if (!schedule) {
      // If no schedule exists, we could either return empty (no slots) or 
      // fallback to a default 9 to 5. Let's return empty to enforce schedules.
      return [];
    }

    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const slotDuration = schedule.slotDurationInMinutes;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: { notIn: ['Cancelled'] }
      }
    });

    const bookedMinutes = new Set(
      existingAppointments.map(a => {
        const d = new Date(a.startTime);
        return d.getHours() * 60 + d.getMinutes();
      })
    );

    const slots = [];
    for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
      if (!bookedMinutes.has(m)) {
        const h = Math.floor(m / 60).toString().padStart(2, '0');
        const mins = (m % 60).toString().padStart(2, '0');
        slots.push(`${h}:${mins}`);
      }
    }
    return { slots, slotDuration };
  }

  async getDoctorSchedule(clinicId: string, doctorId: string) {
    return this.prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId },
      orderBy: { dayOfWeek: 'asc' }
    });
  }

  async updateDoctorSchedule(clinicId: string, doctorId: string, schedules: any[]) {
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
