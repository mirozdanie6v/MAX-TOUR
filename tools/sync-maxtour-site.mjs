import fs from 'node:fs/promises';

const ORIGIN = 'https://maxtourvietnam.com';
const MAX_PAGES = 180;
const START = [
  '/',
  '/katalog-nyachang',
  '/premium-ekskursii-vetnam',
];
const skipPath = /(blog|politic|privacy|oferta|contacts?|about|thank|success|error|login|admin)/i;
const imageHost = /^(?:https?:)?\/\/(?:static|thb)\.tildacdn\.(?:one|com)\//i;

function cleanUrl(raw, base=ORIGIN) {
  try {
    const u = new URL(String(raw).replaceAll('&amp;','&'), base);
    if (u.origin !== ORIGIN) return null;
    u.hash=''; u.search='';
    const path=u.pathname.replace(/\/+$/,'')||'/';
    if (skipPath.test(path)) return null;
    return `${ORIGIN}${path}`;
  } catch { return null; }
}
function stripTags(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
function decodeEntities(s='') { return s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'"); }
function match1(html, re) { return decodeEntities((html.match(re)?.[1]||'').trim()); }
function titleOf(html) {
  return match1(html,/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || stripTags(match1(html,/<h1[^>]*>([\s\S]*?)<\/h1>/i))
    || stripTags(match1(html,/<title[^>]*>([\s\S]*?)<\/title>/i));
}
function descriptionOf(html) {
  return match1(html,/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || match1(html,/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
}
function linksOf(html, base) {
  const out=new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const url=cleanUrl(m[1],base); if(url) out.add(url);
  }
  return [...out];
}
function imagesOf(html, base) {
  const out=new Set();
  const candidates=[];
  for (const re of [
    /(?:data-original|data-original-hover|data-img-zoom-url|src)\s*=\s*["']([^"']+)["']/gi,
    /url\((?:["']?)([^)"']+)(?:["']?)\)/gi,
    /(https?:\/\/(?:static|thb)\.tildacdn\.(?:one|com)\/[^\s"'<>)]+)/gi,
  ]) for (const m of html.matchAll(re)) candidates.push(m[1]);
  for (let raw of candidates) {
    raw=decodeEntities(raw).trim();
    if(raw.startsWith('//')) raw='https:'+raw;
    if(raw.startsWith('/')) raw=new URL(raw,base).href;
    if(!imageHost.test(raw)) continue;
    try { const u=new URL(raw); u.hash=''; out.add(u.href); } catch {}
  }
  return [...out];
}
function explicitPriceLines(text) {
  const chunks=text.split(/(?<=[.!?])\s+|\s{2,}/).map(x=>x.trim()).filter(Boolean);
  return chunks.filter(x=>/(Взросл|Дет|Индивидуаль|человек|чел\.|от \d+[\s$]|\d+\$)/i.test(x)).slice(0,18);
}
function facets(text,title,path) {
  const s=`${title} ${text}`.toLowerCase();
  const tags=[];
  const add=(tag, re)=>{ if(re.test(s)&&!tags.includes(tag)) tags.push(tag); };
  add('семейный',/семейн|с детьми|дет(и|ям|ский)/i);
  add('активный',/дайв|сноркл|сёрф|серф|трек|поход|рафт|квадро|каньон|зиплайн|водопад/i);
  add('море',/море|остров|пляж|яхт|катер|круиз|дайв|сноркл/i);
  add('природа',/водопад|национальн|парк|гора|джунгл|природ|озер|пещер/i);
  add('культура',/пагод|храм|истори|музе|император|старый город|культур/i);
  add('город',/обзорн|город|хошимин|ханой|далат|дананг|хюэ|хойан/i);
  add('премиум',/премиум|premium|vip|5★|эксклюзив/i);
  add('несколько дней',/\b[2-9]\s*(дн|дня|дней)|ноч/i);
  const ageHints=[];
  if(/дети|ребен|ребён|до\s*\d+\s*(см|лет)|рост/i.test(s)) ageHints.push('есть детские условия');
  return {tags,ageHints,genderTags:[],directionHints:[...new Set([path.includes('nyachang')?'Нячанг':'',/далат/i.test(s)?'Далат':'',/дананг/i.test(s)?'Дананг':'',/фукуок/i.test(s)?'Фукуок':'',/муйне|фантьет/i.test(s)?'Муйне/Фантьет':'',/ханой/i.test(s)?'Ханой':''].filter(Boolean))]};
}
function likelyTour(text,title,url) {
  const s=`${title} ${text}`;
  const price=/(\d+[\s]?\$|Взрослые|Индивидуальный тур|на двоих|на человека)/i.test(s);
  const tourWords=/(экскурс|тур|круиз|дайвинг|снорклинг|далат|остров|водопад|нячанг|дананг|фукуок|ханой|халонг)/i.test(s);
  const boilerplateOnly=/^(Max Tour|Каталог экскурсий|Главная)$/i.test(title.trim());
  return price && tourWords && !boilerplateOnly && url !== `${ORIGIN}/`;
}

async function fetchHtml(url) {
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 MAX-TOUR catalog sync/1.0','accept':'text/html'}});
  if(!r.ok) throw new Error(`${r.status} ${url}`);
  const type=r.headers.get('content-type')||'';
  if(!type.includes('text/html')) throw new Error(`non-html ${url}`);
  return r.text();
}

const queue=START.map(x=>cleanUrl(x)).filter(Boolean).map(url=>({url,depth:0}));
const seen=new Set();
const pages=[];
const errors=[];
while(queue.length && seen.size<MAX_PAGES) {
  const {url,depth}=queue.shift();
  if(!url||seen.has(url)) continue;
  seen.add(url);
  try {
    const html=await fetchHtml(url);
    const text=stripTags(html);
    const path=new URL(url).pathname;
    const title=titleOf(html);
    const images=imagesOf(html,url);
    const links=linksOf(html,url);
    const item={url,path,title,description:descriptionOf(html),images,imageCount:images.length,priceLines:explicitPriceLines(text),facets:facets(text,title,path),likelyTour:likelyTour(text,title,url),textExcerpt:text.slice(0,6000)};
    pages.push(item);
    if(depth<2) for(const next of links) {
      const p=new URL(next).pathname;
      if(!seen.has(next) && p!=='/' && !skipPath.test(p)) queue.push({url:next,depth:depth+1});
    }
    console.log(`[${pages.length}/${MAX_PAGES}] ${url} images=${images.length} tour=${item.likelyTour}`);
  } catch(e) { errors.push({url,error:String(e?.message||e)}); }
}

const tours=pages.filter(x=>x.likelyTour);
const allImages=[...new Set(pages.flatMap(x=>x.images))];
const result={
  generatedAt:new Date().toISOString(),
  source:ORIGIN,
  policy:'Source-derived crawl manifest. No unpublished pricing or demographic assumptions are added.',
  pagesScanned:pages.length,
  likelyTourPages:tours.length,
  uniqueOfficialImageUrls:allImages.length,
  errors,
  tours,
  pages,
};
await fs.mkdir('seed',{recursive:true});
await fs.writeFile('seed/site-catalog.generated.json',JSON.stringify(result,null,2)+'\n');
await fs.writeFile('docs/SITE_CATALOG_SYNC_SUMMARY.md',`# MAX TOUR site catalog sync\n\nGenerated: ${result.generatedAt}\n\n- Pages scanned: ${pages.length}\n- Likely tour/detail pages: ${tours.length}\n- Unique MAX TOUR/Tilda image URLs: ${allImages.length}\n- Crawl errors: ${errors.length}\n\nThe manifest is source-derived and does not infer unpublished prices, gender targeting or operational capacity.\n`);
console.log(JSON.stringify({pages:pages.length,tours:tours.length,images:allImages.length,errors:errors.length}));
