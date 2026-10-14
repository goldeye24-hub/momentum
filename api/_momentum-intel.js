'use strict';
/**
 * MOMENTUM Local Intelligence v1
 * Independent first-party text reasoning. Input only: merchant-provided name and Place URL.
 * No Naver requests, scraping, third-party data, invented search counts, or ranking estimates.
 */
const regions=[
 ['서울','서울'],['부산','부산'],['대구','대구'],['인천','인천'],['광주','광주'],['대전','대전'],['울산','울산'],['세종','세종'],['제주','제주'],
 ['해운대','부산 해운대'],['광안리','부산 광안리'],['수영','부산 수영'],['사상','부산 사상'],['기장','부산 기장'],['서면','부산 서면'],['남포동','부산 남포동'],['동래','부산 동래'],['연산','부산 연산'],['강남','서울 강남'],['홍대','서울 홍대'],['성수','서울 성수'],['잠실','서울 잠실'],['포항','포항'],['경주','경주'],['양산','양산'],['김해','김해'],['창원','창원'],['마산','마산'],['진해','진해'],['진주','진주'],['통영','통영'],['거제','거제'],
 ['수원','수원'],['용인','용인'],['성남','성남'],['분당','분당'],['판교','판교'],['화성','화성'],['동탄','동탄'],['안양','안양'],['평택','평택'],['안산','안산'],
 ['고양','고양'],['일산','일산'],['부천','부천'],['파주','파주'],['김포','김포'],['남양주','남양주'],['구리','구리'],['시흥','시흥'],['광명','광명'],['이천','이천'],
 ['평창','평창'],['강릉','강릉'],['원주','원주'],['속초','속초'],['춘천','춘천'],['동해','동해'],['삼척','삼척'],
 ['전주','전주'],['군산','군산'],['익산','익산'],['목포','목포'],['여수','여수'],['순천','순천'],['광양','광양'],['나주','나주'],
 ['천안','천안'],['아산','아산'],['청주','청주'],['충주','충주'],['세종시','세종'],['공주','공주'],['서산','서산'],['논산','논산'],['보령','보령'],['당진','당진']
];
const industries=[
 {id:'seafood',category:'해산물·횟집',aliases:['대게','박달대게','킹크랩','횟집','회센터','해산물','수산','조개구이','물회','랍스터','독도새우','새우구이','꽃게'],keywords:['횟집','해산물'],intent:['회식','가족외식','예약'],route:'restaurant',topic:'해산물'},
 {id:'koreanbbq',category:'고기·구이',aliases:['한우','갈비','고깃집','소고기','돼지고기','삼겹살','정육식당','숯불구이','불고기','곱창'],keywords:['고기집','한식'],intent:['회식','가족외식','예약'],route:'restaurant',topic:'고기'},
 {id:'cafe',category:'카페',aliases:['카페','커피','로스터리','베이커리','디저트','브런치'],keywords:['카페','디저트'],intent:['데이트','디저트','주차'],route:'cafe',topic:'카페'},
 {id:'beauty',category:'미용·헤어',aliases:['헤어','미용실','바버','헤어살롱','뷰티샵','염색','펌','붙임머리'],keywords:['미용실','헤어샵'],intent:['예약','가격','후기'],route:'hairshop',topic:'헤어'},
 {id:'nail',category:'네일·피부관리',aliases:['네일','속눈썹','피부관리','왁싱'],keywords:['네일샵','뷰티샵'],intent:['예약','가격','후기'],route:'beauty',topic:'뷰티'},
 {id:'lodging',category:'숙박',aliases:['호텔','모텔','펜션','글램핑','리조트','게스트하우스','민박'],keywords:['숙소','숙박'],intent:['예약','주차','후기'],route:'accommodation',topic:'숙박'},
 {id:'education',category:'교육·학원',aliases:['학원','어학원','교습소','교육원','태권도','미술학원','수학학원','영어학원'],keywords:['학원','교육'],intent:['상담','후기','가격'],route:'place',topic:'교육'},
 {id:'medical',category:'의료',aliases:['치과','의원','한의원','병원','안과','피부과'],keywords:['의원','병원'],intent:['진료시간','예약','주차'],route:'hospital',topic:'진료'},
 {id:'restaurant',category:'음식점',aliases:['맛집','식당','레스토랑','분식','국밥','김밥','칼국수','돈가스','치킨','피자','초밥','일식','중식','한정식'],keywords:['맛집','음식점'],intent:['점심','가족외식','주차'],route:'restaurant',topic:'식사'}
];
const segmentFromPath={restaurant:'음식점',cafe:'카페',hairshop:'미용·헤어',beauty:'네일·피부관리',accommodation:'숙박',hotel:'숙박',hospital:'의료',place:'일반 매장'};
function clean(input,max=180){return String(input==null?'':input).trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max)}
function exactHost(host,base){return host===base||host.endsWith('.'+base)}
function parsePlaceUrl(raw){
 let u;try{u=new URL(clean(raw,900))}catch{return {valid:false,reason:'URL 주소 형식을 확인해 주세요.'}}
 if(u.protocol!=='https:'||u.username||u.password)return {valid:false,reason:'HTTPS 공식 플레이스 URL만 허용합니다.'};
 const host=u.hostname.toLowerCase();
 let provider=null;
 if(exactHost(host,'naver.com')||host==='naver.me')provider='naver';
 else if(exactHost(host,'kakao.com'))provider='kakao';
 else if(exactHost(host,'google.com')||exactHost(host,'google.co.kr')||host==='goo.gl'||host==='maps.app.goo.gl')provider='google';
 if(!provider)return {valid:false,reason:'네이버·카카오·구글 공식 매장 링크를 입력해 주세요.'};
 let path;try{path=decodeURIComponent(u.pathname)}catch{return {valid:false,reason:'주소에 인코딩 오류가 있습니다.'}}
 const parts=path.split('/').filter(Boolean);
 let id=null,service=null;
 if(provider==='naver'){
  const idx=parts.findIndex(x=>['restaurant','place','hairshop','beauty','accommodation','hotel','hospital','cafe','shopping','attraction'].includes(x));
  if(idx!==-1){
   service=parts[idx];
   const possible=parts[idx+1]==='place'?parts[idx+2]:parts[idx+1];
   if(/^\d{5,20}$/.test(possible||''))id=possible;
  }
  if(!id){
   const pos=parts.lastIndexOf('place');
   if(pos!==-1&&/^\d{5,20}$/.test(parts[pos+1]||''))id=parts[pos+1];
  }
  if(!service&&parts.includes('entry'))service='place';
 }
 return {valid:true,provider,canonicalUrl:u.origin+u.pathname,placeId:id,urlType:host==='naver.me'?'shortlink':id?'numeric_place_url':'public_url',serviceType:service,source:'customer_supplied_url',verifiedIdentity:false};
}
function inferRegion(name){
 const found=regions.filter(([token])=>name.includes(token));
 if(found.length===0)return {value:null,basis:'not_identified',confidence:'unknown'};
 found.sort((a,b)=>b[0].length-a[0].length);
 return {value:found[0][1],basis:'business_name_string',confidence:'inferred'};
}
function inferIndustry(name,link){
 const matches=industries.map(item=>{
  const hits=item.aliases.filter(k=>name.includes(k));
  let specificity=hits.reduce((v,k)=>Math.max(v,k.length),0);
  return {item,hits,specificity};
 }).filter(x=>x.hits.length);
 matches.sort((a,b)=>b.specificity-a.specificity);
 // URL segment is stronger evidence of category than a weak brand token.
 const segment=link.serviceType,segmentCategory=segmentFromPath[segment];
 let top=matches[0];
 if(top && segment && segment!=='place'&&top.item.route!=='restaurant'&&top.item.route!==segment && !(segment==='restaurant'&&['restaurant','seafood','koreanbbq'].includes(top.item.id))){
   top=null;
 }
 if(top)return {id:top.item.id,label:top.item.category,basis:'business_name_keyword',confidence:'inferred',terms:top.hits};
 if(segmentCategory)return {id:industries.find(x=>x.category===segmentCategory)?.id||'general',label:segmentCategory,basis:'url_service_segment',confidence:'inferred',terms:[]};
 return {id:'general',label:null,basis:'not_identified',confidence:'unknown',terms:[]};
}
function inferSpecialty(name,industry){
 const candidates=[
  ['대게','대게'],['물회','물회'],['한우','한우'],['돼지갈비','돼지갈비'],['소갈비','소갈비'],
  ['국밥','국밥'],['삼겹살','삼겹살'],['회','회'],['조개구이','조개구이'],['커피','커피'],['브런치','브런치'],
  ['속눈썹','속눈썹'],['염색','염색'],['네일','네일'],['펌','펌']
 ];
 const found=candidates.filter(([word])=>name.includes(word));
 return found.length?found[0][1]:null;
}
function buildKeywords(name,region,industry,specialty){
 const seen=new Set(),out=[];
 function add(keyword,kind,reason){
  keyword=clean(keyword,90).replace(/\s+/g,' ');
  if(!keyword||seen.has(keyword))return;
  seen.add(keyword);out.push({keyword,group:kind,reason,source:'generated_from_user_input',searchVolume:null,rank:null});
 }
 add(name,'상호 직접검색','상호명 그대로 찾는 수요 대응');
 add(name+' 위치','상호 직접검색','위치 찾기 의도');
 add(name+' 예약','상호 직접검색','방문·예약 의도');
 add(name+' 후기','상호 직접검색','후기·비교 의도');
 const r=region.value;const types=industries.find(x=>x.id===industry.id)?.keywords||[];
 if(r){
  add(r+' '+name,'상호+지역','지역과 상호를 함께 찾는 의도');
  for(const type of types.slice(0,2)){
   add(r+' '+type,'지역 탐색','업종 중심의 비상호 검색어 후보');
   add(r+' '+type+' 추천','비교·선택','업체 비교와 선택 의도');
   add(r+' '+type+' 예약','방문 전환','예약 가능 업종인 경우 검토할 후보');
  }
  if(specialty){add(r+' '+specialty,'지역 탐색','상호에 실제 포함된 세부 품목');add(r+' '+specialty+' 추천','비교·선택','품목 기반 비교 의도')}
 }else{
  // Do NOT invent a city when name and URL do not establish one.
  for(const type of types.slice(0,2)){add(type+' 예약','방문 전환','지역을 확인한 뒤 지역형 키워드를 추가할 수 있음');add(type+' 후기','비교·선택','업종별 의도 후보')}
 }
 return out.slice(0,16);
}
function campaignBlueprint(name,region,industry){
 const kind=industry.label||'매장',where=region.value?region.value+'에서 ':'';
 return [
  {channel:'플레이스 정보 정비',headline:'방문 전에 필요한 정보 한눈에',body:'영업시간·주차·예약·대표 서비스를 실제 매장 정보와 대조해 정리',outcome:'고객의 방문 전 질문 감소',evidence:'사장님 확인 필요'},
  {channel:'블로그·홈페이지',headline:where+kind+' 선택 전에 확인할 5가지',body:'고객이 궁금해할 위치·가격·이용방법·실제 사진·주의사항을 사실 중심으로 정리',outcome:'고객의 선택 판단 지원',evidence:'자체 콘텐츠 기획'},
  {channel:'SNS 홍보물',headline:name+'의 새로운 소식',body:'직접 촬영한 사진 1~3장과 실제 메뉴·혜택을 활용해 릴스/피드 게시',outcome:'실제 브랜드 접점 생성',evidence:'자체 콘텐츠 기획'}
 ];
}
function recommendActions(region,industry,identity){
 const acts=[
  {priority:1,headline:'고객이 보는 핵심 매장정보 확인',detail:'대표사진·영업시간·가격/서비스·예약·주차 정보를 실제 네이버 스마트플레이스 관리자에서 확인하세요.',type:'owner_check'},
  {priority:2,headline:'상호 직접검색과 방문 의도용 문구 분리',detail:'상호를 아는 고객과 '+(industry.label||'업종')+'을 찾는 고객에게 다른 제목·사진·행동유도를 사용합니다.',type:'first_party_plan'},
  {priority:3,headline:'홍보 링크별 성과 측정 체계 준비',detail:'자체 캠페인 링크·QR의 클릭 수를 기록하고 실제 예약·전화와 비교할 측정 구조를 마련하세요.',type:'measurement_plan'}
 ];
 if(!region.value)acts.unshift({priority:1,headline:'매장 지역은 아직 확인되지 않음',detail:'상호와 URL만으로 지역을 확정할 수 없습니다. 네이버에서 지역을 확인한 뒤 지역형 키워드를 정교화할 수 있습니다.',type:'data_gap'});
 if(identity.urlType==='shortlink')acts.unshift({priority:1,headline:'단축 링크는 실제 플레이스 ID를 노출하지 않음',detail:'공유 단축URL만으로 숫자형 매장 ID를 확인할 수 없습니다. 링크 추적 수집으로 임의 해석하지 않습니다.',type:'data_gap'});
 return acts;
}
function analyse({name,placeUrl}={}){
 name=clean(name,90);
 if(name.length<2)throw Object.assign(new Error('상호명은 두 글자 이상 입력해 주세요.'),{status:400});
 const identity=parsePlaceUrl(placeUrl);
 if(!identity.valid)throw Object.assign(new Error(identity.reason),{status:400});
 const region=inferRegion(name),industry=inferIndustry(name,identity),specialty=inferSpecialty(name,industry);
 return {version:'1.0',method:'MOMENTUM_INDEPENDENT_INPUT_ONLY',createdAt:new Date().toISOString(),merchant:{name,identity,region,industry,specialty:specialty||null},
 keywords:buildKeywords(name,region,industry,specialty),actions:recommendActions(region,industry,identity),
 campaigns:campaignBlueprint(name,region,industry),
 measurements:{naverMapRank:{value:null,status:'not_measured'},naverSearchVolume:{value:null,status:'not_measured'},storeVisitors:{value:null,status:'not_measured'}},
 disclosure:'사용자가 입력한 상호명과 URL만으로 만든 자체 가설·기획안입니다. 네이버 순위·검색량·사업장 소재지·실제 메뉴를 조회하거나 확인한 결과가 아닙니다.'};
}
module.exports={analyse,parsePlaceUrl,inferRegion,inferIndustry,buildKeywords};
