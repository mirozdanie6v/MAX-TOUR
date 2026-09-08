import { z } from 'zod';

export const bookingChildSchema = z.object({
  height: z.number().min(0).max(250).nullable().optional(),
  age: z.number().min(0).max(120).nullable().optional(),
});

export const participantSchema = z.object({
  fullName: z.string().trim().min(2),
  birthDate: z.string().optional(),
  passport: z.string().optional(),
});

export const bookingDraftSchema = z.object({
  tourId: z.string().min(1),
  format: z.enum(['group', 'private']),
  date: z.string().min(1),
  adults: z.number().int().min(1).max(30),
  children: z.array(bookingChildSchema).max(20),
  hotel: z.string().trim().min(1),
  transferZoneId: z.string().optional(),
  participants: z.array(participantSchema),
  contact: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().min(5),
    telegram: z.string().optional(),
  }),
  paymentChoice: z.enum(['deposit', 'full']),
  paymentMethod: z.enum(['card', 'sbp', 'transfer', 'cash']),
  source: z.enum(['Telegram', 'Сайт', 'Реклама', 'Другие каналы']),
});

export const managerStatusSchema = z.object({
  status: z.enum(['Новый', 'Оплачено', 'Подтверждено'])
});

export const adminTourPatchSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().optional(),
  adultMinor: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
  program: z.array(z.string()).optional(),
  included: z.array(z.string()).optional(),
  extraCosts: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

export const addTourSchema = z.object({
  direction: z.string().trim().min(2),
  title: z.string().trim().min(2),
  description: z.string().default(''),
  priceMode: z.enum(['fixed', 'from-price', 'dynamic-request']),
  adultMinor: z.number().int().min(0),
  scheduleMode: z.enum(['demoDates', 'request']),
  images: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});
