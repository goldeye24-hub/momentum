"use strict";
(function(){
const $=id=>document.getElementById(id);
const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pick=(id)=>String($(id)?.value??"").trim();
const formats={square:{w:1080,h:1080,label:"인스타 피드"},portrait:{w:1080,h:1350,label:"인스타 세로"},story:{w:1080,h:1920,label:"스토리/릴스"},banner:{w:1200,h:628,label:"가로 배너"}};
const templates=[
{id:"menu",name:"메뉴 소개",category:"외식·카페",mock:"한 상 가득\n특별하게",eyebrow:"SIGNATURE MENU",headline:"오늘 가장 신선한 한 상",subline:"좋은 재료에 정성을 더했습니다.\n우리 매장의 대표 메뉴를 만나보세요.",price:"대표 메뉴 안내",cta:"메뉴 확인하기",footnote:"메뉴·가격은 매장 안내를 확인하세요",accent:"#eb8f4a"},
{id:"sale",name:"시즌 할인",category:"프로모션",mock:"LIMITED\nSALE",eyebrow:"LIMITED OFFER",headline:"이번 주만의 특별한 혜택",subline:"놓치기 아쉬운 시즌 이벤트\n매장에서 자세히 확인하세요.",price:"특별 혜택 진행 중",cta:"행사 문의하기",footnote:"행사 기간과 적용 조건을 확인하세요",accent:"#ef6537"},
{id:"opening",name:"오픈 이벤트",category:"신규 매장",mock:"GRAND\nOPEN",eyebrow:"GRAND OPEN",headline:"새로운 공간이 열립니다",subline:"새로운 시작, 좋은 경험으로\n인사드리겠습니다.",price:"OPEN EVENT",cta:"방문 안내 보기",footnote:"매장 일정은 별도 공지를 확인하세요",accent:"#c2d7ff"},
{id:"notice",name:"매장 공지",category:"안내·휴무",mock:"NOTICE\n알려드립니다",eyebrow:"STORE NOTICE",headline:"매장 이용 안내",subline:"운영시간 및 이용 관련 소식을\n확인해 주세요.",price:"중요 안내",cta:"문의하기",footnote:"변경사항은 매장 공지를 확인해 주세요",accent:"#56766d"},
{id:"booking",name:"예약 안내",category:"예약 유도",mock:"RESERVATION\n예약 안내",eyebrow:"RESERVATION",headline:"소중한 시간을 예약하세요",subline:"편안한 방문을 위해\n미리 예약을 부탁드립니다.",price:"사전 예약 가능",cta:"예약 문의",footnote:"예약 가능 시간은 매장으로 확인해 주세요",accent:"#92cfaf"},
{id:"beauty",name:"뷰티·서비스",category:"미용·서비스",mock:"NEW\nSTYLE",eyebrow:"YOUR NEW STYLE",headline:"새로운 스타일의 시작",subline:"당신에게 어울리는 경험을\n정성스럽게 제안합니다.",price:"맞춤 상담 안내",cta:"상담 예약하기",footnote:"시술·상담 내용은 매장에서 확인하세요",accent:"#ae7687"},
{id:"premium",name:"프리미엄",category:"브랜딩",mock:"THE\nSIGNATURE",eyebrow:"THE SIGNATURE",headline:"차이를 만드는 특별함",subline:"한 번의 경험에도\n우리만의 기준을 담습니다.",price:"PREMIUM EXPERIENCE",cta:"지금 만나보기",footnote:"자세한 정보는 매장으로 문의해 주세요",accent:"#d6b16f"},
{id:"review",name:"고객 이야기",category:"후기 소개",mock:"CUSTOMER\nSTORY",eyebrow:"CUSTOMER STORY",headline:"고객의 이야기를 듣습니다",subline:"후기와 의견을 소중히 담아\n더 나은 경험을 준비합니다.",price:"고객 이야기",cta:"매장 둘러보기",footnote:"실제 후기를 인용할 때는 사용 허락을 확인하세요",accent:"#548c86"}
];
const state={template:"menu",format:"square",accent:"#eb8f4a",overlay:35,brightness:100,zoom:100,panX:0,panY:0,photo:null,logo:null,editBrand:false};
let raf=0,loading=false;
function requestDraw(){if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{raf=0;draw()})}
function selected(){return templates.find(t=>t.id===state.template)||templates[0]}
function parseColor(hex){
 if(!/^#[0-9a-f]{6}$/i.test(hex))return [236,111,47];
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
}
function rgb(hex,alpha=1){const [r,g,b]=parseColor(hex);return "rgba("+r+","+g+","+b+","+alpha+")"}
function clamp(n,lo,hi){return Math.min(hi,Math.max(lo,n))}
function mix(a,b,amount){
 const ca=parseColor(a),cb=parseColor(b);
 return "#"+ca.map((c,i)=>Math.round(c*(1-amount)+cb[i]*amount).toString(16).padStart(2,"0")).join("");
}
function shape(ctx,x,y,w,h,r){
 r=clamp(r,0,Math.min(w,h)/2);
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function rect(ctx,x,y,w,h,r,color){ctx.fillStyle=color;shape(ctx,x,y,w,h,r);ctx.fill()}
function stroke(ctx,x,y,w,h,r,color,width=2){shape(ctx,x,y,w,h,r);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function cover(ctx,img,x,y,w,h,opts={}){
 if(!img)return false;
 const iw=img.naturalWidth,ih=img.naturalHeight;
 if(!iw||!ih)return false;
 const scale=Math.max(w/iw,h/ih)*clamp(state.zoom/100,1,2.4);
 const sw=iw*scale,sh=ih*scale;
 const px=(clamp(state.panX,-100,100)+100)/200,py=(clamp(state.panY,-100,100)+100)/200;
 const dx=x-(sw-w)*px,dy=y-(sh-h)*py;
 ctx.save();if(opts.radius){shape(ctx,x,y,w,h,opts.radius);ctx.clip()}else {ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip()}
 ctx.filter="brightness("+clamp(state.brightness,55,150)+"%) saturate(105%)";
 ctx.drawImage(img,dx,dy,sw,sh);
 ctx.filter="none";ctx.restore();
 return true;
}
function deco(ctx,h,palette,dark=true){
 const grad=ctx.createLinearGradient(0,0,1000,h);
 grad.addColorStop(0,palette[0]);grad.addColorStop(1,palette[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,1000,h);
 ctx.save();ctx.globalAlpha=dark?.13:.16;
 ctx.strokeStyle=state.accent;ctx.lineWidth=3;
 for(let j=0;j<4;j++){ctx.beginPath();ctx.arc(830,h*.26,120+j*65,0,Math.PI*2);ctx.stroke()}
 ctx.fillStyle=state.accent;ctx.beginPath();ctx.arc(880,h*.75,110,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
function photoBackground(ctx,h,darker=true){
 deco(ctx,h,["#162a3b","#1e4051"],true);
 if(state.photo){
 cover(ctx,state.photo,0,0,1000,h);
 ctx.fillStyle="rgba(7,18,31,"+(state.overlay/100)+")";ctx.fillRect(0,0,1000,h);
 const g=ctx.createLinearGradient(0,0,0,h);
 g.addColorStop(0,"rgba(4,15,26,.23)");g.addColorStop(.35,"rgba(3,12,25,.17)");g.addColorStop(1,darker?"rgba(1,9,16,.85)":"rgba(1,9,16,.66)");
 ctx.fillStyle=g;ctx.fillRect(0,0,1000,h);
 }
}
function splitText(text){
 return String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,8);
}
function textLines(ctx,text,maxW,maxLines,size,weight=800,family='system-ui,-apple-system,"Noto Sans KR","Malgun Gothic",sans-serif'){
 ctx.font=weight+" "+size+"px "+family;
 const out=[];
 for(const p of splitText(text)){
  let line="";
  const words=p.split(/(\s+)/).filter(Boolean);
  for(const word of words){
   if(ctx.measureText(line+word).width<=maxW){line+=word;continue}
   if(line.trim()){out.push(line.trim());line=""}
   if(ctx.measureText(word).width<=maxW){line=word;continue}
   for(const char of word){if(ctx.measureText(line+char).width>maxW&&line){out.push(line.trim());line=""}line+=char}
  }
  if(line.trim())out.push(line.trim());
 }
 if(out.length>maxLines){
  const clipped=out.slice(0,maxLines);
  let tail=clipped[maxLines-1];
  while(tail.length>1&&ctx.measureText(tail+"…").width>maxW)tail=tail.slice(0,-1);
  clipped[maxLines-1]=tail+"…";
  return clipped;
 }
 return out.length?out:[""];
}
function printText(ctx,text,x,y,maxW,maxH,baseSize,color,weight=850,align="left",maxLines=4){
 if(!String(text||"").trim())return 0;
 ctx.save();ctx.textAlign=align;ctx.textBaseline="top";ctx.fillStyle=color;
 let size=baseSize,lines=[],lh=0;
 for(;size>=20;size-=2){
  lines=textLines(ctx,text,maxW,maxLines,size,weight);
  lh=size*1.22;
  if(lines.length*lh<=maxH)break;
 }
 ctx.font=weight+" "+size+'px system-ui,-apple-system,"Noto Sans KR","Malgun Gothic",sans-serif';
 lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lh,maxW));
 ctx.restore();return lines.length*lh;
}
function brand(ctx,atY,color,center=false){
 const s=pick("studioBusiness")||"우리 매장";
 const x=center?500:82;
 ctx.save();ctx.fillStyle=color;ctx.textAlign=center?"center":"left";ctx.textBaseline="middle";
 ctx.font='800 31px system-ui,"Noto Sans KR",sans-serif';
 const logo=state.logo;
 let nameX=x;
 if(logo&&center){const w=clamp(logo.naturalWidth*(52/logo.naturalHeight),16,105);ctx.drawImage(logo,500-w/2,atY-65,w,52);atY+=14}
 else if(logo){const w=clamp(logo.naturalWidth*(50/logo.naturalHeight),16,115);ctx.drawImage(logo,82,atY-23,w,46);nameX=82+w+16}
 ctx.fillText(s,nameX,atY,center?790:Math.max(330,900-nameX));ctx.restore();
}
function line(ctx,x1,y1,x2,y2,c,width=3){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke()}
function label(ctx,text,x,y,w,color,align="left",size=25){
 ctx.save();ctx.fillStyle=color;ctx.font="900 "+size+'px system-ui,"Noto Sans KR",sans-serif';ctx.textBaseline="top";ctx.textAlign=align;ctx.fillText(String(text||"").toUpperCase(),x,y,w);ctx.restore();
}
function badge(ctx,text,x,y,maxW,bg,ink){
 if(!String(text||"").trim())return;
 ctx.save();ctx.font='750 28px system-ui,"Noto Sans KR",sans-serif';
 const width=clamp(ctx.measureText(text).width+42,105,maxW);
 rect(ctx,x,y,width,59,13,bg);ctx.fillStyle=ink;ctx.textBaseline="middle";ctx.textAlign="center";ctx.fillText(text,x+width/2,y+30,width-25);ctx.restore();
}
function callToAction(ctx,text,x,y,width,dark=false){
 if(!text)return;
 rect(ctx,x,y,width,66,13,dark?"#fff":state.accent);
 printText(ctx,text,x+width/2,y+16,width-20,41,25,dark?"#183047":"#fff",750,"center",1);
}
function footer(ctx,h,light=true){const y=h-87;line(ctx,82,y-27,918,y-27,light?"#ffffff45":"#18304733",2);brand(ctx,y,light?"#ffffff":"#1b3042");const note=pick("studioFootnote");if(note)printText(ctx,note,918,h-48,510,27,17,light?"#ffffffc2":"#4c5d69",450,"right",1)}
function draw(){
 const canvas=$("poster");if(!canvas)return;
 const form=formats[state.format]||formats.square;
 const W=form.w,H=form.h,h=H*1000/W;
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext("2d");
 if(!ctx)return;
 ctx.setTransform(W/1000,0,0,W/1000,0,0);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 const style=state.template;
 const title=pick("studioHeadline")||selected().headline,eyebrow=pick("studioEyebrow");
 const sub=pick("studioSubline"),price=pick("studioPrice"),cta=pick("studioCTA");
 const compact=h<680,story=h>1600,margin=82;
 // Different art direction for each preset, not one background with recolored text.
 if(style==="menu"){
  photoBackground(ctx,h,true);
  label(ctx,eyebrow,margin,95,820,state.accent);
  rect(ctx,margin,155,82,7,3,state.accent);
  printText(ctx,title,margin,h*(compact?.33:.38),825,h*(compact?.27:.25),compact?69:79,"#fff",920);
  printText(ctx,sub,margin,h*(compact?.63:.64),790,h*.11,compact?26:31,"#e5ebf1",530,"left",3);
  if(price)badge(ctx,price,margin,h-(compact?146:235),730,state.accent,"#fff");
  if(cta&&!compact)callToAction(ctx,cta,margin,h-157,430,false);
  footer(ctx,h,true);
 }else if(style==="sale"){
  deco(ctx,h,["#fff5e8","#f6d8c6"],false);
  if(state.photo)cover(ctx,state.photo,510,0,490,h);
  else{ctx.fillStyle=mix(state.accent,"#fff",.28);ctx.fillRect(510,0,490,h);ctx.fillStyle="#ffffff33";ctx.beginPath();ctx.arc(790,h*.5,280,0,Math.PI*2);ctx.fill()}
  rect(ctx,69,75,198,45,10,state.accent);label(ctx,eyebrow,85,84,180,"#fff","left",21);
  const tw=compact?520:455;
  printText(ctx,title,margin,h*(compact?.25:.3),tw,h*.29,compact?63:72,"#2c3340",920,"left",4);
  printText(ctx,sub,margin,h*.62,440,h*.115,compact?23:30,"#555260",500,"left",3);
  if(price){rect(ctx,margin,h-(compact?155:220),400,66,12,"#fff");printText(ctx,price,margin+20,h-(compact?143:207),360,45,32,state.accent,900)}
  if(cta&&!compact)callToAction(ctx,cta,margin,h-148,400,false);
  brand(ctx,h-69,"#38313b");
 }else if(style==="opening"){
  deco(ctx,h,["#18345d","#4169a4"],true);
  if(state.photo){ctx.save();ctx.translate(780,h*.38);ctx.rotate(-.07);cover(ctx,state.photo,-285,-h*.25,465,h*.53,{radius:28});stroke(ctx,-285,-h*.25,465,h*.53,28,"#ffffffaa",8);ctx.restore()}
  label(ctx,eyebrow,margin,90,795,state.accent);
  printText(ctx,title,margin,h*.31,story?760:compact?580:680,h*.23,compact?66:76,"#fff",900);
  printText(ctx,sub,margin,h*.59,Math.min(720,story?770:600),h*.11,compact?24:32,"#d6e8ff",530);
  if(price)badge(ctx,price,margin,h-(compact?135:225),650,"#fff","#1c3d6a");
  if(cta&&!compact)callToAction(ctx,cta,margin,h-147,400);
  footer(ctx,h,true);
 }else if(style==="notice"){
  deco(ctx,h,["#f7f7f0","#dce4d9"],false);
  ctx.strokeStyle=mix(state.accent,"#3f6c5d",.3);
  stroke(ctx,49,49,902,h-98,28,"#345b4b43",3);
  label(ctx,eyebrow,500,h*.185,850,state.accent,"center",30);
  rect(ctx,466,h*.255,68,7,4,state.accent);
  printText(ctx,title,500,h*.31,810,h*.22,compact?69:78,"#203d36",950,"center");
  printText(ctx,sub,500,h*.61,775,h*.13,compact?25:33,"#50655e",550,"center");
  if(price)badge(ctx,price,320,h-(compact?140:235),500,"#fff","#36584d");
  if(cta&&!compact)callToAction(ctx,cta,280,h-148,440,false);
  footer(ctx,h,false);
 }else if(style==="booking"){
  deco(ctx,h,["#112d2a","#285b4b"],true);
  if(state.photo){
    let height=compact?h*.48:h*.49;
    cover(ctx,state.photo,82,148,836,height-130,{radius:30});
    stroke(ctx,82,148,836,height-130,30,"#ffffff55",2);
  }else{rect(ctx,82,148,836,h*.34,27,"#ffffff12");ctx.fillStyle="#e9f0dd22";ctx.beginPath();ctx.arc(500,h*.30,155,0,7);ctx.fill()}
  label(ctx,eyebrow,margin,78,810,state.accent);
  printText(ctx,title,margin,h*(compact?.60:.58),836,h*.17,compact?64:75,"#fff",920);
  printText(ctx,sub,margin,h*.77,825,h*.095,compact?25:29,"#e0f1e9",500);
  if(price&&!compact)badge(ctx,price,margin,h-225,620,state.accent,"#10372e");
  footer(ctx,h,true);
 }else if(style==="beauty"){
  deco(ctx,h,["#f9eff0","#edd8df"],false);
  const right=545;
  if(state.photo)cover(ctx,state.photo,right,0,455,h);
  else{rect(ctx,right,0,455,h,0,mix(state.accent,"#fff",.63));ctx.strokeStyle=state.accent;ctx.lineWidth=5;ctx.beginPath();ctx.arc(835,h*.42,140,0,7);ctx.stroke()}
  label(ctx,eyebrow,margin,94,460,state.accent);
  rect(ctx,margin,150,110,6,3,state.accent);
  printText(ctx,title,margin,h*.32,420,h*.27,compact?61:72,"#45323b",920);
  printText(ctx,sub,margin,h*.65,420,h*.14,compact?25:31,"#655864",500);
  if(price)badge(ctx,price,margin,h-(compact?140:235),420,"#fff","#704656");
  if(cta&&!compact)callToAction(ctx,cta,margin,h-150,410,false);
  brand(ctx,h-61,"#4d3c46");
 }else if(style==="premium"){
  photoBackground(ctx,h,true);
  ctx.strokeStyle=state.accent;ctx.lineWidth=3;ctx.strokeRect(49,52,902,h-104);
  line(ctx,420,125,580,125,state.accent,3);
  label(ctx,eyebrow,500,165,800,state.accent,"center",29);
  printText(ctx,title,500,h*.39,810,h*.24,compact?67:80,"#fff",950,"center");
  printText(ctx,sub,500,h*.66,820,h*.12,compact?24:29,"#f4eade",550,"center");
  if(price&&!compact)badge(ctx,price,220,h-235,560,"#1e2532cf",state.accent);
  footer(ctx,h,true);
 }else if(style==="review"){
  deco(ctx,h,["#dceceb","#b5d4d2"],false);
  if(state.photo)cover(ctx,state.photo,0,0,1000,h*.37);
  else rect(ctx,0,0,1000,h*.33,0,"#87b3ae");
  rect(ctx,60,h*.26,880,h*.55,30,"#fffcf5");
  label(ctx,eyebrow,100,h*.30,810,state.accent);
  ctx.fillStyle=rgb(state.accent,.25);ctx.font='900 160px Georgia,serif';ctx.fillText("“",95,h*.39);
  printText(ctx,title,105,h*.45,785,h*.18,compact?52:67,"#243b3d",920,"left",4);
  printText(ctx,sub,105,h*.67,785,h*.12,compact?24:30,"#617172",550,"left");
  if(price&&!compact)badge(ctx,100,h-218,560,"#e8f2ef","#315c55");
  brand(ctx,h-68,"#385755");
 }
 if(state.logo&&state.template!=="notice"&&state.template!=="review"&&state.template!=="booking"){
  const img=state.logo,ih=img.naturalHeight||1,iw=img.naturalWidth||1;
  const w=clamp(iw*(54/ih),20,180);
  ctx.drawImage(img,920-w,90,w,54);
 }
 $("studioDimensions").textContent=W+" × "+H+" px · "+form.label;
}
function getData(){
 return {template:state.template,format:state.format,accent:state.accent,overlay:state.overlay,brightness:state.brightness,zoom:state.zoom,panX:state.panX,panY:state.panY,...Object.fromEntries(["studioBusiness","studioEyebrow","studioHeadline","studioSubline","studioPrice","studioCTA","studioFootnote"].map(k=>[k,pick(k)]))};
}
function saveSettings(silent=false){
 try{localStorage.setItem("momentum-studio-v3",JSON.stringify(getData()));if(!silent)alert("디자인 설정을 이 브라우저에 저장했습니다. 사진·로고 파일은 저장되지 않으니 다시 방문할 때 재업로드해야 합니다.")}
 catch{if(!silent)alert("브라우저 저장공간을 사용할 수 없습니다. PNG 다운로드는 가능합니다.")}
}
function caption(){
 const brand=pick("studioBusiness")||"우리 매장";
 const title=pick("studioHeadline");
 const sub=pick("studioSubline");
 const price=pick("studioPrice");
 const cta=pick("studioCTA");
 const out=[title||"오늘의 새로운 소식을 전합니다.",sub,price,cta,brand].filter(Boolean).join("\n\n");
 $("studioCaption").value=out+"\n\n#매장소식 #이벤트안내";
}
function syncInputs(){
 const ids=["studioBusiness","studioEyebrow","studioHeadline","studioSubline","studioPrice","studioCTA","studioFootnote"];
 for(const id of ids)$(id)?.addEventListener("input",()=>{if(id==="studioBusiness")state.editBrand=true;caption();saveSettings(true);requestDraw()});
 for(const [id,key] of [["studioZoom","zoom"],["studioPanX","panX"],["studioPanY","panY"],["studioBrightness","brightness"],["studioOverlay","overlay"]]){
  $(id).addEventListener("input",()=>{state[key]=Number($(id).value);syncSliderLabels();saveSettings(true);requestDraw()});
 }
 $("studioAccent").addEventListener("input",()=>{state.accent=$("studioAccent").value;renderSwatches();saveSettings(true);requestDraw()});
 $("studioFormat").addEventListener("change",()=>{state.format=$("studioFormat").value;saveSettings(true);requestDraw()});
}
function syncSliderLabels(){
 for(const [id,key] of [["studioZoom","zoom"],["studioPanX","panX"],["studioPanY","panY"],["studioBrightness","brightness"],["studioOverlay","overlay"]]){
  $(id).value=state[key];
  $(id+"Value").textContent=(key==="panX"||key==="panY")?(state[key]===0?"중앙":state[key]>0?"+ "+state[key]:""+state[key]):state[key]+"%";
 }
}
function renderTemplates(){
 $("studioTemplateGrid").innerHTML=templates.map(t=>
 '<button type="button" class="studio-template" data-studio-template="'+t.id+'" aria-pressed="'+(state.template===t.id)+'" aria-label="'+e(t.name)+' 템플릿 선택">'+
 '<div class="mock '+t.id+'"><span class="mock-kicker">'+e(t.eyebrow)+'</span><span class="mock-main">'+e(t.mock).replace(/\n/g,"<br>")+'</span><span class="mock-line"></span></div><div class="template-bottom"><strong>'+e(t.name)+'</strong><span>'+e(t.category)+'</span></div></button>').join("");
 $("studioTemplateGrid").querySelectorAll("button").forEach(b=>b.onclick=()=>applyTemplate(b.dataset.studioTemplate,true));
}
function renderSwatches(){
 const colors=["#eb8f4a","#ee653c","#315a92","#56766d","#af7789","#d0a556","#111d2c","#4787a5"];
 $("studioSwatches").innerHTML=colors.map(c=>'<button type="button" class="studio-swatch" style="background:'+c+'" aria-label="포인트 컬러 '+c+'" aria-pressed="'+(state.accent.toLowerCase()===c)+'" data-color="'+c+'"></button>').join("");
 $("studioSwatches").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.accent=b.dataset.color;$("studioAccent").value=state.accent;renderSwatches();saveSettings(true);requestDraw()});
}
function applyTemplate(id,fillText){
 const t=templates.find(x=>x.id===id)||templates[0];
 state.template=t.id;
 if(fillText){
  for(const [input,key] of [["studioEyebrow","eyebrow"],["studioHeadline","headline"],["studioSubline","subline"],["studioPrice","price"],["studioCTA","cta"],["studioFootnote","footnote"]])$(input).value=t[key];
  state.accent=t.accent;
  $("studioAccent").value=t.accent;
  state.overlay=35;
 }
 $("studioTemplateName").textContent=t.name;
 renderTemplates();renderSwatches();syncSliderLabels();caption();saveSettings(true);requestDraw();
}
function readFile(id,limit,type){
 const f=$(id).files?.[0];if(!f)return;
 const valid=["image/png","image/jpeg","image/webp"];
 if(!valid.includes(f.type)||f.size>limit){alert("PNG/JPG/WEBP 형식의 "+Math.round(limit/1e6)+"MB 이하 이미지로 업로드하세요.");$(id).value="";return}
 const blobUrl=URL.createObjectURL(f),img=new Image();
 img.onload=()=>{
  if(!img.naturalWidth||!img.naturalHeight){URL.revokeObjectURL(blobUrl);return}
  state[type]=img;
  $(type==="photo"?"studioPhotoName":"studioLogoName").textContent=f.name;
  URL.revokeObjectURL(blobUrl);requestDraw()
 };
 img.onerror=()=>{URL.revokeObjectURL(blobUrl);alert("이미지 파일을 읽을 수 없습니다.")};
 img.src=blobUrl;
}
async function exportPNG(){
 const c=$("poster"),b=$("studioDownload");
 if(!c)return;
 b.disabled=true;b.textContent="고화질 PNG 생성 중…";
 try{
  await new Promise(resolve=>requestAnimationFrame(resolve));
  draw();
  const blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
  if(!blob)throw Error("이미지를 만들 수 없습니다.");
  const obj=URL.createObjectURL(blob),a=document.createElement("a");
  const name=(pick("studioBusiness")||"momentum").replace(/[^\p{L}\p{N}]+/gu,"-").slice(0,38);
  a.href=obj;a.download=name+"-"+state.template+"-"+state.format+".png";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(obj),2500);
 }catch(err){alert("다운로드 실패: "+err.message)}
 finally{b.disabled=false;b.innerHTML="고화질 PNG 다운로드 <span>↓</span>"}
}
function reset(){
 if(!confirm("현재 편집 중인 디자인 설정을 초기화할까요?"))return;
 state.photo=null;state.logo=null;state.zoom=100;state.panX=0;state.panY=0;state.brightness=100;state.overlay=35;state.format="square";
 $("studioPhoto").value="";$("studioLogo").value="";
 $("studioPhotoName").textContent="JPG · PNG · WEBP · 최대 12MB";$("studioLogoName").textContent="투명 PNG 권장 · 최대 5MB";
 $("studioFormat").value="square";
 applyTemplate("menu",true);
}
function autoBrand(){
 if(state.editBrand)return;
 const storeInput=document.getElementById("storeName");
 let name=String(storeInput?.value||"").trim();
 if(!name){try{name=JSON.parse(localStorage.getItem("momentum-2026-lastProfile")||"{}").company||""}catch{}}
 if(name&&!pick("studioBusiness")){$("studioBusiness").value=name;caption();requestDraw()}
}
function loadSettings(){
 let data=null;try{data=JSON.parse(localStorage.getItem("momentum-studio-v3")||"null")}catch{}
 if(!data||!templates.some(x=>x.id===data.template))return false;
 const t=templates.find(x=>x.id===data.template);
 state.template=t.id;state.format=formats[data.format]?data.format:"square";
 state.accent=/^#[a-f0-9]{6}$/i.test(data.accent)?data.accent:t.accent;
 for(const [k,min,max,def] of [["zoom",100,240,100],["panX",-100,100,0],["panY",-100,100,0],["brightness",55,150,100],["overlay",0,85,35]]){
  state[k]=Number.isFinite(+data[k])?clamp(+data[k],min,max):def;
 }
 for(const id of ["studioBusiness","studioEyebrow","studioHeadline","studioSubline","studioPrice","studioCTA","studioFootnote"])
  if(typeof data[id]==="string")$(id).value=data[id].slice(0,160);
 $("studioAccent").value=state.accent;
 $("studioFormat").value=state.format;state.editBrand=Boolean(pick("studioBusiness"));
 return true;
}
function init(){
 if(!$("studioTemplateGrid")||!$("poster"))return;
 syncInputs();
 if(!loadSettings()){applyTemplate("menu",true)}else {renderTemplates();renderSwatches();syncSliderLabels();$("studioTemplateName").textContent=selected().name}
 $("studioPhoto").addEventListener("change",()=>readFile("studioPhoto",12e6,"photo"));
 $("studioLogo").addEventListener("change",()=>readFile("studioLogo",5e6,"logo"));
 $("studioDownload").onclick=exportPNG;
 $("studioReset").onclick=reset;
 $("studioSave").onclick=()=>saveSettings();
 $("studioCopyCaption").onclick=async()=>{try{await navigator.clipboard.writeText($("studioCaption").value);alert("게시글 문구를 복사했습니다.")}catch{alert("브라우저 클립보드 권한이 필요합니다.")}};
 document.querySelector('[data-view="creative"]')?.addEventListener("click",()=>{autoBrand();requestDraw()});
 autoBrand();syncSliderLabels();caption();requestDraw();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
