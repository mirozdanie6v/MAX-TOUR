import { calculateQuote } from '../../shared/pricing';
import { bookingDraftSchema } from '../../shared/schemas';
import type { BookingDraft, Quote, Tour } from '../../shared/types';
import { getTourByIdOrSlug } from '../db/repository';
import type { Env } from '../db/repository';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'BAD_REQUEST') { super(message); }
}

function validateTourRequiredFields(tour: Tour, draft: BookingDraft) {
  const people = draft.adults + draft.children.length;
  if (draft.participants.length !== people) throw new HttpError(400, 'Количество анкет участников должно совпадать с количеством путешественников', 'PARTICIPANT_COUNT');
  for (const p of draft.participants) {
    if (tour.requiredFields.includes('fullName') && !p.fullName.trim()) throw new HttpError(400, 'Укажите ФИО всех участников', 'FULL_NAME_REQUIRED');
    if (tour.requiredFields.includes('birthDate') && !p.birthDate) throw new HttpError(400, 'Для этой экскурсии нужна дата рождения каждого участника', 'BIRTH_DATE_REQUIRED');
    if (tour.requiredFields.includes('passport') && !p.passport) throw new HttpError(400, 'Для этой экскурсии нужны паспортные данные', 'PASSPORT_REQUIRED');
  }
}

export async function quoteBooking(env: Env, sessionId: string, input: unknown): Promise<{ draft: BookingDraft; tour: Tour; quote: Quote }> {
  const parsed = bookingDraftSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Проверьте данные бронирования', 'VALIDATION_ERROR');
  const draft = parsed.data as BookingDraft;
  const tour = await getTourByIdOrSlug(env.DB, sessionId, draft.tourId);
  if (!tour || !tour.published) throw new HttpError(404, 'Экскурсия не найдена', 'TOUR_NOT_FOUND');
  validateTourRequiredFields(tour, draft);
  if (draft.format === 'private' && !tour.pricingRules.privateTiers?.length) throw new HttpError(400, 'Для этой экскурсии индивидуальный расчёт выполняется по запросу', 'PRIVATE_REQUEST_ONLY');
  const c = calculateQuote(tour, draft, 30);
  if (c.totalMinor <= 0) throw new HttpError(400, 'Для выбранного формата нужен индивидуальный расчёт', 'QUOTE_REQUEST_REQUIRED');
  return { draft, tour, quote: { tourId: tour.id, tourTitle: tour.title, ...c, demo: true } };
}
