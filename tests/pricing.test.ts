import { describe, expect, it } from 'vitest';
import { calculateQuote, childPriceMinor } from '../src/shared/pricing';
import type { BookingDraft, Tour } from '../src/shared/types';

const dalat: Tour = {
  id:'dalat-premium',slug:'dalat-premium',title:'Экскурсия в Далат «Премиум»',direction:'Нячанг',category:'Премиум экскурсии',published:true,sourceUrl:'https://maxtourvietnam.com/ekskursiya-v-dalat-iz-nyachanga-premium',priceMode:'fixed',
  pricingRules:{adultMinor:5200,childRules:[{type:'height',max:100,priceMinor:0,label:'free'},{type:'height',min:100.01,max:120,priceMinor:3800,label:'child'}],privateTiers:[{minPeople:1,maxPeople:2,totalMinor:42000},{minPeople:3,maxPeople:3,totalMinor:45000}]},requiredFields:['fullName','birthDate'],scheduleMode:'demoDates',description:'',program:[],included:[],extraCosts:[],whatToTake:[],images:[],badges:[],dataStatus:'verifiedSite'
};
const draft: BookingDraft = {tourId:'dalat-premium',format:'group',date:'2026-09-12',adults:2,children:[{height:112}],hotel:'Amiana Resort',transferZoneId:'north',participants:[{fullName:'A',birthDate:'1990-01-01'},{fullName:'B',birthDate:'1990-01-01'},{fullName:'C',birthDate:'2020-01-01'}],contact:{name:'Demo',phone:'12345'},paymentChoice:'deposit',paymentMethod:'card',source:'Telegram'};

describe('MAX TOUR verified pricing acceptance',()=>{
  it('prices child 112 cm as $38',()=>expect(childPriceMinor(dalat.pricingRules,{height:112})).toBe(3800));
  it('calculates 2 adults + child as $142, Amiana transfer $20, total $162 and 30% $48.60',()=>{
    const q=calculateQuote(dalat,draft,30);
    expect(q.tourSubtotalMinor).toBe(14200);
    expect(q.transferMinor).toBe(2000);
    expect(q.totalMinor).toBe(16200);
    expect(q.payNowMinor).toBe(4860);
  });
});
