'use strict';

/** Source-agnostic deterministic reducers; no network and no inferred placements. */
const isId=x=>/^[0-9]{6,20}$/.test(String(x||''));
const clean=x=>String(x||'').normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,70);
function reduceMobileList(raw,max=100){
 if(!Array.isArray(raw)||raw.length===0)return {status:'no_place_block',entries:[],observedCount:0,maxObservedRank:null};
 const seen=new Set(),items=[];
 const cap=Math.min(100,Math.max(1,Number(max)||100));
 for(const item of raw){
  const id=String(item?.id||'');
  if(!isId(id)||seen.has(id))continue;
  seen.add(id);
  if(items.length>=cap)break;
  items.push({id,name:clean(item.name)||'이름 미확인',providerRank:item.rank});
 }
 // Telemetry rank may be monotone but skip positions, ads, or count another
 // result type. For cross-page trend consistency use only visible DOM positions.
 const reliable=items.every((row,i)=>row.providerRank!=null&&Number.isInteger(Number(row.providerRank))&&Number(row.providerRank)===i+1);
 const entries=items.map((row,i)=>({placeId:row.id,name:row.name,
  rank:i+1,approximate:!reliable,
  rankBasis:reliable?'visible_list_position':'visible_list_position_estimate'}));
 return {status:entries.length?'observed':'no_place_block',entries,observedCount:entries.length,
  maxObservedRank:entries.length?Math.max(...entries.map(x=>x.rank)):null,
  scope:'mobile',precision:'observed_mobile_list_not_organic_rank',
  disclaimer:'네이버 모바일 플레이스 화면에서 읽은 목록의 표시 위치이며 광고 제외 자연검색 순위가 아닙니다. 실제 수집하지 못한 항목의 순위는 비워둡니다.'};
}
function day(iso){const d=new Date(iso);return Number.isFinite(d.getTime())?new Date(d.getTime()+9*60*60*1000).toISOString().slice(0,10):null}
function summarize(snapshots,entries,{days=7}={}){
 const period=[7,30,90].includes(Number(days))?Number(days):7;
 const sorted=(Array.isArray(snapshots)?snapshots:[]).filter(s=>s&&day(s.observed_at)).sort((a,b)=>String(b.observed_at).localeCompare(String(a.observed_at)));
 const latestDay=sorted.length?day(sorted[0].observed_at):null;
 const perDay=new Map();
 for(const snapshot of sorted){
  const d=day(snapshot.observed_at);
  if(!perDay.has(d))perDay.set(d,snapshot);
  if(perDay.size>=period)break;
 }
 const selected=[...perDay.values()].reverse(),bySnapshot=new Map(),maxRows=100;
 const allowedIds=new Set(selected.map(s=>s.id));
 for(const entry of Array.isArray(entries)?entries:[]){
  if(!entry||!allowedIds.has(entry.snapshot_id)||!isId(entry.place_id))continue;
  let map=bySnapshot.get(entry.snapshot_id);
  if(!map){map=new Map();bySnapshot.set(entry.snapshot_id,map)}
  if(map.has(entry.place_id))continue;
  const rank=Number(entry.rank);
  if(!Number.isInteger(rank)||rank<1||rank>500)continue;
  map.set(entry.place_id,{placeId:entry.place_id,name:clean(entry.place_name),rank,approximate:entry.rank_approximate===true,
   rankBasis:entry.rank_basis||'unknown'});
 }
 const timelines=new Map(),columns=selected.map(s=>({id:s.id,date:day(s.observed_at),observedAt:s.observed_at,
  observedCount:s.observed_count,maximumRank:s.max_observed_rank??null,
  entries:[...(bySnapshot.get(s.id)||new Map()).values()].sort((a,b)=>a.rank-b.rank)}));
 selected.forEach((s,i)=>{
  for(const value of (bySnapshot.get(s.id)||new Map()).values()){
   if(!timelines.has(value.placeId))timelines.set(value.placeId,{id:value.placeId,name:value.name,ranks:Array(selected.length).fill(null),approximate:Array(selected.length).fill(null)});
   const row=timelines.get(value.placeId);
   row.name=value.name||row.name;row.ranks[i]=value.rank;row.approximate[i]=value.approximate;
  }
 });
 const previous=selected.length>=2?bySnapshot.get(selected[selected.length-2].id)||new Map():null;
 const current=selected.length?bySnapshot.get(selected[selected.length-1].id)||new Map():new Map();
 const movements=[];
 for(const [id,v] of current){
  const before=previous?.get(id);
  movements.push({placeId:id,name:v.name,rank:v.rank,previousRank:before?.rank??null,
   delta:before?.rank!=null?before.rank-v.rank:null,approximate:v.approximate||!!before?.approximate});
 }
 movements.sort((a,b)=>a.rank-b.rank);
 return {period,columns,rows:[...timelines.values()].sort((a,b)=>{
  const ar=a.ranks.at(-1)??9999,br=b.ranks.at(-1)??9999;
  return ar-br||a.name.localeCompare(b.name,'ko');
 }).slice(0,maxRows),movements,summary:{daysWithObservations:columns.length,
  latestObservedAt:sorted[0]?.observed_at||null,latestObservedCount:sorted[0]?.observed_count||0,
  currentEntries:current.size,matchedAcrossLastTwo:movements.filter(x=>x.delta!==null).length,
  rising:movements.filter(x=>x.delta>0).length,falling:movements.filter(x=>x.delta<0).length,
  unchanged:movements.filter(x=>x.delta===0).length,uncomparable:movements.filter(x=>x.delta===null).length},
  disclaimer:'미측정 날짜와 관측되지 않은 업체는 빈칸입니다. 위·아래 변동은 동일 업체 ID의 서로 다른 날짜 관측이 모두 있을 때만 계산합니다.'};
}
module.exports={reduceMobileList,summarize,day};
