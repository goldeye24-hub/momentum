(()=>{'use strict';
const themes={
salon:{dark:'#483d4a',light:'#f9f2f0',accent:'#c393a3',ink:'#412d36',name:'BEAUTY JOURNAL',headline:'나만의 스타일을 찾는 시간',sub:'헤어스타일과 일상의 이야기를 기록합니다.'},
expert:{dark:'#112c43',light:'#e7eef6',accent:'#9ac3eb',ink:'#162e45',name:'EXPERT INSIGHTS',headline:'더 나은 대화가 성과가 됩니다',sub:'리더십·조직·교육의 인사이트'},
local:{dark:'#b53f28',light:'#fef1c8',accent:'#f8bd6e',ink:'#682619',name:'LOCAL FOOD STORIES',headline:'맛있는 일상의 이야기',sub:'매장에서 시작되는 식탁의 기록'}
};
const initial=['브랜드 소개','서비스 안내','포트폴리오','오시는 길','상담 문의'];
const $=id=>document.getElementById(id);
const f=$('buttonFields'),box=$('buttonPreview'),select=$('selectButton');
let theme='salon',data=initial.map((title,i)=>({label:title,url:'',uploaded:''}));
const valid=u=>{try{const url=new URL(u);return ['https:','http:'].includes(url.protocol)&&url.hostname.includes('.')&&!url.username&&!url.password}catch{return false}};
function show(t){$('status').textContent=t}
function changeTheme(v){
 theme=v;document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===v)));
 const t=themes[v];document.documentElement.style.setProperty('--demo',t.dark);document.documentElement.style.setProperty('--primary',t.accent);document.documentElement.style.setProperty('--light',t.light);if(v==='expert'){$('brandName').value='더소통 인사이트';}else if(v==='salon'){$('brandName').value='온결 헤어스튜디오';}else{$('brandName').value='로컬 푸드클럽';}
 $('headline').value=t.headline;$('subline').value=t.sub;redraw();show('스타일 변경 완료');
}
function makeFields(){
 f.replaceChildren();select.replaceChildren();
 data.forEach((d,i)=>{
  const wrap=document.createElement('div');wrap.className='button-row';
  const title=document.createElement('strong');title.textContent=String(i+1).padStart(2,'0')+' / 버튼';
  const label=document.createElement('input');label.type='text';label.maxLength=16;label.value=d.label;label.setAttribute('aria-label','버튼 '+(i+1)+' 이름');label.addEventListener('input',()=>{d.label=label.value;refreshButtons();refreshCode()});
  const url=document.createElement('input');url.type='url';url.value=d.url;url.placeholder='https:// 버튼 연결 주소';url.setAttribute('aria-label','버튼 '+(i+1)+' 연결 URL');url.addEventListener('input',()=>{d.url=url.value.trim();refreshButtons();refreshCode()});
  const note=document.createElement('small');note.textContent='이름 + 연결할 실제 주소';wrap.append(title,label,url,note);f.append(wrap);
 });
 refreshButtons();
}
function refreshButtons(){
 box.replaceChildren();select.replaceChildren();
 data.forEach((d,i)=>{
  const btn=document.createElement('button');btn.type='button';const txt=document.createElement('strong');txt.textContent=d.label||'메뉴 '+(i+1);
  const sub=document.createElement('span');sub.textContent=valid(d.url)?'새 창으로 이동 ↗':'연결 URL 입력 필요';
  btn.append(txt,sub);btn.addEventListener('click',()=>{
   if(valid(d.url))window.open(d.url,'_blank','noopener,noreferrer');else show((d.label||'버튼')+' 연결 주소를 먼저 입력하세요.');
  });box.append(btn);
  const opt=document.createElement('option');opt.value=i;opt.textContent=(i+1)+' / '+(d.label||'메뉴');select.append(opt);
 });
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawBackground(ctx,w,h,t,mode){
 ctx.fillStyle=t.dark;ctx.fillRect(0,0,w,h);
 const gr=ctx.createRadialGradient(w*.76,h*.5,20,w*.76,h*.5,w*.68);gr.addColorStop(0,t.accent+'cc');gr.addColorStop(1,t.dark+'00');ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);
 if(theme==='salon'){
  ctx.fillStyle=t.accent;ctx.beginPath();ctx.ellipse(w*.83,h*.74,w*.23,h*.67,-.28,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.2;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(w*.81,h*.73,w*.17,h*.52,-.28,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 }else if(theme==='expert'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=Math.max(5,w/160);for(let k=0;k<5;k++){ctx.beginPath();ctx.arc(w*.83,h*.6,w*(.08+k*.038),0,Math.PI*2);ctx.stroke();}
 }else{
  ctx.strokeStyle=t.accent;ctx.lineWidth=Math.max(3,w/300);for(let k=0;k<12;k++){ctx.beginPath();ctx.moveTo(w*.66+k*w*.02,0);ctx.lineTo(w*.4+k*w*.02,h);ctx.stroke();}
  ctx.fillStyle=t.accent;ctx.beginPath();ctx.arc(w*.83,h*.35,w*.12,0,Math.PI*2);ctx.fill();
 }
 ctx.fillStyle=t.accent;ctx.font='bold '+Math.round(w*(mode==='mobile'?.023:.009))+'px sans-serif';ctx.letterSpacing='2px';ctx.fillText(t.name,w*.07,h*.16);
 const brand=($('brandName').value||'나의 브랜드').trim();ctx.fillStyle=t.light;ctx.font='700 '+Math.round(w*(mode==='mobile'?.042:.023))+'px sans-serif';ctx.letterSpacing='0px';ctx.fillText(brand,w*.07,h*.26,w*.78);
 ctx.fillStyle=t.light;ctx.font='bold '+Math.round(w*(mode==='mobile'?.065:.045))+'px sans-serif';
 const title=($('headline').value||'브랜드 메시지를 입력하세요').trim();
 const limit=mode==='mobile'?9:18;const lines=[];let line='';for(const ch of title){if((line+ch).length>limit){lines.push(line);line=''}line+=ch}if(line)lines.push(line);
 lines.slice(0,3).forEach((s,i)=>ctx.fillText(s,w*.07,h*(mode==='mobile'?.4:.48)+i*(mode==='mobile'?56:88),w*.82));
 ctx.fillStyle=t.accent;ctx.font=Math.round(w*(mode==='mobile'?.021:.0105))+'px sans-serif';ctx.fillText(($('subline').value||'').trim(),w*.07,h*.84,w*.85);
}
function drawButton(ctx,w,h,d){
 const t=themes[theme];ctx.clearRect(0,0,w,h);ctx.fillStyle=t.dark;roundRect(ctx,0,0,w,h,13);ctx.fill();
 ctx.strokeStyle=t.accent;ctx.lineWidth=3;roundRect(ctx,8,8,w-16,h-16,10);ctx.stroke();
 ctx.fillStyle=t.accent;ctx.font='bold '+Math.round(w*.045)+'px sans-serif';ctx.fillText(t.name,29,44,w-58);
 ctx.fillStyle=t.light;ctx.font='bold '+Math.round(w*.105)+'px sans-serif';ctx.fillText(d.label||'메뉴',29,110,w-52);
 ctx.fillStyle=t.accent;ctx.font='bold 19px sans-serif';ctx.fillText('VIEW MORE  →',29,h-24);
}
function redraw(){
 const t=themes[theme];$('preview').style.background=t.dark;$('preview').style.color=t.light;
 $('label').textContent=t.name;$('previewTitle').textContent=$('headline').value;$('previewSub').textContent=$('subline').value;
 for(const [id,mode] of [['pcCanvas','desktop'],['mobileCanvas','mobile']]){const c=$(id);drawBackground(c.getContext('2d'),c.width,c.height,t,mode)}
 refreshCode();
}
function download(canvas,filename){canvas.toBlob(b=>{if(!b){show('이미지 생성 실패');return}const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);show(filename+' 다운로드 시작')},'image/png')}
function buttonCanvas(i){const c=document.createElement('canvas');c.width=340;c.height=180;drawButton(c.getContext('2d'),340,180,data[i]);return c}
function refreshCode(){
 const i=Number(select.value||0);const d=data[i]||data[0];const hosted=$('hostedImage').value.trim();
 if(!valid(d.url)||!valid(hosted)){
 $('widgetCode').value='버튼 링크 URL과 네이버에 업로드한 PNG 이미지 주소를 모두 입력해야 완성됩니다.\n개별 PNG를 먼저 다운로드 → 네이버 업로드 → 이미지 주소 복사 → 입력.';
 return
 }
 const escapeAttr=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 $('widgetCode').value='<a href="'+escapeAttr(d.url)+'" target="_blank" rel="noopener noreferrer"><img src="'+escapeAttr(hosted)+'" alt="'+escapeAttr(d.label)+'" width="170" height="90" border="0"></a>';
}
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>changeTheme(b.dataset.theme)));
['brandName','headline','subline'].forEach(id=>$(id).addEventListener('input',redraw));
select.addEventListener('change',refreshCode);$('hostedImage').addEventListener('input',refreshCode);
$('downloadHeader').addEventListener('click',()=>download($('pcCanvas'),'momentum-blog-PC-skin-1920x650.png'));
$('downloadMobile').addEventListener('click',()=>download($('mobileCanvas'),'momentum-blog-mobile-cover-720x720.png'));
$('downloadButton').addEventListener('click',()=>{const i=Number(select.value||0);download(buttonCanvas(i),'momentum-blog-menu-'+String(i+1).padStart(2,'0')+'.png')});
$('copyCode').addEventListener('click',async()=>{if(!$('widgetCode').value.startsWith('<a ')){show('유효한 연결 URL과 업로드 이미지 주소를 입력하세요');return}try{await navigator.clipboard.writeText($('widgetCode').value);show('위젯 코드 복사 완료')}catch{$('widgetCode').select();document.execCommand('copy');show('위젯 코드를 선택했습니다')}});
makeFields();redraw();show('디자인/버튼 제작 도구 준비됨');
})();