import React, { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import { formatUsd } from '../shared/money';

export function OwnerPage() {
  const [data,setData]=useState<any>(null);
  const [saving,setSaving]=useState(false);
  const [settings,setSettings]=useState({managerSlaMinutes:15,managerNotifications:true,ownerDigest:'Ежедневно',salesFocus:'Премиум экскурсии'});
  const load=()=>api.ownerOverview().then((result)=>{setData(result);setSettings(result.settings)});
  useEffect(()=>{void load()},[]);
  const maxSource=useMemo(()=>Math.max(1,...(data?.sources??[]).map((row:any)=>row.orders)),[data]);
  if(!data)return <div className="px-owner-loading">Собираем показатели владельца…</div>;
  const save=async()=>{setSaving(true);try{const result=await api.ownerSettings(settings);setData(result);setSettings(result.settings)}finally{setSaving(false)}};
  return <>
    <section className="px-owner-lead"><div><span className="px-kicker">OWNER VIEW · DEMO</span><h2>Бизнес под контролем в одном экране</h2><p>Владелец не обрабатывает каждый заказ вручную. Его задача — видеть продажи, загрузку менеджера, актуальность продукта и задавать правила работы команды.</p></div><div className="px-owner-focus"><span>Фокус продаж</span><b>{data.settings.salesFocus}</b></div></section>
    <section className="px-owner-metrics">
      <OwnerMetric label="Заказы" value={String(data.metrics.orders)} note="текущая demo-сессия"/>
      <OwnerMetric label="Объём продаж" value={formatUsd(data.metrics.grossMinor)} note="DEMO orders"/>
      <OwnerMetric label="Оплачено" value={formatUsd(data.metrics.paidMinor)} note="по demo-платежам"/>
      <OwnerMetric label="К получению" value={formatUsd(data.metrics.outstandingMinor)} note="остаток по заказам"/>
      <OwnerMetric label="Конверсия" value={`${data.metrics.conversion}%`} note="DEMO funnel"/>
      <OwnerMetric label="Каталог" value={`${data.metrics.publishedTours}/${data.metrics.tours}`} note="опубликовано / всего"/>
    </section>
    <section className="px-owner-grid">
      <article className="px-owner-panel"><span className="px-kicker">ОЧЕРЕДЬ КОМАНДЫ</span><h3>Что требует внимания</h3><div className="px-owner-statuses">{data.statuses.map((row:any)=><div key={row.status}><span>{row.status}</span><b>{row.count}</b></div>)}</div><p>Менеджер закрывает новые и оплаченные заказы. Администратор отвечает за продукт и расписание. Владелец видит отклонения и вмешивается только когда это нужно.</p></article>
      <article className="px-owner-panel"><span className="px-kicker">КАНАЛЫ ПРОДАЖ</span><h3>Откуда приходят заказы</h3>{data.sources.map((row:any)=><div className="px-owner-source" key={row.source}><div><b>{row.source}</b><span>{row.orders} заказов · {formatUsd(row.revenueMinor)}</span></div><i><em style={{width:`${(row.orders/maxSource)*100}%`}}/></i></div>)}</article>
    </section>
    <section className="px-owner-panel px-owner-workflow"><span className="px-kicker">СОВМЕСТНАЯ РАБОТА</span><h3>Как роли связаны между собой</h3><div className="px-role-flow">{data.workflow.map((item:any,index:number)=><div key={item.role}><span>{String(index+1).padStart(2,'0')}</span><b>{item.role}</b><p>{item.action}</p>{index<data.workflow.length-1&&<em>→</em>}</div>)}</div></section>
    <section className="px-owner-grid">
      <article className="px-owner-panel"><span className="px-kicker">ПРАВИЛА РАБОТЫ · DEMO</span><h3>Настройки владельца</h3><label className="px-field"><span>SLA менеджера, минут</span><input type="number" min="5" max="120" value={settings.managerSlaMinutes} onChange={e=>setSettings({...settings,managerSlaMinutes:Number(e.target.value)})}/></label><label className="px-field"><span>Фокус продаж</span><input value={settings.salesFocus} onChange={e=>setSettings({...settings,salesFocus:e.target.value})}/></label><label className="px-field"><span>Сводка владельцу</span><select value={settings.ownerDigest} onChange={e=>setSettings({...settings,ownerDigest:e.target.value})}><option>Отключено</option><option>Ежедневно</option><option>Еженедельно</option></select></label><label className="px-owner-check"><input type="checkbox" checked={settings.managerNotifications} onChange={e=>setSettings({...settings,managerNotifications:e.target.checked})}/><span>Уведомлять менеджеров о новых заказах</span></label><button className="px-button px-button-dark px-block" onClick={save} disabled={saving}>{saving?'Сохраняем…':'Сохранить правила'}</button><p className="px-form-note">Это демонстрационная настройка будущей системы. Она хранится в D1 только в текущей demo-сессии.</p></article>
      <article className="px-owner-panel"><span className="px-kicker">ПОСЛЕДНИЕ ЗАКАЗЫ</span><h3>Картина без перехода в Manager</h3><div className="px-owner-orders">{data.recentOrders.map((order:any)=><div key={order.id}><div><b>{order.tourTitle}</b><span>{order.customer} · {order.source}</span></div><div><strong>{formatUsd(order.totalMinor)}</strong><small>{order.status}</small></div></div>)}</div></article>
    </section>
  </>;
}

function OwnerMetric({label,value,note}:{label:string;value:string;note:string}){return <article><span>{label}</span><b>{value}</b><small>{note}</small></article>}
