import type { BookingChildInput, BookingDraft, PricingRules, QuoteLine, Tour } from './types';

export interface TransferZone {
  id: string;
  label: string;
  hotelTokens: string[];
  tiers: Array<{ maxPeople: number; priceMinor: number }>;
}

export const transferZones: TransferZone[] = [
  { id: 'center', label: 'Центр Нячанга', hotelTokens: ['center', 'центр', 'nha trang'], tiers: [{ maxPeople: 99, priceMinor: 0 }] },
  { id: 'camranh', label: 'Камрань', hotelTokens: ['cam ranh', 'камрань'], tiers: [{ maxPeople: 6, priceMinor: 3000 }, { maxPeople: 14, priceMinor: 5000 }] },
  { id: 'north', label: 'Diamond Bay / Amiana / Alibu / Театр DO', hotelTokens: ['diamond bay', 'amiana', 'alibu', 'театр do', 'do theatre'], tiers: [{ maxPeople: 6, priceMinor: 2000 }, { maxPeople: 14, priceMinor: 3000 }] },
  { id: 'far', label: 'Зоклет / GM Resort / Paradise', hotelTokens: ['зоклет', 'doc let', 'gm resort', 'paradise'], tiers: [{ maxPeople: 6, priceMinor: 6000 }, { maxPeople: 14, priceMinor: 9000 }] },
];

export function childPriceMinor(rules: PricingRules, child: BookingChildInput): number {
  if (child.age != null) {
    const match = rules.childRules.find(r => r.type === 'age' && (r.min == null || child.age! >= r.min) && (r.max == null || child.age! <= r.max));
    if (match) return match.priceMinor;
  }
  if (child.height != null) {
    const match = rules.childRules.find(r => r.type === 'height' && (r.min == null || child.height! >= r.min) && (r.max == null || child.height! <= r.max));
    if (match) return match.priceMinor;
  }
  return rules.adultMinor ?? rules.adultFromMinor ?? 0;
}

export function privatePriceMinor(rules: PricingRules, people: number): number {
  const tier = rules.privateTiers?.find(t => people >= t.minPeople && people <= t.maxPeople);
  if (!tier) return 0;
  return tier.totalMinor ?? (tier.perPersonMinor ?? 0) * people;
}

export function detectTransfer(hotel: string, people: number, explicitZoneId?: string) {
  let zone = explicitZoneId ? transferZones.find(z => z.id === explicitZoneId) : undefined;
  if (!zone) {
    const h = hotel.toLowerCase();
    zone = transferZones.find(z => z.id !== 'center' && z.hotelTokens.some(token => h.includes(token))) ?? transferZones[0];
  }
  const tier = zone.tiers.find(t => people <= t.maxPeople) ?? zone.tiers[zone.tiers.length - 1];
  return { zone, priceMinor: tier?.priceMinor ?? 0 };
}

export function calculateQuote(tour: Tour, draft: BookingDraft, depositPercentDemo = 30) {
  const people = draft.adults + draft.children.length;
  const lines: QuoteLine[] = [];
  let subtotal = 0;

  if (draft.format === 'private') {
    subtotal = privatePriceMinor(tour.pricingRules, people);
    lines.push({ label: `Индивидуальный формат, ${people} чел.`, amountMinor: subtotal });
  } else {
    const adultMinor = tour.pricingRules.adultMinor ?? tour.pricingRules.adultFromMinor ?? 0;
    const adultsTotal = adultMinor * draft.adults;
    subtotal += adultsTotal;
    lines.push({ label: `${draft.adults} × взрослый тариф`, amountMinor: adultsTotal });
    draft.children.forEach((child, index) => {
      const amountMinor = childPriceMinor(tour.pricingRules, child);
      subtotal += amountMinor;
      const descriptor = child.height != null ? `, ${child.height} см` : child.age != null ? `, ${child.age} лет` : '';
      lines.push({ label: `Ребёнок ${index + 1}${descriptor}`, amountMinor });
    });
  }

  const transfer = detectTransfer(draft.hotel, people, draft.transferZoneId);
  const totalMinor = subtotal + transfer.priceMinor;
  const payNowMinor = draft.paymentChoice === 'full' ? totalMinor : Math.round(totalMinor * depositPercentDemo / 100);
  return {
    tourSubtotalMinor: subtotal,
    transferMinor: transfer.priceMinor,
    totalMinor,
    depositPercentDemo,
    payNowMinor,
    remainingMinor: totalMinor - payNowMinor,
    lines,
    transferLabel: transfer.zone.label,
  };
}
