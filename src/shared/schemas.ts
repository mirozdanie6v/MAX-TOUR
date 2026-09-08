import { z } from 'zod';

export const bookingChildSchema = z.object({
  height: z.number().min(0).max(250).nullable().optional(),
  age: z.number().min(0).max(120).nullable().optional(),
});

export const participantSchema = z.object({
  fullName: z.string().trim().min(2),
  birthDate: z.iso.date().optional().or(z.literal('')),
  passport: z.string().trim().max(120).optional(),
});

export const bookingDraftSchema = z.object({
  tourId: z.string().min(1),
  format: z.enum(['group', 'private']),
  date: z.iso.date(),
  adults: z.number().int().min(1).max(30),
  children: z.array(bookingChildSchema).max(20),
  hotel: z.string().trim().min(1).max(180),
  transferZoneId: z.string().max(80).optional(),
  participants: z.array(participantSchema).max(50),
  contact: z.object({
    name: z.string().trim().min(2).max(160),
    phone: z.string().trim().max(40).optional(),
    telegram: z.string().trim().max(80).optional(),
  }).refine((value) => Boolean(value.phone || value.telegram), {
    message: 'Укажите телефон или Telegram',
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

export const availabilitySchema = z.object({
  date: z.iso.date(),
  status: z.enum(['available', 'low', 'request']),
});

export const promoSchema = z.object({
  enabled: z.boolean().default(false),
  label: z.string().trim().max(80).default(''),
  value: z.string().trim().max(80).default(''),
  discountType: z.enum(['none', 'percent_bps', 'fixed_minor']).default('none'),
  discountValue: z.number().int().min(0).default(0),
}).superRefine((value, ctx) => {
  if (value.discountType === 'percent_bps' && value.discountValue > 10_000) {
    ctx.addIssue({ code: 'custom', message: 'Процент скидки не может превышать 100%' });
  }
});
