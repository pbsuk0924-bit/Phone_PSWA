const DRAFT_KEY = 'patentWorkbench.draft.module2.v1';
const VERSION_KEY = 'patentWorkbench.review.versions.v1';
const $ = (s) => document.querySelector(s);
let documentState = null;
let suggestions = [];
let saveTimer;
let toastTimer;

function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3200); }
function safeFilename(value='') { return String(value || '특허명세서').replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'_').slice(0,90); }
function makeParagraphs(text) { return String(text || '').split(/\n+/).map(s=>s.trim()).filter(Boolean).map((content,index)=>({paragraph_number:index+1,content})); }
function currentParagraphs() { return [...document.querySelectorAll('.paragraph-input')].map((el,index)=>({paragraph_number:index+1,content:el.value.trim()})); }
function bodyText() { return currentParagraphs().map(p=>p.content).join('\n\n'); }
function readVersions() { try { return JSON.parse(localStorage.getItem(VERSION_KEY) || '{}'); } catch { return {}; } }
function projectKey() { return documentState?.project?.id || safeFilename(documentState?.project?.name || 'default'); }
function getVersions() { return readVersions()[projectKey()] || []; }
function updateMeta() {
  const body=bodyText(); const paragraphs=[...document.querySelectorAll('.paragraph-input')];
  $('#paragraphCount').textContent=`${paragraphs.length}개 문단`;
  $('#documentCharacters').textContent=`${body.length.toLocaleString('ko-KR')}자`;
}
function persistDraft(silent=true) {
  if (!documentState) return;
  const body=bodyText();
  documentState={...documentState,document_schema_version:'1.0',module_versions:{...(documentState.module_versions||{}),review:'0.3.0'},body,paragraphs:currentParagraphs(),updated_at:new Date().toISOString()};
  localStorage.setItem(DRAFT_KEY,JSON.stringify(documentState));
  $('#saveState').textContent='브라우저 저장됨'; $('#documentState').textContent='수정 내용 저장됨'; $('.autosave-dot').classList.add('saved');
  updateMeta();
  if (!silent) toast('수정 내용을 브라우저에 저장했습니다.');
}
function parseNumbers(value=$('#paragraphNumbers').value) {
  const chunks=value.split(/[\s,，;；]+/).filter(Boolean);
  if (!chunks.length) return [];
  if (chunks.some(x=>!/^\d+$/.test(x))) throw new Error('문단 번호는 쉼표로 구분한 양의 정수로 입력해 주세요.');
  return [...new Set(chunks.map(Number))].sort((a,b)=>a-b);
}
function renderParagraphs() {
  const list=$('#paragraphList'); list.replaceChildren();
  const paragraphs=documentState?.paragraphs?.length?documentState.paragraphs:makeParagraphs(documentState?.body || '');
  if (!paragraphs.length) { list.innerHTML='<div class="document-empty">아직 작성된 문서가 없습니다. 2번 모듈에서 초안을 만든 뒤 이 화면을 열거나, 검수 JSON을 가져오세요.</div>'; }
  paragraphs.forEach(({paragraph_number,content})=>{
    const row=document.createElement('article'); row.className='numbered-row'; row.dataset.number=paragraph_number;
    const number=document.createElement('button'); number.className='paragraph-number'; number.type='button'; number.textContent=String(paragraph_number).padStart(3,'0'); number.title=`문단 ${paragraph_number}를 수정 대상으로 추가`; number.addEventListener('click',()=>toggleNumber(paragraph_number));
    const textarea=document.createElement('textarea'); textarea.className='paragraph-input'; textarea.setAttribute('aria-label',`문단 ${paragraph_number}`); textarea.value=content; textarea.rows=Math.max(2,Math.min(10,Math.ceil(content.length/60)));
    textarea.addEventListener('input',()=>{ row.classList.add('edited'); $('#documentState').textContent='수정 내용 저장 중…'; $('#saveState').textContent='저장 중'; clearTimeout(saveTimer); saveTimer=setTimeout(()=>persistDraft(true),450); });
    row.append(number,textarea); list.append(row);
  });
  $('#documentMeta').textContent=documentState?.generated_at ? `초안 생성 ${new Date(documentState.generated_at).toLocaleString('ko-KR')} · 문서 스키마 ${documentState.document_schema_version}` : '가져온 초안';
  updateMeta(); refreshSelection();
}
function toggleNumber(n) { let nums=[]; try { nums=parseNumbers(); } catch {} const set=new Set(nums); set.has(n)?set.delete(n):set.add(n); $('#paragraphNumbers').value=[...set].sort((a,b)=>a-b).join(', '); refreshSelection(); }
function refreshSelection() { let nums=[]; try { nums=parseNumbers(); } catch {} document.querySelectorAll('.numbered-row').forEach(row=>row.classList.toggle('targeted',nums.includes(Number(row.dataset.number)))); }
function validateDocument(value) {
  if (!value || value.document_schema_version!=='1.0' || typeof value.body!=='string') throw new Error('document_schema_version 1.0 형식의 검수 문서 JSON이 필요합니다.');
  value.paragraphs=Array.isArray(value.paragraphs)&&value.paragraphs.length?value.paragraphs.map((p,index)=>({paragraph_number:index+1,content:String(p.content??'')})):makeParagraphs(value.body);
  if (!value.paragraphs.length) throw new Error('문서 본문이 비어 있습니다.');
  return value;
}
function loadDocument(value, persist=true) {
  const validated=validateDocument(value);
  documentState={...validated,module_versions:{...(validated.module_versions||{}),review:'0.3.0'}};
  $('#projectTitle').textContent=documentState.project?.name || '특허명세서';
  $('#projectMeta').textContent=`작성 모듈 v${documentState.module_versions?.drafting || '0.2.0'} · 문서 스키마 ${documentState.document_schema_version}`;
  $('#saveState').textContent='초안 불러옴'; $('#documentState').textContent='편집 가능';
  renderParagraphs(); renderVersions();
  if (persist) localStorage.setItem(DRAFT_KEY,JSON.stringify(documentState));
}
function renderVersions() {
  const versions=getVersions(); $('#versionCount').textContent=`${versions.length}개`;
  const list=$('#versionList'); list.replaceChildren();
  if (!versions.length) { const blank=document.createElement('span'); blank.className='version-empty'; blank.textContent='아직 저장된 수정 버전이 없습니다.'; list.append(blank); return; }
  [...versions].reverse().forEach(v=>{const row=document.createElement('div'); row.className='version-row'; const icon=document.createElement('span');icon.className='version-icon';icon.textContent=`v${v.version}`;const copy=document.createElement('span');copy.className='version-copy';const name=document.createElement('b');name.textContent=v.filename;const date=document.createElement('small');date.textContent=new Date(v.saved_at).toLocaleString('ko-KR');copy.append(name,date);row.append(icon,copy);list.append(row);});
}
function downloadJson(value,filename) { const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}); const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function renderSuggestions(items) {
  suggestions=items; const box=$('#suggestions'); box.replaceChildren();
  if (!items.length) return;
  const title=document.createElement('div');title.className='suggestions-title';title.textContent=`수정 제안 ${items.length}개 · 확인 후 적용`;box.append(title);
  items.forEach(item=>{
    const card=document.createElement('article');card.className='suggestion-card';
    const head=document.createElement('div');head.className='suggestion-head';const label=document.createElement('b');label.textContent=`문단 ${item.paragraph_number}`;const apply=document.createElement('button');apply.className='text-button apply-suggestion';apply.type='button';apply.textContent='이 문단에 적용';apply.addEventListener('click',()=>applySuggestion(item.paragraph_number));head.append(label,apply);
    const revised=document.createElement('p');revised.className='suggestion-copy';revised.textContent=item.content;
    card.append(head,revised);box.append(card);
  });
}
function applySuggestion(number) {
  const item=suggestions.find(x=>x.paragraph_number===number); const input=document.querySelector(`.numbered-row[data-number="${number}"] .paragraph-input`);
  if (!item || !input) return toast('해당 문단을 찾지 못했습니다.');
  input.value=item.content; input.dispatchEvent(new Event('input',{bubbles:true}));
  suggestions=suggestions.filter(x=>x.paragraph_number!==number);renderSuggestions(suggestions);toast(`문단 ${number}에 제안을 적용했습니다. 우측 내용을 확인하세요.`);
}
async function requestRevision() {
  if (!documentState) return toast('먼저 2번 모듈 초안을 불러오세요.');
  let numbers; try { numbers=parseNumbers(); } catch(e) { return toast(e.message); }
  if (!numbers.length) return toast('수정할 문단 번호를 입력하거나 우측 번호를 눌러 선택하세요.');
  if (!$('#revisionInstruction').value.trim()) return toast('수정 지시를 입력해 주세요.');
  if (numbers.some(n=>n<1 || n>document.querySelectorAll('.paragraph-input').length)) return toast('문단 번호가 현재 문서 범위를 벗어났습니다.');
  $('#requestRevisionBtn').disabled=true;$('#revisionStatus').textContent=`문단 ${numbers.join(', ')} 수정 제안을 요청하고 있습니다…`;
  const current={...documentState,body:bodyText(),paragraphs:currentParagraphs()};
  try {
    const response=await fetch('/api/revise',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:current,paragraph_numbers:numbers,instruction:$('#revisionInstruction').value.trim()})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||`서버 오류 (${response.status})`);
    renderSuggestions(result.revisions||[]);$('#revisionStatus').textContent=`AI 수정안 ${result.revisions?.length||0}개를 받았습니다. 적용할 문단을 선택하세요.`;toast('수정 제안을 받았습니다. 적용 전후 내용을 확인해 주세요.');
  } catch(error) { $('#revisionStatus').textContent=error.message;toast(error.message); }
  finally { $('#requestRevisionBtn').disabled=false; }
}
function confirm(title,message,button,onConfirm) { const dlg=$('#confirmDialog');$('#dialogTitle').textContent=title;$('#dialogMessage').textContent=message;$('#dialogConfirm').textContent=button;dlg.showModal();$('#dialogConfirm').onclick=e=>{e.preventDefault();dlg.close();onConfirm();}; }
function saveVersion() {
  if (!documentState || !bodyText().trim()) return toast('저장할 문서가 없습니다.');
  const versions=getVersions();const version=Math.max(0,...versions.map(v=>Number(v.version)||0))+1;const filename=`${safeFilename(documentState.project?.name)}_명세서-v${version}.docx`;
  confirm('수정본을 새 버전으로 저장할까요?',`기존 파일은 그대로 유지됩니다. 새 파일을 “${filename}” 이름으로 다운로드하고 버전 이력에 기록합니다.`,`v${version} 저장`,()=>performVersionSave(version,filename));
}
async function performVersionSave(version,filename) {
  $('#saveVersionBtn').disabled=true;$('#documentState').textContent=`v${version} DOCX 생성 중…`;
  const body=bodyText();
  try {
    const response=await fetch('/api/docx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:documentState.project?.name||'특허명세서',text:body,version,module_versions:{...(documentState.module_versions||{}),review:'0.3.0',contract:documentState.module_versions?.contract||'1.0'}})});
    if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error||`DOCX 저장 실패 (${response.status})`);}
    const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    const record={version,filename,saved_at:new Date().toISOString()};const all=readVersions();all[projectKey()]=[...(all[projectKey()]||[]),record];localStorage.setItem(VERSION_KEY,JSON.stringify(all));
    documentState={...documentState,body,paragraphs:currentParagraphs(),module_versions:{...(documentState.module_versions||{}),review:'0.3.0'},latest_saved_version:version,updated_at:new Date().toISOString()};localStorage.setItem(DRAFT_KEY,JSON.stringify(documentState));
    $('#documentState').textContent=`v${version} 저장 완료`;$('#saveState').textContent=`v${version} 다운로드됨`;renderVersions();toast(`수정본을 ${filename}으로 저장했습니다.`);
  } catch(error) { $('#documentState').textContent='버전 저장에 실패했습니다';toast(error.message); }
  finally { $('#saveVersionBtn').disabled=false; }
}
async function importJson(file) { if(!file)return;try{const value=JSON.parse(await file.text());loadDocument(value,true);toast('검수 문서를 불러왔습니다.');}catch(error){toast(error.message||'JSON 문서를 읽지 못했습니다.');} }

