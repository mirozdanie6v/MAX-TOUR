import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import { formatUsd } from '../shared/money';
import type { BookingDraft, PaymentChoice, PaymentMethod, Quote, Tour, AvailabilityDate, OrderSummary } from '../shared/types';

function telegramPrefill() {
  const user = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return { name:'', telegram:'' };
  const name = [user.first_name,user.last_name].filter(Boolean).join(' ').trim();
  const telegram = user.username ? `@${user.username}` : '';
  return { name, telegram };
}

function blankDraft(tourId=''): BookingDraft {
  const profile = telegramPrefill();
  return {
    tourId, format:'private', date:'', adults:2, children:[], hotel:'',
    participants:[{fullName:'',birthDate:''},{fullName:'',birthDate:''}],
    contact:{name:profile.name,telegram:profile.telegram,phone:''},
    paymentChoice:'deposit', paymentMethod:'sbp', source:'Telegram',
  };
}

const paymentMethods:Array<{id:PaymentMethod;title:string;note:string}> = [
  {id:'sbp',title:'СБП',note:'Россия · online'},
  {id:'kaspi',title:'Kaspi',note:'Казахстан · online'},
  {id:'vnpay',title:'VNPay',note:'Вьетнам · online'},
  {id:'card',title:'Банковская карта',note:'provider после подключения'},
  {id:'transfer',title:'Банковский / международный перевод',note:'по реквизитам'},
  {id:'other',title:'Другой способ',note:'через менеджера'},
];

