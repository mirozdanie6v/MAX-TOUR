import { z } from 'zod';

export const departureSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  taken: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  status: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.taken > value.capacity) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'taken must not exceed capacity' });
});

export const groupFormatSchema = z.object({
  from: z.string(),
  adult: z.string(),
  child: z.string(),
  infant: z.string(),
  deposit: z.string(),
  notes: z.array(z.string()),
  departures: z.array(departureSchema),
});

export const individualFormatSchema = z.object({
  from: z.string(),
  tiers: z.array(z.string()),
  deposit: z.string(),
  notes: z.array(z.string()),
});

export const routeStopSchema = z.tuple([z.string().min(1), z.string().min(1)]);

export const tourSchema = z.object({
  id: z.string().min(1),
  popular: z.boolean(),
  title: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  duration: z.string().min(1),
  time: z.string().min(1),
  image: z.string().url(),
  fallbackImage: z.string().url(),
  gallery: z.array(z.string().url()).min(1),
  tags: z.array(z.string()),
  activity: z.string().min(1),
  audience: z.array(z.string()),
  category: z.string().min(1),
  childrenOk: z.boolean(),
  group: groupFormatSchema,
  individual: individualFormatSchema,
  route: z.array(routeStopSchema),
  included: z.array(z.string()),
  take: z.array(z.string()),
  // These three are retained only to verify the attached JSON. UI recomputes them.
  liked: z.boolean().optional(),
  searchText: z.string().optional(),
  formatsLabel: z.string().optional(),
  priceFromUsd: z.number().nonnegative().optional(),
});

export type Tour = z.infer<typeof tourSchema>;
export type Departure = z.infer<typeof departureSchema>;
export type TourFormat = 'group' | 'individual';

export const travelerSchema = z.object({
  fullName: z.string(),
  birthDate: z.string(),
  role: z.enum(['adult', 'child', 'infant']),
  primary: z.boolean().default(false),
});
export type Traveler = z.infer<typeof travelerSchema>;

export const bookingSchema = z.object({
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  infants: z.number().int().min(0),
  date: z.string(),
  hotel: z.string(),
  deposit: z.union([z.literal(30), z.literal(100)]),
  method: z.enum(['СБП', 'Kaspi', 'VNPAY', 'Другой способ']),
  travelers: z.array(travelerSchema),
  error: z.string(),
});
export type Booking = z.infer<typeof bookingSchema>;

export const filterSchema = z.object({
  city: z.string(),
  duration: z.enum(['all', 'half', 'evening', 'one', 'multi']),
  category: z.string(),
  kids: z.boolean(),
  budgetMin: z.string(),
  budgetMax: z.string(),
  query: z.string(),
});
export type FilterState = z.infer<typeof filterSchema>;

export const tripSchema = z.object({
  id: z.string(),
  tourId: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string(),
  status: z.string(),
  paid: z.string(),
  rest: z.string(),
  total: z.string(),
  type: z.string(),
  receipt: z.string(),
  people: z.string(),
  image: z.string(),
  rules: z.string(),
  paidAt: z.string(),
  travelers: z.array(travelerSchema),
});
export type Trip = z.infer<typeof tripSchema>;

export type Screen = 'home' | 'catalog' | 'tour' | 'booking' | 'trips' | 'ai' | 'admin';
export type PaymentStep = 'form' | 'qr';
export type TripTab = 'booked' | 'profile';

export interface AppState {
  screen: Screen;
  selectedTourId: string;
  selectedDeparture: Departure | null;
  format: TourFormat;
  filters: FilterState;
  booking: Booking;
  paymentStep: PaymentStep;
  tripTab: TripTab;
  liked: Set<string>;
  trips: Trip[];
  travelerDirectory: Traveler[];
}

export const DEFAULT_FILTERS: FilterState = {
  city: 'all', duration: 'all', category: 'all', kids: false, budgetMin: '', budgetMax: '', query: '',
};

export const DEFAULT_BOOKING: Booking = {
  adults: 2,
  children: 1,
  infants: 0,
  date: '2026-09-14',
  hotel: '',
  deposit: 30,
  method: 'СБП',
  travelers: [],
  error: '',
};

export function parseMoney(value: string | undefined | null): number {
  const match = String(value ?? '').replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : 0;
}

export function derivePriceFromUsd(tour: Tour): number {
  const group = tour.group.from !== '—' ? parseMoney(tour.group.from) : 0;
  const individual = tour.individual.from !== '—' ? parseMoney(tour.individual.from) : 0;
  return group || individual;
}

