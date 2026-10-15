'use strict';
function summarize(rows,idA,idB){
 const list=(Array.isArray(rows)?rows:[]).map(row=>{
  const a=Number(row?.rank_a),b=Number(row?.rank_b);
  const rankA=row?.rank_a==null||!Number.isInteger(a)||a<1||a>500?null:a;
  const rankB=row?.rank_b==null||!Number.isInteger(b)||b<1||b>500?null:b;
  const comparison=rankA!==null&&rankB!==null?'both':rankA!==null?'only_a':rankB!==null?'only_b':'none';
  return {keyword:String(row?.keyword||'').slice(0,60),observedAt:row?.observed_at||null,
   rankA,rankB,approximateA:row?.approximate_a===true,approximateB:row?.approximate_b===true,
   nameA:String(row?.name_a||'').slice(0,70)||null,nameB:String(row?.name_b||'').slice(0,70)||null,
   comparison,lead:comparison==='both'?(rankA<rankB?'a':rankB<rankA?'b':'tied'):null};
 }).filter(row=>row.keyword&&row.comparison!=='none');
 const totals={keywordsObserved:list.length,both:list.filter(r=>r.comparison==='both').length,
  onlyA:list.filter(r=>r.comparison==='only_a').length,onlyB:list.filter(r=>r.comparison==='only_b').length,
  betterA:list.filter(r=>r.lead==='a').length,betterB:list.filter(r=>r.lead==='b').length,
  tied:list.filter(r=>r.lead==='tied').length,
  top10A:list.filter(r=>r.rankA!==null&&r.rankA<=10).length,
  top10B:list.filter(r=>r.rankB!==null&&r.rankB<=10).length};
 list.sort((a,b)=>((a.comparison==='both'?0:1)-(b.comparison==='both'?0:1))||
  (a.rankA??999)-(b.rankA??999)||a.keyword.localeCompare(b.keyword,'ko'));
 return {placeA:idA,placeB:idB,summary:totals,rows:list,
  disclaimer:'두 업체는 동일 키워드의 동일 모바일 관측 시각으로 비교했습니다. 업체가 관측 목록에 없다는 것은 순위 밖 확정이나 검색 미노출을 뜻하지 않습니다.'};
}
module.exports={summarize};
