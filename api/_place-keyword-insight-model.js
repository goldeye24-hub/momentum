'use strict';
const validRank=x=>x==null?null:Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=500?Number(x):null;
function summarize(raw,placeId){
 const rows=(Array.isArray(raw)?raw:[]).map(x=>{
  const rank=validRank(x.latest_rank),previousRank=validRank(x.previous_rank);
  const delta=rank!==null&&previousRank!==null?previousRank-rank:null;
  return {keyword:String(x.keyword||'').normalize('NFKC').trim().slice(0,60),
   observedAt:x.latest_observed_at||null,previousObservedAt:x.previous_observed_at||null,
   rank,previousRank,delta,approximate:x.latest_approximate===true,
   previousApproximate:x.previous_approximate===true,
   name:String(x.matched_name||'').trim().slice(0,70)||null,
   status:rank===null?'not_observed_in_latest':'observed'};
 }).filter(x=>x.keyword);
 return {placeId,rows,summary:{
  trackedKeywords:rows.length,
  visibleInLatest:rows.filter(x=>x.rank!==null).length,
  notObservedLatest:rows.filter(x=>x.rank===null).length,
  top3:rows.filter(x=>x.rank!==null&&x.rank<=3).length,
  top10:rows.filter(x=>x.rank!==null&&x.rank<=10).length,
  rising:rows.filter(x=>x.delta>0).length,
  falling:rows.filter(x=>x.delta<0).length,
  unchanged:rows.filter(x=>x.delta===0).length,
  unknownDelta:rows.filter(x=>x.delta===null).length
 },disclaimer:'이 목록은 서버에 저장된 실제 관측 키워드만 포함하며, 키워드를 자동으로 전수 발굴하거나 검색 유입량을 측정한 결과가 아닙니다. 최신 목록에서 미관측인 키워드는 순위 밖으로 추측하지 않습니다.'};
}
module.exports={summarize};