export function textIndex(tour: Tour): string {
  return [tour.title, tour.city, tour.region, tour.duration, tour.category, tour.activity, tour.tags.join(' '), tour.audience.join(' ')]
    .join(' ')
    .toLowerCase();
}

export function durationBucket(tour: Tour): FilterState['duration'] {
  const text = `${tour.duration} ${tour.title} ${tour.category}`.toLowerCase();
  if (/[2-9]\s*(дня|дней)/.test(text) || text.includes('несколько') || text.includes('ноч') || text.includes('сап') || text.includes('халонг')) return 'multi';
  if (text.includes('вечер')) return 'evening';
  if (text.includes('полд')) return 'half';
  return 'one';
}

function firstTierPrice(tour: Tour): number {
  return parseMoney(tour.individual.tiers[0] ?? tour.individual.from);
}

export function calculateTotalUsd(tour: Tour, format: TourFormat, booking: Booking): number {
  if (format === 'group') {
    const adult = parseMoney(tour.group.adult);
    const child = parseMoney(tour.group.child);
    return adult * booking.adults + child * booking.children;
  }

  const totalPeople = booking.adults + booking.children + booking.infants;
  if (tour.id === 'nhatrang-day') {
    if (totalPeople <= 2) return 180;
    if (totalPeople <= 4) return 60 * totalPeople;
    if (totalPeople <= 7) return 50 * totalPeople;
    return 45 * totalPeople;
  }
  return firstTierPrice(tour);
}

export function travelerRoles(booking: Pick<Booking, 'adults' | 'children' | 'infants'>): Traveler['role'][] {
  return [
    ...Array.from({ length: booking.adults }, () => 'adult' as const),
    ...Array.from({ length: booking.children }, () => 'child' as const),
    ...Array.from({ length: booking.infants }, () => 'infant' as const),
  ];
}

export function syncTravelers(booking: Booking): Traveler[] {
  const roles = travelerRoles(booking);
  return roles.map((role, index) => ({
    fullName: booking.travelers[index]?.fullName ?? '',
    birthDate: booking.travelers[index]?.birthDate ?? '',
    role,
    primary: index === 0 && role === 'adult',
  }));
}

export function validateTravelers(booking: Booking): string | null {
  const travelers = syncTravelers(booking);
  if (travelers.length !== booking.adults + booking.children + booking.infants) return 'Заполните данные всех путешественников.';
  const missing = travelers.find((traveler) => traveler.fullName.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(traveler.birthDate));
  return missing ? 'ФИО и дата рождения обязательны для каждого путешественника.' : null;
}

export function updateTravelerDirectory(directory: Traveler[], travelers: Traveler[]): Traveler[] {
  const next = [...directory];
  for (const traveler of travelers) {
    const key = `${traveler.fullName.trim().toLowerCase()}|${traveler.birthDate}`;
    const index = next.findIndex((item) => `${item.fullName.trim().toLowerCase()}|${item.birthDate}` === key);
    if (index >= 0) next[index] = { ...traveler, primary: next[index].primary || traveler.primary };
    else next.push(traveler);
  }
  return next;
}

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function createTrip(tour: Tour, format: TourFormat, booking: Booking, now = new Date()): Trip {
  const travelers = syncTravelers(booking);
  const total = calculateTotalUsd(tour, format, booking);
  const paid = booking.deposit === 100 ? total : Math.round(total * 0.3);
  const rest = Math.max(0, total - paid);
  return tripSchema.parse({
    id: `trip-${now.getTime()}`,
    tourId: tour.id,
    title: tour.title,
    date: booking.date,
    time: format === 'group' ? (tour.group.departures.find((d) => d.date === booking.date)?.time ?? tour.time) : tour.time,
    status: booking.deposit === 100 ? 'Оплачено' : 'Депозит внесён',
    paid: money(paid),
    rest: money(rest),
    total: money(total),
    type: format === 'group' ? 'Групповой' : 'Индивидуальный',
    receipt: `MT-DEMO-${String(1000 + (now.getTime() % 9000)).padStart(4, '0')}`,
    people: `${booking.adults} взрослых + ${booking.children} ребёнок + ${booking.infants} младенец`,
    image: tour.image,
    rules: 'Перенос бесплатный до 17:00 за день до экскурсии. Отмена более чем за 48 часов — бесплатно.',
    paidAt: now.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·'),
    travelers,
  });
}