$('#requestRevisionBtn').addEventListener('click',requestRevision);
$('#saveVersionBtn').addEventListener('click',saveVersion);
$('#saveBrowserBtn').addEventListener('click',()=>persistDraft(false));
$('#paragraphNumbers').addEventListener('input',refreshSelection);
$('#selectAllBtn').addEventListener('click',()=>{$('#paragraphNumbers').value=[...document.querySelectorAll('.paragraph-input')].map((_,i)=>i+1).join(', ');refreshSelection();});
$('#importDraftBtn').addEventListener('click',()=>$('#draftFile').click());
$('#draftFile').addEventListener('change',e=>{importJson(e.target.files?.[0]);e.target.value='';});
$('#exportReviewJsonBtn').addEventListener('click',()=>{if(!documentState)return toast('내보낼 초안이 없습니다.');persistDraft(true);downloadJson(documentState,`${safeFilename(documentState.project?.name)}_검수패킷.json`);toast('검수 패킷 JSON을 내보냈습니다.');});
try {const raw=localStorage.getItem(DRAFT_KEY);if(raw)loadDocument(JSON.parse(raw));else $('#documentState').textContent='2번 모듈 초안이 없습니다.';}catch(error){$('#documentState').textContent=error.message;}
fetch('/api/status').catch(()=>{if(!documentState)$('#documentState').textContent='서버를 확인할 수 없습니다. run_server.py로 실행해 주세요.';});
