export const SOURCE='https://dining.columbia.edu/';
export const FERRIS_SOURCE='https://dining.columbia.edu/content/ferris-booth-commons-0';
export const DINING_SOURCES = [
  {id:'12',path:'/content/ferris-booth-commons-0'},
  {id:'11',path:'/content/jjs-place-0'},
  {id:'10',path:'/content/john-jay-dining-hall'},
  {id:'6907',path:'/chef-mikes'},
  {id:'7351',path:'/content/faculty-house-2nd-floor-0'},
  {id:'7850',path:'/content/faculty-house-4th-floor-skyline-room'},
  {id:'6990',path:'/content/chef-dons-pizza-pi-ft-blue-java'},
  {id:'7355',path:'/content/grace-dodge-dining-hall-0'},
  {id:'9727',path:'/johnnys'},
  {id:'7487',path:'/content/fac-shack-0'},
  {id:'7452',path:'/content/robert-f-smith-dining-hall-0'},
].map(s=>({...s,url:'https://dining.columbia.edu'+s.path}));
export function dishKey(name:string){return name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function parseMenuPage(html:string, hallId?:string){
  const nodes=embedded(html,'dining_nodes');
  const data=normalize(nodes,embedded(html,'dining_terms'),hallId?embedded(html,'menu_data'):allMenus(html));
  if(hallId){
    data.halls=data.halls.filter((h:any)=>h.id===hallId);
    data.menus=data.menus.filter((m:any)=>m.hall===hallId);
    const source=DINING_SOURCES.find(s=>s.id===hallId);
    for(const menu of data.menus)for(const station of menu.stations){
      station.sourceUrl=source?.url;
      if(hallId==='12'&&station.name==='Salad')station.displayName='Salad & grain bowls';
    }
  }
  if(!data.halls.length)throw new Error('Location missing from menu source');
  return data;
}
// Each hall's own page is authoritative for its complete published menu.
export function combineMenuFeeds(feeds:any[]){
  const halls=new Map<string,any>(),menus=new Map<string,any>();
  for(const feed of feeds){
    for(const hall of feed.halls)halls.set(hall.id,hall);
    for(const hall of feed.halls){for(const [key,m] of menus)if(m.hall===hall.id)menus.delete(key);}
    for(const m of feed.menus){
      const key=[m.hall,m.date,m.period].join('|');
      const stations=new Map<string,any>((menus.get(key)?.stations||[]).map((s:any)=>[s.name,s]));
      for(const s of m.stations){
        const foods=new Map<string,any>();
        for(const f of [...(stations.get(s.name)?.foods||[]),...s.foods]){
          const old=foods.get(f.name);
          foods.set(f.name,{...f,tags:[...new Set([...(old?.tags||[]),...f.tags])],allergens:[...new Set([...(old?.allergens||[]),...f.allergens])]});
        }
        stations.set(s.name,{...s,foods:[...foods.values()]});
      }
      menus.set(key,{...m,stations:[...stations.values()]});
    }
  }
  return {halls:[...halls.values()],menus:[...menus.values()]};
}
export function decode(value:string){return value.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#0?39;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').trim();}
export function embedded(html:string,name:string){const match=html.match(new RegExp('var '+name+' = `([^`]*)`;'));if(!match)throw new Error('Menu feed format changed');return JSON.parse(JSON.parse('"'+match[1].replace(/\\'/g,"'")+'"'));}
export function allMenus(html:string){const values=[...html.matchAll(/hall_menus_data\[\d+\] = JSON\.parse\(`([^`]*)`\)/g)];if(!values.length)throw new Error('Menu feed format changed');return values.flatMap(m=>JSON.parse(JSON.parse('"'+m[1].replace(/\\'/g,"'")+'"')));}
export function normalize(nodes:any,terms:any,data:any){const halls=nodes.locations.filter((h:any)=>DINING_SOURCES.some(s=>s.id===h.nid)).map((h:any)=>({id:h.nid,name:decode(h.title),url:DINING_SOURCES.find(s=>s.id===h.nid)!.url,schedule:h.open_hours_fields||[]}));const valid=new Set(halls.map((h:any)=>h.id));const menus:any[]=[];const dates=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});for(const m of data){for(const r of m.date_range_fields||[]){const start=new Date(r.date_from+'Z');const end=new Date(r.date_to+'Z');if(isNaN(+start)||isNaN(+end))continue;const date=dates.format(start);const types=r.menu_type.map((id:string)=>decode(terms.types[id]?.name||''));const periods=types.includes('Daily')?['Breakfast','Lunch','Dinner']:types.flatMap((t:string)=>t==='Lunch & Dinner'?['Lunch','Dinner']:t==='Brunch'?['Breakfast','Lunch']:[t]).filter((t:string)=>['Breakfast','Lunch','Dinner','Late Night'].includes(t));for(const hall of m.locations.filter((h:string)=>valid.has(h))){for(const period of periods){const stations=(r.stations||[]).map((s:any)=>({name:decode(terms.stations[s.station?.[0]]?.name||'Menu'),foods:(s.meals_paragraph||[]).filter((f:any)=>f.title).map((f:any)=>({name:decode(f.title),tags:f.prefs||[],allergens:f.allergens||[],description:f.meal_text?decode(f.meal_text).replace(/\s+/g,' ').trim():undefined}))})).filter((s:any)=>s.foods.length);menus.push({hall,date,period,start:start.toISOString(),end:end.toISOString(),hours:clock.format(start)+' – '+clock.format(end),stations});}}}}return {halls,menus};}
export function hallHours(hall:any,date:string){const day=new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long'}).toLowerCase();const fmt=(n:string)=>{const v=Number(n);const h=Math.floor(v/100)%24;return `${h%12||12}:${String(v%100).padStart(2,'0')} ${h<12?'am':'pm'}`};const intervals=(hall?.schedule||[]).filter((s:any)=>{const from=new Date(s.date_from+'Z').toLocaleDateString('en-CA',{timeZone:'America/New_York'});const to=new Date(s.date_to+'Z').toLocaleDateString('en-CA',{timeZone:'America/New_York'});return date>=from&&date<=to&&!(s.excluded||[]).includes(date)}).flatMap((s:any)=>(s.days||[]).flatMap((d:any)=>d['days_'+day]||[]));const unique=[...new Set(intervals.map((x:any)=>`${fmt(x.hours_from)} – ${fmt(x.hours_to)}${Number(x.hours_to)<=Number(x.hours_from)?' (next day)':''}`))];return unique.length?unique.join(' · '):'No hours published for this date';}