export function BookingV2Page() {
  const navigate=useNavigate();
  const params=new URLSearchParams(useLocation().search);
  const initialTourId=params.get('tourId')||'';
  const [tours,setTours]=useState<Tour[]>([]);
  const [draft,setDraft]=useState<BookingDraft>(()=>blankDraft(initialTourId));
  const [availability,setAvailability]=useState<AvailabilityDate[]>([]);
  const [step,setStep]=useState(1);
  const [quote,setQuote]=useState<Quote|null>(null);
  const [order,setOrder]=useState<OrderSummary|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const tour=useMemo(()=>tours.find(x=>x.id===draft.tourId||x.slug===draft.tourId)||null,[tours,draft.tourId]);
  const people=draft.adults+draft.children.length;

  useEffect(()=>{api.tours().then(r=>{setTours(r.items);if(!draft.tourId&&r.items[0])setDraft(d=>({...d,tourId:r.items[0].id}))}).catch(e=>setError(e.message))},[]);
  useEffect(()=>{if(!draft.tourId)return;api.availability(draft.tourId).then(r=>setAvailability(r.items)).catch(()=>setAvailability([]))},[draft.tourId]);
  useEffect(()=>{setDraft(d=>({...d,participants:Array.from({length:d.adults+d.children.length},(_,i)=>d.participants[i]||{fullName:'',birthDate:''})}))},[draft.adults,draft.children.length]);

  const selectTour=(tourId:string)=>{setDraft(blankDraft(tourId));setQuote(null);setOrder(null);setStep(1);setError('')};
  const resizeChildren=(n:number)=>setDraft(d=>({...d,children:Array.from({length:n},(_,i)=>d.children[i]||{height:110,age:null})}));
  const nextToQuote=async()=>{setBusy(true);setError('');try{const r=await api.quote(draft);setQuote(r.quote);setStep(5)}catch(e:any){setError(e.message||'Не удалось рассчитать стоимость')}finally{setBusy(false)}};
  const choosePayment=async(choice:PaymentChoice)=>{const next={...draft,paymentChoice:choice};setDraft(next);setBusy(true);try{const r=await api.quote(next);setQuote(r.quote)}catch(e:any){setError(e.message||'Не удалось пересчитать оплату')}finally{setBusy(false)}};
  const createOrder=async()=>{setBusy(true);setError('');try{const r=await api.createOrder(draft,`v6-order-${crypto.randomUUID()}`);setOrder(r.order)}catch(e:any){setError(e.message||'Не удалось создать заказ')}finally{setBusy(false)}};
  const pay=async()=>{if(!order)return;setBusy(true);setError('');try{const r=await api.pay(order.id,`v6-pay-${order.id}`);setOrder(r.order);setStep(6)}catch(e:any){setError(e.message||'Не удалось выполнить DEMO-оплату')}finally{setBusy(false)}};

  if(!tours.length&&!error)return <div className="px-skeleton"/>;
  return <section className="px-commerce-flow">
    <div className="px-commerce-head"><div><span className="px-kicker">MAX TOUR · ONLINE BOOKING</span><h1>Бронирование экскурсии</h1><p>Индивидуальный тур — расчёт и выбор 30% или 100%. Групповой — отдельная система сбора выезда.</p></div><span className="px-demo-pill">DEMO · БЕЗ СПИСАНИЯ</span></div>
    <div className="px-commerce-progress">{[1,2,3,4,5].map(n=><i key={n} className={step>=n?'active':''}/>)}</div>

    {step===1&&<div className="px-commerce-card"><span className="px-kicker">01 · ТУР И ФОРМАТ</span><h2>Что хотите забронировать?</h2><label className="px-field"><span>Экскурсия</span><select value={draft.tourId} onChange={e=>selectTour(e.target.value)}>{tours.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>{tour&&<><div className="px-format-choice"><button className="active" onClick={()=>setDraft(d=>({...d,format:'private'}))}><b>Индивидуальный</b><span>Своя компания · выбранная дата · online-оплата</span></button><button onClick={()=>navigate(`/groups/${tour.id}`)}><b>Групповой</b><span>Присоединиться к сбору или создать свой выезд</span></button></div><div className="px-policy-mini"><b>Оплата MAX TOUR</b><span>30% депозит или 100% — выбирает клиент.</span></div>{tour.pricingRules.privateTiers?.length?<button className="px-button px-button-primary px-block" onClick={()=>setStep(2)}>Продолжить индивидуально</button>:<div className="px-commerce-warning"><b>На источнике нет однозначного индивидуального тарифа для автоматического расчёта.</b><span>Мы не придумываем цену. В Admin будет задаваться утверждённая тарифная сетка MAX TOUR — после этого этот тур тоже пойдёт в online checkout.</span></div>}</>}</div>}

    {step===2&&<div className="px-commerce-card"><span className="px-kicker">02 · СОСТАВ</span><h2>Кто едет?</h2><div className="px-counter-list"><Counter label="Взрослые" value={draft.adults} min={1} onChange={v=>setDraft(d=>({...d,adults:v}))}/><Counter label="Дети" value={draft.children.length} min={0} onChange={resizeChildren}/></div>{draft.children.map((c,i)=><div className="px-child-row" key={i}><label className="px-field"><span>Рост ребёнка {i+1}, см</span><input type="number" value={c.height??''} onChange={e=>setDraft(d=>({...d,children:d.children.map((x,j)=>j===i?{...x,height:Number(e.target.value)}:x)}))}/></label><label className="px-field"><span>Возраст, лет</span><input type="number" value={c.age??''} onChange={e=>setDraft(d=>({...d,children:d.children.map((x,j)=>j===i?{...x,age:e.target.value===''?null:Number(e.target.value)}:x)}))}/></label></div>)}<div className="px-policy-mini"><b>{people} путешественников</b><span>Цена индивидуального формата определяется сервером по опубликованной тарифной сетке конкретной экскурсии.</span></div><button className="px-button px-button-primary px-block" onClick={()=>setStep(3)}>Выбрать дату</button></div>}

    {step===3&&<div className="px-commerce-card"><span className="px-kicker">03 · ДАТА И ТРАНСФЕР</span><h2>Когда едем?</h2>{availability.length?<div className="px-date-grid">{availability.map(d=><button key={d.date} className={draft.date===d.date?'active':''} onClick={()=>setDraft(x=>({...x,date:d.date}))}><b>{d.date}</b><span>{d.label}</span><em>DEMO</em></button>)}</div>:<label className="px-field"><span>Желаемая дата</span><input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))}/></label>}<label className="px-field"><span>Отель</span><input value={draft.hotel} onChange={e=>setDraft(d=>({...d,hotel:e.target.value}))} placeholder="Например: Amiana Resort"/></label><div className="px-policy-mini"><b>Трансфер считается автоматически</b><span>Для удалённых районов применяются опубликованные MAX TOUR доплаты за автомобиль.</span></div><button className="px-button px-button-primary px-block" disabled={!draft.date||!draft.hotel.trim()} onClick={()=>setStep(4)}>Данные путешественников</button></div>}

    {step===4&&<div className="px-commerce-card"><span className="px-kicker">04 · КОНТАКТ И УЧАСТНИКИ</span><h2>Данные для подтверждения</h2><div className="px-admin-editor-grid"><label className="px-field"><span>Ваше имя</span><input value={draft.contact.name} onChange={e=>setDraft(d=>({...d,contact:{...d.contact,name:e.target.value}}))}/></label><label className="px-field"><span>Телефон</span><input value={draft.contact.phone||''} onChange={e=>setDraft(d=>({...d,contact:{...d.contact,phone:e.target.value}}))} placeholder="+7 / +84"/></label></div><label className="px-field"><span>Telegram</span><input value={draft.contact.telegram||''} onChange={e=>setDraft(d=>({...d,contact:{...d.contact,telegram:e.target.value}}))} placeholder="@username"/></label>{draft.participants.map((p,i)=><div className="px-participant-v2" key={i}><b>{i+1}. {i<draft.adults?'Взрослый':'Ребёнок'}</b><div className="px-admin-editor-grid"><label className="px-field"><span>ФИО</span><input value={p.fullName} onChange={e=>setDraft(d=>({...d,participants:d.participants.map((x,j)=>j===i?{...x,fullName:e.target.value}:x)}))}/></label><label className="px-field"><span>Дата рождения</span><input type="date" value={p.birthDate||''} onChange={e=>setDraft(d=>({...d,participants:d.participants.map((x,j)=>j===i?{...x,birthDate:e.target.value}:x)}))}/></label></div></div>)}<p className="px-form-note">Имя и Telegram подставляются автоматически, если Telegram уже передал их Mini App. Телефон Telegram сам по себе не раскрывает — его просим только когда он неизвестен.</p><button className="px-button px-button-primary px-block" disabled={busy} onClick={nextToQuote}>{busy?'Рассчитываем…':'Получить итоговую стоимость'}</button></div>}

    {step===5&&quote&&<div className="px-commerce-card"><span className="px-kicker">05 · ОПЛАТА</span><h2>{formatUsd(quote.totalMinor)}</h2><p>Итог рассчитан сервером. Выберите, сколько оплатить сейчас.</p><div className="px-quote-lines">{quote.lines.map((l,i)=><div key={`${l.label}-${i}`}><span>{l.label}</span><b>{formatUsd(l.amountMinor)}</b></div>)}</div><div className="px-pay-choice"><button className={draft.paymentChoice==='deposit'?'active':''} onClick={()=>choosePayment('deposit')}><b>30%</b><span>Депозит сейчас · {formatUsd(Math.round(quote.totalMinor*.3))}</span></button><button className={draft.paymentChoice==='full'?'active':''} onClick={()=>choosePayment('full')}><b>100%</b><span>Полная оплата · {formatUsd(quote.totalMinor)}</span></button></div><div className="px-payment-grid-v2">{paymentMethods.map(m=><button key={m.id} className={draft.paymentMethod===m.id?'active':''} onClick={()=>setDraft(d=>({...d,paymentMethod:m.id}))}><b>{m.title}</b><span>{m.note}</span></button>)}</div><div className="px-policy-box"><b>Перенос и отмена</b><p>Перенос бесплатно до 17:00 за день до экскурсии; после — удержание 30%. Отмена бесплатно более чем за 48 часов; до 17:00 за день до выезда — удержание 30%; в день выезда или при неявке — 100%.</p><span>Возврат — до 7 рабочих дней; возможны банковские комиссии. Реальный автоматический refund появится вместе с платёжным provider webhook.</span></div>{!order?<button className="px-button px-button-dark px-block" disabled={busy} onClick={createOrder}>{busy?'Создаём заказ…':`Перейти к ${draft.paymentChoice==='deposit'?'30%':'100%'} оплате`}</button>:<><div className="px-order-created"><b>Заказ {order.id} создан</b><span>Метод: {paymentMethods.find(x=>x.id===draft.paymentMethod)?.title}</span></div><button className="px-button px-button-primary px-block" disabled={busy} onClick={pay}>{busy?'Обрабатываем…':`DEMO оплатить ${formatUsd(draft.paymentChoice==='full'?order.totalMinor:Math.round(order.totalMinor*.3))}`}</button></>}</div>}

    {step===6&&order&&<div className="px-commerce-card px-commerce-success"><div className="px-success-icon">✓</div><span className="px-kicker">ПОДТВЕРЖДЕНИЕ</span><h2>{order.tourTitle}</h2><p>Бронирование создано. В production после успешного provider callback клиент получит подтверждение в Telegram, а заказ сразу появится в общей CRM.</p><div className="px-order-detail-grid"><div className="px-detail-cell"><span>Оплачено</span><b>{formatUsd(order.paidMinor)}</b></div><div className="px-detail-cell"><span>Осталось</span><b>{formatUsd(order.remainingMinor)}</b></div></div><button className="px-button px-button-dark px-block" onClick={()=>navigate(`/trips/${order.id}`)}>Открыть поездку</button></div>}
    {error&&<div className="px-notice">{error}</div>}
  </section>;
}

function Counter({label,value,min,onChange}:{label:string;value:number;min:number;onChange:(v:number)=>void}){
  return <div className="px-counter"><div><b>{label}</b></div><div><button onClick={()=>onChange(Math.max(min,value-1))}>−</button><strong>{value}</strong><button onClick={()=>onChange(value+1)}>+</button></div></div>;
}
