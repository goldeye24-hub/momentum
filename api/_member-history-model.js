'use strict';
function summarize(source,days=30){
 const period=[7,30,90].includes(Number(days))?Number(days):30;
 const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
 const seen=new Set(),rows=[];
 for(const x of Array.isArray(source)?source:[]){
  const date=x?.observation_date;
  if(!validDay(date)||seen.has(date)||rows.length>=period)continue;
  seen.add(date);
  const n=x.rank===null||x.rank===undefined?null:Number(x.rank);
  const rank=n!==null&&Number.isInteger(n)&&n>=1&&n<=500?n:null;
  const count=x.observed_count===null||x.observed_count===undefined?null:Number(x.observed_count);
  rows.push({date,observedAt:x.observed_at||null,
    observedCount:Number.isInteger(count)&&count>=0?count:null,
    rank,approximate:rank!==null&&x.rank_approximate===true,
    basis:rank!==null?(x.rank_basis||'unknown'):null,
    status:x.observed_at?(rank===null?'not_found_in_observed_list':'observed'):'not_measured'});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 const measured=rows.filter(r=>r.observedAt),matched=measured.filter(r=>r.rank!==null);
 const last=matched.at(-1)||null,latestDay=measured.at(-1)||null;
 const before=measured.at(-2)||null;
 const comparable=!!(latestDay&&before&&latestDay.rank!==null&&before.rank!==null);
 return {days:period,rows,summary:{
  calendarDays:rows.length,daysMeasured:measured.length,daysMatched:matched.length,
  noKeywordMeasurement:rows.filter(r=>!r.observedAt).length,
  notFoundInList:measured.filter(r=>r.rank===null).length,
  lastObservedAt:latestDay?.observedAt||null,
  lastRecordedRank:last?.rank??null,lastRecordedAt:last?.observedAt||null,
  lastApproximate:last?.approximate??null,
  change:comparable?before.rank-latestDay.rank:null,
  changeFrom:comparable?before.date:null,changeTo:comparable?latestDay.date:null
 },disclaimer:'네이버 모바일 플레이스 목록에서 실제 관측된 위치입니다. 순위 데이터가 없는 날짜는 미측정 또는 목록에서 미발견으로 구분하며, 미노출이나 순위 밖을 확정하지 않습니다. 변화량은 가장 최근 두 목록 관측에서 동일 업체를 확인한 경우에만 계산합니다.'};
}
module.exports={summarize};
