(function(){
'use strict';
var kit=window.MomentumSiteKit, templates=[], css='', cfg=null, activeTab='brand', activeId='', saveTimer=null;
var activeSection='hero', undoStack=[],redoStack=[],lastField='',lastEditTime=0;
var partNames={hero:'첫 화면',about:'브랜드 소개',services:'서비스·메뉴',gallery:'사진·포트폴리오',faq:'자주 묻는 질문',contact:'문의 안내'};
function updateHistoryButtons(){
 var u=el('undoEdit'),r=el('redoEdit');
 if(u)u.disabled=!undoStack.length;
 if(r)r.disabled=!redoStack.length;
}
function rememberEdit(field){
 if(!cfg)return;
 var now=Date.now();
 if(field!==lastField||now-lastEditTime>650||!undoStack.length){
  undoStack.push(JSON.stringify(cfg));
  if(undoStack.length>60)undoStack.shift();
  redoStack.length=0;
 }
 lastField=field;lastEditTime=now;updateHistoryButtons();
}
function restoreHistory(from,to){
 if(!from.length||!cfg)return;
 to.push(JSON.stringify(cfg));
 cfg=kit.normalize(JSON.parse(from.pop()));
 lastField='';buildFields();schedule();updateHistoryButtons();
}
function selectTab(name,focusPath){
 activeTab=name;
 document.querySelectorAll('.editor-nav button').forEach(function(b){
  var active=b.dataset.tab===name;
  b.classList.toggle('active',active);
  b.setAttribute('aria-selected',String(active));
 });
 buildFields();
 if(focusPath){
  var input=[].slice.call(el('editorFields').querySelectorAll('[data-field]')).find(function(node){return node.dataset.field===focusPath});
  if(input){input.scrollIntoView({block:'nearest'});input.focus({preventScroll:true})}
 }
}
var el=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]})};
var lookup=function(path){var t=cfg;path.split('.').forEach(function(k){t=t==null?undefined:t[k]});return t};
var set=function(path,value){var parts=path.split('.'),curr=cfg;for(var i=0;i<parts.length-1;i++)curr=curr[parts[i]];curr[parts[parts.length-1]]=value};
var field=function(label,path,type,hint){
 var value=lookup(path)==null?'':String(lookup(path));
 var control=(type==='textarea'?'<textarea data-field="'+esc(path)+'" id="edit-'+esc(path)+'" rows="4">'+esc(value)+'</textarea>':
 '<input id="edit-'+esc(path)+'" data-field="'+esc(path)+'" type="'+(type==='color'?'color':type==='email'?'email':type==='number'?'number':'text')+'"'+(type==='number'?' min="0" max="200" step="1"':'')+' value="'+esc(value)+'">');
 return '<div class="field"><label for="edit-'+esc(path)+'">'+esc(label)+(hint?'<small>'+esc(hint)+'</small>':'')+'</label>'+control+'</div>';
};
var upload=function(label,path){
 return field(label+' 이미지 URL',path,'text','https 주소')+
 '<div class="field"><label>또는 사진 파일로 교체</label><input type="file" data-upload="'+esc(path)+'" accept="image/jpeg,image/png,image/webp"><button type="button" class="row-action" data-clear-image="'+esc(path)+'">이미지 비우기</button></div>';
};
var collection=function(type,title,fields){
 return '<div class="field"><label>'+esc(title)+'</label></div>'+
 cfg[type].map(function(row,i){
  return '<div class="edit-collection"><div class="collection-head"><strong>'+title+' '+(i+1)+'</strong><button type="button" class="delete" data-remove="'+type+'" data-index="'+i+'">삭제</button></div>'+
   fields.map(function(f){return f[2]==='image'?upload(f[0],type+'.'+i+'.'+f[1]):field(f[0],type+'.'+i+'.'+f[1],f[2])}).join('')+
  '</div>';
 }).join('')+
 '<button type="button" class="add-item" data-add="'+type+'">＋ '+esc(title)+' 추가</button>';
};
var heading=function(title,help){return '<h2>'+title+'</h2><p class="help">'+help+'</p>'};
function buildFields(){
 var form=el('editorFields');
 if(!cfg)return;
 var output='';
 switch(activeTab){
  case 'brand':
   output=heading('브랜드 기본정보','업체 이름, 상단 안내 문구, 고객 문의 연락처를 입력하세요.')+
    field('브랜드명','brand')+field('상단 영문 문구','tagline')+field('문의 버튼 문구','cta')+
    field('전화번호','phone','text','전화 링크 자동 연결')+field('이메일','email','email','전화번호가 없을 때 사용')+
    '<div class="sort-item"><label><input type="checkbox" id="demoMode" data-demo="1"'+(cfg.demoMode?' checked':'')+'>디자인 샘플 안내 표시</label></div>'+
    '<p class="warning">샘플의 업체명·서비스 설명은 예시입니다. 실제 운영 전 본인의 업체정보·연락처로 교체하고 데모용 사진의 사용권리를 확인한 뒤 샘플 표시를 해제하세요. 현재 편집 결과는 서버에 전송되지 않습니다.</p>';
   break;
  case 'hero':
   output=heading('첫 화면 디자인','방문자가 가장 먼저 읽는 문구와 메인 이미지를 편집합니다. 나머지 영역은 변경되지 않습니다.')+
    field('큰 제목','headline','textarea','줄바꿈 가능: 엔터 또는 <br>')+field('메인 설명','description','textarea')+upload('메인', 'heroImage');
   break;
  case 'about':
   output=heading('소개 섹션','브랜드의 특징과 공간·서비스가 가진 매력을 설명하세요.')+
    field('소개 제목','aboutTitle','textarea')+field('소개 본문','aboutText','textarea')+upload('소개', 'aboutImage');
   break;
  case 'services':
   output=heading('서비스·메뉴','서비스 카드를 직접 추가·삭제하고 내용도 바꿀 수 있어요.')+
    field('섹션 제목','servicesTitle')+collection('services','서비스',[['제목','title','text'],['설명','description','textarea']]);
   break;
  case 'gallery':
   output=heading('사진과 포트폴리오','사진 URL을 입력하거나 직접 업로드해 교체하세요. 각 사진의 설명도 편집할 수 있어요.')+
    field('갤러리 제목','galleryTitle')+collection('gallery','사진',[['제목','title','text'],['설명','description','text'],['사진','image','image']]);
   break;
  case 'faq':
   output=heading('자주 묻는 질문','고객의 문의가 많은 질문을 추가하고 실제 운영 정책으로 답하세요.')+
    field('섹션 제목','faqTitle')+collection('faq','질문',[['질문','question','text'],['답변','answer','textarea']]);
   break;
  case 'contact':
   output=heading('문의 안내','연락처는 브랜드 기본정보에서 등록할 수 있습니다.')+
    field('문의 섹션 제목','contactTitle','textarea')+field('문의 안내','contactText','textarea')+
    '<p class="warning">이 제작툴에는 실제 서버 접수형 문의폼이 포함되지 않습니다. 연락 버튼은 입력한 전화번호 또는 이메일로 연결됩니다. 서버 연동·도메인 연결은 별도 제작 서비스가 필요합니다.</p>';
   break;
  case 'style':
   output=heading('색상과 디자인','레이아웃 종류와 브랜드 색상을 바꾸면 전체 화면에 적용됩니다.')+
    '<div class="field"><label for="edit-style">레이아웃 테마</label><select id="edit-style" data-field="style">'+
    [['restaurant','에디토리얼 다이닝'],['beauty','뷰티 스튜디오'],['academy','모던 교육'],['clinic','클린 메디컬'],['corporate','코퍼레이트']].map(function(x){return '<option value="'+x[0]+'"'+(cfg.style===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+
    '</select></div>'+field('본문 글자색','colors.ink','color')+field('전체 배경색','colors.background','color')+
    field('포인트 색','colors.accent','color')+field('이미지 기본 배경','colors.panel','color');
   break;
  case 'part':
   var state=cfg.sectionStyles[activeSection]||{background:'',titleSize:0,spacing:0};
   var base=cfg.colors.background||'#ffffff';
   output=heading('선택 영역만 디자인 수정','다른 부분의 디자인과 배치는 그대로 둔 채 선택한 구역만 변경합니다.')+
     '<div class="field"><label for="sectionScope">수정할 영역</label><select id="sectionScope">'+
      Object.keys(partNames).map(function(id){return '<option value="'+id+'"'+(activeSection===id?' selected':'')+'>'+partNames[id]+'</option>'}).join('')+
     '</select></div>'+
     '<div class="part-control"><label>구역 배경색 (선택사항)</label><div class="part-row"><input id="partBackground" type="color" data-part-color="1" value="'+esc(state.background||base)+'"><button type="button" data-clear-part="background">기본 배경으로 되돌리기</button></div></div>'+
     field('이 구역 제목 크기 (픽셀)','sectionStyles.'+activeSection+'.titleSize','number','0 = 원래 디자인 유지 · 18~120')+
     field('이 구역 위아래 여백 (픽셀)','sectionStyles.'+activeSection+'.spacing','number','0 = 원래 디자인 유지 · 10~200')+
     '<button type="button" class="reset-section" data-reset-part="1">선택한 구역의 스타일 변경 모두 취소</button>'+
     '<p class="help">텍스트·이미지를 바꾸려면 미리보기에서 해당 요소를 직접 클릭하세요. 영역별 스타일 수정은 기본 템플릿 구조를 덮어쓰지 않습니다.</p>';
   break;
  case 'sections':
   output=heading('섹션 순서와 표시','위·아래 버튼으로 순서를 바꾸고 필요한 섹션만 노출할 수 있어요.')+
    cfg.sectionOrder.map(function(name,i){return '<div class="sort-item"><label><input type="checkbox" data-visible="'+esc(name)+'"'+(cfg.sectionEnabled[name]?' checked':'')+'>'+esc(kit.sectionNames[name])+'</label><div class="sort-actions"><button type="button" data-move="'+i+'" data-direction="-1"'+(i===0?' disabled':'')+'>↑</button><button type="button" data-move="'+i+'" data-direction="1"'+(i===cfg.sectionOrder.length-1?' disabled':'')+'>↓</button></div></div>'}).join('');
   break;
 }
 form.innerHTML=output;
}
function updateStatus(message){el('saveStatus').textContent=message}
function interactivePreview(){
 var html=kit.render(cfg,css);
 var extras='<style>.site-hero h1,.site-hero p,.site-hero .hero-media,.site-logo,.site-section h2,.site-section .about-photo,.site-section .service-card,.site-section .gallery-tile,.faq-list details{cursor:pointer}.site-hero h1:hover,.site-hero p:hover,.site-hero .hero-media:hover,.site-section h2:hover,.site-section .service-card:hover,.site-section .gallery-tile:hover{outline:2px dashed #2563eb;outline-offset:5px}</style>'+
 '<script>'+[
 "document.addEventListener('click',function(e){",
 " var target=e.target,section=target.closest('section'),tab='brand',field='';",
 " if(target.closest('.site-logo')){tab='brand';field='brand';}",
 " else if(section){",
 " tab=section.id==='top'?'hero':section.id;",
 " if(tab==='hero'){if(target.closest('.hero-media'))field='heroImage';else if(target.closest('.hero-label')){tab='brand';field='tagline';}else if(target.closest('h1'))field='headline';else if(target.closest('p'))field='description';else if(target.closest('a')){tab='brand';field='cta';}}",
 " else if(tab==='about'){if(target.closest('.about-photo'))field='aboutImage';else if(target.closest('h2'))field='aboutTitle';else if(target.closest('.about-copy p'))field='aboutText';}",
 " else if(tab==='services'||tab==='gallery'||tab==='faq'){",
 " var selector=tab==='services'?'.service-card':tab==='gallery'?'.gallery-tile':'.faq-list details';",
 " var item=target.closest(selector);if(item){var i=[].indexOf.call(section.querySelectorAll(selector),item);",
 " field=tab+'.'+i+'.'+(tab==='faq'?(target.closest('summary')?'question':'answer'):tab==='gallery'?(target.closest('img')||target.closest('.gallery-image')?'image':target.closest('strong')?'title':'description'):(target.closest('h3')?'title':'description'));",
 " }else if(target.closest('h2'))field=tab+'Title';}",
 " else if(tab==='contact'){if(target.closest('h2'))field='contactTitle';else if(target.closest('p'))field='contactText';}",
 " }",
 " if(!['brand','hero','about','services','gallery','faq','contact'].includes(tab))return;",
 " e.preventDefault();e.stopPropagation();",
 " window.parent.postMessage({type:'momentum-preview-select',tab:tab,field:field},'*');",
 "},true);"
 ].join('')+'</scr'+'ipt>';
 return html.replace('</body>',extras+'</body>');
}
function schedule(){
 clearTimeout(saveTimer);
 saveTimer=setTimeout(function(){
  el('sitePreview').srcdoc=interactivePreview();
  try{localStorage.setItem('momentum-website-builder-v1:'+activeId,JSON.stringify(cfg));updateStatus('자동 저장됨 · 이 브라우저')}
  catch(e){updateStatus('미리보기 반영 · 용량 제한으로 자동저장 불가 (설정 백업 사용)')}
 },180);
}
function preset(id){
 var entry=templates.find(function(x){return x.id===id})||templates[0];
 activeId=entry.id;undoStack=[];redoStack=[];lastField='';updateHistoryButtons();
 activeSection='hero';
 el('templateSelect').value=entry.id;
 el('templatePage').href='/website-samples/'+entry.id+'/';
 try{cfg=kit.normalize(JSON.parse(localStorage.getItem('momentum-website-builder-v1:'+entry.id)||'null')||kit.copy(entry))}
 catch(e){cfg=kit.normalize(kit.copy(entry))}
 buildFields();el('previewTitle').textContent=entry.label+' / '+cfg.brand;schedule();
 var url=new URL(location.href);url.searchParams.set('template',id);history.replaceState(null,'',url.pathname+url.search);
}
function download(name,contents,mime){
 var blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob);
 var link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(function(){URL.revokeObjectURL(url)},1000);
}
function filename(){return (String(cfg.brand||activeId).replace(/[^0-9a-zA-Z가-힣_-]/g,'-').slice(0,45)||'homepage')}
function importJson(file){
 if(!file||file.size>2000000){updateStatus('2MB 이하 JSON 파일만 불러올 수 있습니다.');return}
 var reader=new FileReader();
 reader.onload=function(){
  try{
   var json=JSON.parse(String(reader.result)),v=(json.config&&typeof json.config==='object')?json.config:json;
   if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid');
   rememberEdit('import');cfg=kit.normalize(v);if(!cfg.brand)throw Error('missing brand');
   if(!cfg.id)cfg.id=activeId;
   buildFields();schedule();updateStatus('설정 파일을 가져왔습니다.');
  }catch(e){updateStatus('JSON 형식을 확인해 주세요.')}
 };
 reader.readAsText(file);
}
function uploadImage(file,path){
 if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){updateStatus('JPG·PNG·WebP 이미지 파일만 사용할 수 있습니다.');return}
 if(file.size>7000000){updateStatus('이미지는 7MB 이하만 업로드하세요.');return}
 var r=new FileReader();
 r.onload=function(){
  var img=new Image();
  img.onload=function(){
   var scale=Math.min(1,1400/Math.max(img.width,img.height));
   var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   var data=canvas.toDataURL('image/jpeg',.78);
   if(data.length>2400000){updateStatus('이미지 용량이 큽니다. 더 작은 파일로 시도하세요.');return}
   rememberEdit('upload:'+path);set(path,data);buildFields();schedule();
  };
  img.onerror=function(){updateStatus('이미지 파일을 읽을 수 없습니다.')};
  img.src=String(r.result);
 };
 r.readAsDataURL(file);
}
function setup(){
 if(!kit){updateStatus('제작툴 로딩 오류');return}
 Promise.all([fetch('/admin/assets/presets.json').then(function(r){if(!r.ok)throw Error('presets');return r.json()}),
  fetch('/admin/assets/site-template.css').then(function(r){if(!r.ok)throw Error('css');return r.text()})])
 .then(function(results){
  templates=results[0];css=results[1];
  var dropdown=el('templateSelect');
  dropdown.innerHTML=templates.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(t.industry+' · '+t.label)+'</option>'}).join('');
  var selected=new URLSearchParams(location.search).get('template');
  preset(templates.some(function(x){return x.id===selected})?selected:templates[0].id);
 }).catch(function(e){updateStatus('템플릿을 불러오지 못했습니다. 페이지를 새로고침해 주세요.')});
 el('templateSelect').addEventListener('change',function(e){preset(e.target.value)});
 document.querySelectorAll('.editor-nav button').forEach(function(btn){
  btn.addEventListener('click',function(){selectTab(btn.dataset.tab)});
 });
 window.addEventListener('message',function(e){
  if(e.source!==el('sitePreview').contentWindow||!e.data||e.data.type!=='momentum-preview-select')return;
  var part=e.data.tab;
  if(!['brand','hero','about','services','gallery','faq','contact'].includes(part))return;
  if(part!=='brand')activeSection=part;
  selectTab(part,typeof e.data.field==='string'?e.data.field:'');
  updateStatus('선택한 영역을 편집합니다 · 다른 영역은 그대로 유지');
 });
 el('editorFields').addEventListener('input',function(e){
  if(!cfg||!e.target.hasAttribute('data-field'))return;
  rememberEdit(e.target.dataset.field);
  set(e.target.dataset.field,e.target.value);
  el('previewTitle').textContent=cfg.brand+' · '+templates.find(function(x){return x.id===activeId}).label;
  schedule();
 });
 el('editorFields').addEventListener('change',function(e){
  var target=e.target;
  if(target.id==='sectionScope'){activeSection=target.value;buildFields();return}
  if(target.hasAttribute('data-part-color')){
    rememberEdit('sectionStyles.'+activeSection+'.background');
    cfg.sectionStyles[activeSection].background=target.value;
    schedule();return;
  }
  if(target.hasAttribute('data-visible')){rememberEdit('visibility:'+target.dataset.visible);cfg.sectionEnabled[target.dataset.visible]=target.checked;schedule()}
  if(target.hasAttribute('data-demo')){rememberEdit('demo');cfg.demoMode=target.checked;schedule()}
  if(target.hasAttribute('data-upload'))uploadImage(target.files?.[0],target.dataset.upload);
 });
 el('editorFields').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b||!cfg)return;
  if(b.hasAttribute('data-remove')){var type=b.dataset.remove,idx=Number(b.dataset.index);rememberEdit('remove:'+type+idx);cfg[type].splice(idx,1);buildFields();schedule()}
  if(b.hasAttribute('data-add')){
    var type=b.dataset.add;if(cfg[type].length>=12){updateStatus('한 영역에 최대 12개까지 추가할 수 있습니다.');return}
    rememberEdit('add:'+type);
    cfg[type].push(type==='services'?{title:'새 서비스',description:'서비스 설명을 입력하세요.'}:type==='gallery'?{title:'새 사진',description:'사진 소개',image:''}:{question:'자주 묻는 질문',answer:'답변 내용을 입력하세요.'});
    buildFields();schedule();
  }
  if(b.hasAttribute('data-move')){var index=Number(b.dataset.move),next=index+Number(b.dataset.direction);
    if(next>=0&&next<cfg.sectionOrder.length){rememberEdit('move:'+index);var a=cfg.sectionOrder;[a[index],a[next]]=[a[next],a[index]];buildFields();schedule()}
  }
  if(b.hasAttribute('data-clear-image')){rememberEdit('clear:'+b.dataset.clearImage);set(b.dataset.clearImage,'');buildFields();schedule()}
  if(b.hasAttribute('data-clear-part')){rememberEdit('part-background');cfg.sectionStyles[activeSection].background='';buildFields();schedule()}
  if(b.hasAttribute('data-reset-part')){rememberEdit('reset-part:'+activeSection);cfg.sectionStyles[activeSection]={background:'',titleSize:0,spacing:0};buildFields();schedule()}
 });
 el('undoEdit').addEventListener('click',function(){restoreHistory(undoStack,redoStack)});
 el('redoEdit').addEventListener('click',function(){restoreHistory(redoStack,undoStack)});
 document.querySelectorAll('[data-viewport]').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('[data-viewport]').forEach(function(x){x.classList.toggle('active',x===b)});
  el('sitePreview').parentElement.parentElement.classList.toggle('mobile',b.dataset.viewport==='mobile');
 })});
 el('resetDraft').addEventListener('click',function(){
  if(!confirm('현재 템플릿의 편집 내용을 지우고 원래 샘플로 초기화할까요?'))return;
  try{localStorage.removeItem('momentum-website-builder-v1:'+activeId)}catch(e){}
  preset(activeId);updateStatus('원래 샘플로 초기화했습니다.');
 });
 el('downloadHtml').addEventListener('click',function(){
  if(!cfg)return;
  if(!cfg.phone&&!cfg.email)updateStatus('HTML 저장 완료. 실제 운영 전 연락처를 입력해 주세요.');
  download(filename()+'.html',kit.render(cfg,css),'text/html;charset=utf-8');
 });
 el('saveConfig').addEventListener('click',function(){if(cfg)download(filename()+'.json',JSON.stringify({version:1,templateId:activeId,config:cfg},null,2),'application/json')});
 el('loadConfig').addEventListener('click',function(){el('importInput').click()});
 el('importInput').addEventListener('change',function(e){importJson(e.target.files?.[0]);e.target.value=''});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();