const PACKET_KEY = 'patentWorkbench.handoff.module2.v1';
const DRAFT_KEY = 'patentWorkbench.draft.module2.v1';
const $ = (s) => document.querySelector(s);
let packet = null;
let timer;

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), 3000); }
function safeFilename(value='') { return String(value || '특허명세서').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_').slice(0,90); }
function getDraftState() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } }
function setEditorState(text) { $('#draftText').value = text || ''; updateCounts(); $('#downloadDocxBtn').disabled = !text?.trim(); }
function updateCounts() { $('#wordCount').textContent = `${$('#draftText').value.length.toLocaleString('ko-KR')}자`; }
function paragraphRecords(text) { return text.split(/\n+/).map(x => x.trim()).filter(Boolean).map((content, index) => ({ paragraph_number:index+1, content })); }
function saveDraft(silent=false) {
  const content = $('#draftText').value;
  if (!packet && !content.trim()) { if (!silent) toast('먼저 준비 패킷을 가져와 주세요.'); return; }
  const project = packet?.project || {};
  const saved = { document_schema_version:'1.0', module_versions:{ preparation:packet?.module_versions?.preparation || '0.1.0', drafting:'0.2.0', review:'0.3.0', contract:packet?.module_versions?.contract || '1.0' }, project:{id:project.id || '', name:project.name || '특허명세서'}, source_packet_schema_version:packet?.packet_schema_version || '', generated_at:getDraftState()?.generated_at || null, updated_at:new Date().toISOString(), claims:packet?.claims?.text || '', body:content, paragraphs:paragraphRecords(content), author_confirmations:packet?.author_confirmations || [] };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
  $('#saveState').textContent = '브라우저 저장됨'; $('#editorState').textContent = '브라우저에 저장됨'; $('.autosave-dot').classList.add('saved');
  if (!silent) toast('초안을 브라우저에 저장했습니다.');
}
function validatePacket(value) {
  if (!value || value.packet_schema_version !== '1.0') throw new Error('지원하지 않는 패킷입니다. packet_schema_version 1.0 파일을 선택해 주세요.');
  if (!value.claims?.text?.trim()) throw new Error('패킷에 청구항 원문이 없습니다. 준비 모듈에서 청구항을 입력해 주세요.');
  return value;
}
function renderPacket(value) {
  packet = validatePacket(value);
  const materials = (packet.materials || []).filter(m => m.type === 'technical_material');
  const components = packet.claim_components || [];
  $('#projectTitle').textContent = packet.project?.name || '이름 없는 프로젝트';
  $('#projectMeta').textContent = `준비 모듈 v${packet.module_versions?.preparation || '0.1.0'} · 패킷 계약 ${packet.packet_schema_version} · ${new Date(packet.created_at || Date.now()).toLocaleString('ko-KR')}`;
  $('#packetStatus').textContent = '연결됨'; $('#packetStatus').classList.add('ready');
  $('#packetSummary').textContent = '준비 모듈의 입력자료를 초안 작성에 사용합니다. 입력한 청구항은 원문 그대로 전달됩니다.';
  $('#packetFacts').innerHTML = `<div class="packet-fact"><span>청구항</span><b>${packet.claims.text.length.toLocaleString('ko-KR')}자</b></div><div class="packet-fact"><span>기술자료</span><b>${materials.length}건</b></div><div class="packet-fact"><span>구성 후보</span><b>${components.length}개</b></div><div class="packet-fact"><span>작성 조건</span><b>${components.filter(c => c.user_conditions?.trim()).length}개 구성</b></div>`;
  const concerns = (packet.claim_components || []).filter(c => c.support_check && c.support_check.level !== 'good');
  $('#packetWarning').hidden = !concerns.length;
  $('#packetWarning').textContent = concerns.length ? `자료 확인이 필요한 구성 ${concerns.length}개가 있습니다. 초안의 [발명자 확인 필요] 표시와 확인 질문을 검토하세요.` : '';
  $('#generateBtn').disabled = false;
}
function safeRenderStoredPacket() {
  try { const raw = localStorage.getItem(PACKET_KEY); if (raw) renderPacket(JSON.parse(raw)); }
  catch (error) { $('#packetSummary').textContent = error.message; }
}
function currentDraftRequest() {
  return { packet, model:$('#modelInput').value.trim(), extra_instruction:$('#extraInstruction').value.trim() };
}
async function generate() {
  if (!packet) { toast('준비 패킷을 먼저 연결해 주세요.'); return; }
  $('#generateBtn').disabled = true; $('#editorState').textContent = 'AI가 자료를 분석하고 초안을 작성하고 있습니다…'; $('#draftMeta').textContent = '청구항 구성 및 기술자료를 바탕으로 상세한 설명을 생성 중입니다.'; $('#saveState').textContent = '작성 중';
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 360000);
  try {
    const response = await fetch('/api/draft', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(currentDraftRequest()), signal:controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `서버 오류 (${response.status})`);
    if (!data.text?.trim()) throw new Error('AI가 빈 문서를 반환했습니다. 다시 시도해 주세요.');
    setEditorState(data.text); localStorage.setItem(DRAFT_KEY, JSON.stringify({ document_schema_version:'1.0', module_versions:{preparation:packet.module_versions?.preparation || '0.1.0', drafting:'0.2.0', review:'0.3.0', contract:packet.module_versions?.contract || '1.0'}, project:packet.project, source_packet_schema_version:packet.packet_schema_version, generated_at:new Date().toISOString(), updated_at:new Date().toISOString(), claims:packet.claims.text, body:data.text, paragraphs:paragraphRecords(data.text), author_confirmations:packet.author_confirmations || [] }));
    $('#draftMeta').textContent = `AI 초안 · ${new Date().toLocaleString('ko-KR')} · 모델 ${data.model || '서버 설정'}`; $('#editorState').textContent = '초안 생성 완료 · 편집 가능'; $('#saveState').textContent = '초안 저장됨'; $('.autosave-dot').classList.add('saved'); toast('명세서 초안을 생성했습니다. 내용을 검토하고 DOCX로 내려받으세요.');
  } catch (error) {
    const message = error.name === 'AbortError' ? '작성 시간이 초과되었습니다. 자료량을 줄이거나 서버 제한 시간을 확인해 주세요.' : error.message;
    $('#editorState').textContent = '작성에 실패했습니다'; $('#draftMeta').textContent = message; toast(message);
  } finally { clearTimeout(timeout); $('#generateBtn').disabled = false; }
}
async function downloadDocx() {
  if (!$('#draftText').value.trim()) return toast('DOCX로 저장할 본문이 없습니다.');
  $('#downloadDocxBtn').disabled = true; $('#editorState').textContent = 'DOCX 문서를 만드는 중…';
  try {
    const response = await fetch('/api/docx', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:packet?.project?.name || '특허명세서', text:$('#draftText').value, packet_schema_version:packet?.packet_schema_version || '1.0', module_versions:{preparation:packet?.module_versions?.preparation || '0.1.0', drafting:'0.2.0', review:'0.3.0', contract:packet?.module_versions?.contract || '1.0'} }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `DOCX 생성 실패 (${response.status})`); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${safeFilename(packet?.project?.name)}_명세서.docx`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); $('#editorState').textContent = 'DOCX 다운로드 완료'; saveDraft(true); toast('DOCX 파일을 다운로드했습니다. 검수 후 저장하면 새 버전으로 내려받습니다.');
  } catch (error) { $('#editorState').textContent = 'DOCX 생성 실패'; toast(error.message); }
  finally { $('#downloadDocxBtn').disabled = !$('#draftText').value.trim(); }
}
function showConfirm(title, message, action, onConfirm) { const dialog=$('#confirmDialog'); $('#dialogTitle').textContent=title; $('#dialogMessage').textContent=message; $('#dialogConfirm').textContent=action; dialog.showModal(); $('#dialogConfirm').onclick=(e)=>{e.preventDefault();dialog.close();onConfirm();}; }
async function importFile(file) { if (!file) return; try { const text=await file.text(); const value=JSON.parse(text); renderPacket(value); localStorage.setItem(PACKET_KEY, JSON.stringify(value)); toast('준비 패킷을 연결했습니다.'); } catch (error) { toast(error.message || 'JSON 패킷을 읽지 못했습니다.'); } }
function exportReviewDraft() {
  if (!$('#draftText').value.trim()) return toast('검수할 초안이 없습니다. 먼저 명세서를 생성해 주세요.');
  saveDraft(true);
  const data=localStorage.getItem(DRAFT_KEY);
  const blob=new Blob([data],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${safeFilename(packet?.project?.name)}_검수패킷.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('검수 패킷 JSON을 내보냈습니다.');
}

$('#generateBtn').addEventListener('click', generate);
$('#refreshPacketBtn').addEventListener('click', () => { safeRenderStoredPacket(); if (packet) toast('최신 준비 패킷을 연결했습니다.'); else toast('저장된 패킷이 없습니다. JSON 파일을 가져와 주세요.'); });
$('#importPacketBtn').addEventListener('click', () => $('#packetFile').click()); $('#manualImportBtn').addEventListener('click', () => $('#packetFile').click());
$('#packetFile').addEventListener('change', event => { importFile(event.target.files?.[0]); event.target.value=''; });
$('#draftText').addEventListener('input', () => { updateCounts(); $('#editorState').textContent='편집 내용 저장 중…'; $('#saveState').textContent='저장 중'; clearTimeout(timer); timer=setTimeout(() => saveDraft(true), 400); });
$('#saveDraftBtn').addEventListener('click', () => saveDraft()); $('#downloadDocxBtn').addEventListener('click', downloadDocx);
$('#exportDraftJsonBtn').addEventListener('click',exportReviewDraft);
$('#copyTextBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#draftText').value); toast('본문을 복사했습니다.'); } catch { toast('브라우저에서 복사를 허용하지 않았습니다.'); } });
$('#modelInput').addEventListener('change', () => localStorage.setItem('patentWorkbench.drafting.model.v1', $('#modelInput').value.trim()));
safeRenderStoredPacket();
try { $('#modelInput').value=localStorage.getItem('patentWorkbench.drafting.model.v1') || 'gpt-5-mini'; } catch {}
try { const saved=getDraftState(); if (saved?.body) { setEditorState(saved.body); $('#draftMeta').textContent=`저장된 초안 · ${new Date(saved.updated_at).toLocaleString('ko-KR')}`; $('#editorState').textContent='저장된 초안을 불러왔습니다'; if (!packet && saved.project?.name) $('#projectTitle').textContent=saved.project.name; } } catch {}
fetch('/api/status').then(r=>r.ok?r.json():null).then(data=>{ if (!data) return; if (!data.configured) { $('#draftMeta').textContent='AI 서버 설정이 필요합니다. README의 OPENAI_API_KEY 설정 후 재실행하세요.'; $('#editorState').textContent='서버 준비 필요'; } else if (data.model) { $('#modelInput').placeholder=data.model; } }).catch(()=>{ $('#draftMeta').textContent='이 화면은 정적 서버에서 열렸습니다. AI 작성과 DOCX 출력을 사용하려면 run_server.py로 실행하세요.'; $('#editorState').textContent='서버 연결 안 됨'; });
