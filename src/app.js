const STORAGE_KEY = 'patentWorkbench.preparation.v1';
const PACKET_KEY = 'patentWorkbench.handoff.module2.v1';
const MODULE_CONTRACT = '1.0';
const PREPARATION_VERSION = '0.2.0';
const INITIAL_STATE = { activeProjectId: 'project-first', projects: [{ id: 'project-first', name: '새 프로젝트', claims: '', materials: [], conditions: {}, sourceNotes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), analysis: null }] };
let state = loadState();
let toastTimer;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const currentProject = () => state.projects.find((p) => p.id === state.activeProjectId) || state.projects[0];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.projects?.length) return saved;
  } catch (error) { console.warn('Could not read saved workspace', error); }
  return structuredClone(INITIAL_STATE);
}
function persist() {
  const p = currentProject();
  if (p) p.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('#saveState').textContent = '저장됨';
  } catch (error) {
    $('#saveState').textContent = '저장 공간 부족';
    showToast('브라우저 저장 공간이 부족합니다. 내보내기로 백업해 주세요.');
  }
  renderSummary();
}
function markEditing() { $('#saveState').textContent = '저장 중…'; }
function showToast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function makeId() { return `p-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`; }
function formatDate(value) { return new Intl.DateTimeFormat('ko-KR', { month:'short', day:'numeric' }).format(new Date(value)); }

function renderNav() {
  const nav = $('#projectNav');
  nav.innerHTML = state.projects.map((p) => `<button class="${p.id === state.activeProjectId ? 'active' : ''}" data-project="${escapeHTML(p.id)}"><span class="nav-project-icon">◈</span><span class="nav-project-name">${escapeHTML(p.name)}</span><span class="nav-count">${p.materials.length || ''}</span></button>`).join('');
  $$('[data-project]', nav).forEach((button) => button.addEventListener('click', () => {
    state.activeProjectId = button.dataset.project; render();
  }));
}
function render() {
  const p = currentProject();
  if (!p) return;
  $('#crumbProject').textContent = p.name;
  $('#projectTitle').textContent = p.name;
  $('#claimsInput').value = p.claims;
  $('#claimCount').textContent = p.claims.length.toLocaleString('ko-KR');
  $('#projectMeta').textContent = p.claims.trim() ? `마지막 편집 ${formatDate(p.updatedAt)} · 준비 단계` : '준비 단계 · 아직 청구항이 입력되지 않았습니다';
  renderNav(); renderMaterials(); renderComponents(); renderConditions(); renderCoverage(); renderSummary();
}
function getComponents(claims = currentProject()?.claims || '') {
  const cleaned = claims.replace(/【\s*청구항\s*\d+[^】]*】/g, '\n').replace(/^\s*청구항\s*\d+\s*[:.：]?/gim, '\n');
  const chunks = cleaned.split(/[;；\n]+/).map((s) => s.trim()).filter(Boolean);
  const ignored = /^(및|또는|상기|포함하는|장치|방법|시스템|것을 특징으로 하는|청구항)/;
  const result = [];
  for (const raw of chunks) {
    if (ignored.test(raw)) continue;
    let item = raw.replace(/^(및|또는)\s*/, '').replace(/\s*(을|를|이|가)?\s*포함하는.*$/u, '').trim();
    item = item.replace(/^(상기\s*)/u, '').replace(/[.。]+$/g, '').trim();
    if (item.length < 3 || /^(장치|방법|시스템|것)$/u.test(item)) continue;
    // Skip claim fragments that only specify a relation; keep the descriptive element phrase.
    if (!/[부기체모듈센서부재장치알고리즘데이터신호회로플랫폼부품단계]/u.test(item) && item.length > 38) item = item.slice(0, 38);
    if (!result.some((x) => x.toLowerCase() === item.toLowerCase())) result.push(item);
  }
  return result.slice(0, 20);
}
function renderComponents() {
  const components = getComponents(); const box = $('#componentsPreview');
  if (!components.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="preview-head"><b>감지된 구성요소 · ${components.length}개</b><span>초안 분석용이며 직접 확인해 주세요</span></div><div>${components.map((c, i) => `<span class="component-chip"><em>${String(i + 1).padStart(2, '0')}</em>${escapeHTML(c)}</span>`).join('')}</div>`;
}
function renderMaterials() {
  const p = currentProject();
  $('#materialsCount').textContent = `${p.materials.length}개 자료`;
  const list = $('#materialsList');
  if (!p.materials.length) { list.innerHTML = ''; return; }
  list.innerHTML = p.materials.map((m) => { const sources = (m.sources || []).filter((s) => /^https?:\/\//i.test(s.url || '')); return `<article class="material-card"><div class="material-type ${m.kind === 'task' ? 'task' : ''}">${m.kind === 'task' ? '✦' : '▤'}</div><div class="material-copy"><b>${escapeHTML(m.title)}</b><p>${escapeHTML(m.body || '내용 없음')}</p>${sources.length ? `<div class="material-sources">${sources.map((s, i) => `<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${escapeHTML(s.title)}</a>`).join('')}</div>` : ''}<div class="material-meta"><span>${m.kind === 'task' ? '<span class="status-pip"></span>조사 요청' : '자료 출처'}</span>${m.kind === 'material' && !sources.length ? `<select class="source-select" data-source="${escapeHTML(m.id)}" aria-label="자료 출처"><option ${m.source === '발명자 또는 자사 자료' ? 'selected' : ''}>발명자 또는 자사 자료</option><option ${m.source === '도면 및 도면 설명' ? 'selected' : ''}>도면 및 도면 설명</option><option ${m.source === '추가 실시예 자료' ? 'selected' : ''}>추가 실시예 자료</option><option ${m.source === '선행기술 자료' ? 'selected' : ''}>선행기술 자료</option><option ${m.source === '경쟁사 또는 회피설계 참고자료' ? 'selected' : ''}>경쟁사 또는 회피설계 참고자료</option></select>` : ''}<span>${formatDate(m.createdAt)}</span></div></div><button class="delete-material" data-delete="${escapeHTML(m.id)}" title="자료 삭제">×</button></article>`; }).join('');
  $$('[data-delete]', list).forEach((button) => button.addEventListener('click', () => {
    const p = currentProject(); p.materials = p.materials.filter((m) => m.id !== button.dataset.delete); p.analysis = null; persist(); render(); showToast('자료를 목록에서 삭제했습니다.');
  }));
  $$('[data-source]', list).forEach((select) => select.addEventListener('change', () => {
    const m = currentProject().materials.find((x) => x.id === select.dataset.source); if (m) m.source = select.value; currentProject().analysis = null; persist(); renderCoverage();
  }));
}
function renderConditions() {
  const p = currentProject(); const components = getComponents(); const list = $('#conditionsList');
  if (!components.length) { list.innerHTML = '<div class="condition-blank">청구항을 입력하면 구성별 조건 입력란이 표시됩니다.</div>'; return; }
  list.innerHTML = components.map((c, i) => `<div class="condition-row"><div class="condition-title"><span class="muted">구성 ${String(i + 1).padStart(2, '0')}</span> · ${escapeHTML(c)}</div><textarea data-condition="${i}" placeholder="예: 복수 센서 조합 허용, 센서의 종류·배치 변형 포함, 확인되지 않은 수치는 기재하지 않음">${escapeHTML(p.conditions[i] || '')}</textarea></div>`).join('');
  $$('[data-condition]', list).forEach((input) => input.addEventListener('input', () => { markEditing(); p.conditions[input.dataset.condition] = input.value; scheduleSave(); }));
}
async function analyzeCoverage() {
  const p = currentProject();
  const button = $('#analyzeBtn'); button.disabled = true; button.textContent = 'AI가 자료를 검토하고 있습니다…';
  try {
    const response = await fetch('/api/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({packet:makePacket()})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || `서버 오류 (${response.status})`);
    p.analysis = data.checks; p.analysis_model = data.model; persist(); renderCoverage(); renderSummary(); showToast('AI가 구성별 근거와 추가 질문을 정리했습니다. 결과를 확인해 주세요.');
  } catch (error) { showToast(error.message || '자료 점검에 실패했습니다. 서버 설정과 연결을 확인해 주세요.'); }
  finally { button.disabled = false; button.innerHTML = '자료 충분성 점검 <span>↗</span>'; }
}
function renderCoverage() {
  const p = currentProject(); const hasComponents = getComponents().length > 0;
  $('#coverageEmpty').hidden = Boolean(p.analysis?.length);
  $('#coverageResults').hidden = !p.analysis?.length;
  if (!p.analysis?.length) return;
  const good = p.analysis.filter((a) => a.level === 'good').length;
  $('#coverageResults').innerHTML = `<div class="coverage-summary">${p.analysis.length}개 구성 점검 · <b>${good}개 자료 근거 확인</b> · AI 점검은 참고용이며 기술적 충분성을 확정하지 않습니다.</div>${p.analysis.map((a, i) => `<div class="coverage-item"><div><div class="coverage-component">${String(i + 1).padStart(2, '0')} · ${escapeHTML(a.component)}</div><span class="coverage-status ${a.level}">${a.level === 'good' ? '자료 확인됨' : a.level === 'weak' ? '추가 확인 권장' : '자료 부족'}</span></div><div class="coverage-detail">${escapeHTML(a.message)}${a.evidence?.length ? `<br/><b>근거 자료:</b> ${a.evidence.map(escapeHTML).join(', ')}` : ''}${a.questions?.length ? `<ul class="question-list">${a.questions.map((q) => `<li>${escapeHTML(q)}</li>`).join('')}</ul>` : ''}</div></div>`).join('')}${p.analysis.some((a) => a.level !== 'good') ? `<div class="coverage-actions"><button class="button button-outline button-small" id="collectGapsBtn">부족한 항목 AI 추가 조사</button></div>` : ''}`;
  $('#collectGapsBtn')?.addEventListener('click', askToCollectGaps);
}
function askToCollectGaps() {
  const gaps = currentProject().analysis.filter((a) => a.level !== 'good');
  showConfirm('부족 자료를 추가 조사할까요?', `${gaps.map((g) => `• ${g.component}`).join('\n')}\n\nAI 웹 검색을 실행하고 출처 링크를 자료 목록에 추가합니다. API 사용량이 발생할 수 있습니다.`, 'AI 조사 실행', () => collectMaterials(gaps.flatMap((g) => g.questions || []).join('\n')));
}
function readiness() {
  const p = currentProject(); const comps = getComponents(); const checked = Boolean(p.analysis?.length);
  const points = (p.claims.trim() ? 30 : 0) + (p.materials.some((m) => m.kind === 'material') ? 25 : 0) + (checked ? 25 : 0) + (comps.length && comps.every((_, i) => p.conditions[i]?.trim()) ? 20 : (Object.values(p.conditions).some((x) => x?.trim()) ? 10 : 0));
  return Math.min(points, 100);
}
function renderSummary() {
  const p = currentProject(); const score = readiness();
  $('#scoreValue').textContent = score; $('#scoreRing').style.setProperty('--score', `${score}%`); $('#progressFill').style.width = `${score}%`;
  let label = '준비를 시작해 보세요'; let detail = '청구항과 자료를 입력하면<br/>작성 준비도를 확인할 수 있어요.';
  if (score >= 75) { label = '작성 준비가 잘 되었어요'; detail = '전달 전에 자료 출처와<br/>부족 항목을 한 번 더 확인하세요.'; }
  else if (score >= 30) { label = '준비가 진행 중이에요'; detail = '구성별 자료와 조건을<br/>보완하면 준비도가 올라갑니다.'; }
  $('#readinessLabel').textContent = label; $('#readinessText').innerHTML = detail;
  const entries = [ ['청구항 입력', Boolean(p.claims.trim())], ['기술자료 추가', p.materials.some((m) => m.kind === 'material')], ['구성별 자료 점검', Boolean(p.analysis?.length)], ['작성 조건 설정', Object.values(p.conditions).some((x) => x?.trim())] ];
  $('#checklist').innerHTML = entries.map(([label, done]) => `<div class="check-row ${done ? 'done' : ''}"><span class="check-mark">✓</span>${label}</div>`).join('');
}
function makePacket() {
  const p = currentProject();
  const components = getComponents();
  return {
    packet_schema_version: '1.0', created_at: new Date().toISOString(), project: { id:p.id, name:p.name, updated_at:p.updatedAt },
    module_versions: { preparation:PREPARATION_VERSION, drafting:'0.2.0', review:'0.3.0', contract:MODULE_CONTRACT },
    claims: { source:'user_provided', text:p.claims, changed_by_ai:false },
    materials: p.materials.map(({id,kind,title,body,source,sources,createdAt}) => ({id, type:kind === 'task' ? 'collection_request_draft' : 'technical_material', title, content:body, source:source || '', sources:sources || [], created_at:createdAt, external_collection_executed:Boolean(sources?.length)})),
    claim_components: components.map((name, index) => ({ id:`component-${index+1}`, name, user_conditions:p.conditions[index] || '', support_check:p.analysis?.[index] || null })),
    author_confirmations: [],
    drafting_constraints: { follow_master_prompt:true, preserve_claim_wording:true, distinguish_fact_inference_and_confirmation:true, do_not_invent_unprovided_facts_or_results:true, mark_missing_material_as:'[발명자 확인 필요]' },
    master_prompt: { developer_text_reference:'server_only', runtime_prompt_delivery:'server_side' }
  };
}
let saveTimer;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { persist(); renderSummary(); }, 350); }
function showConfirm(title, message, confirmText, onConfirm) {
  const dialog = $('#confirmDialog'); $('#dialogTitle').textContent = title; $('#dialogMessage').textContent = message;
  $('#dialogConfirm').textContent = confirmText; dialog.showModal();
  $('#dialogConfirm').onclick = (event) => { event.preventDefault(); dialog.close('confirm'); onConfirm(); };
}
function addMaterial() {
  const title = $('#materialTitle').value.trim(); const body = $('#materialBody').value.trim();
  if (!title || !body) { showToast('자료 제목과 내용을 모두 입력해 주세요.'); (!title ? $('#materialTitle') : $('#materialBody')).focus(); return; }
  currentProject().materials.push({ id:makeId(), kind:'material', title, body, source:'발명자 또는 자사 자료', createdAt:new Date().toISOString() }); currentProject().analysis = null;
  $('#materialTitle').value = ''; $('#materialBody').value = ''; persist(); render(); showToast('기술자료를 추가했습니다.');
}
async function collectMaterials(overrideInstruction = '') {
  const instruction = overrideInstruction || $('#aiInstruction').value.trim();
  if (!instruction) { showToast('AI에게 요청할 내용을 입력해 주세요.'); $('#aiInstruction').focus(); return; }
  const button = $('#addAiTaskBtn'); if (button) { button.disabled = true; button.textContent = '검색 중…'; }
  try {
    const response = await fetch('/api/research', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({instruction, packet:makePacket()})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || `서버 오류 (${response.status})`);
    currentProject().materials.push({id:makeId(), kind:'material', title:`AI 조사 · ${instruction.slice(0,48)}`, body:data.text, sources:data.sources || [], source:'OpenAI 웹 검색', createdAt:new Date().toISOString()});
    currentProject().analysis = null; $('#aiInstruction').value = ''; persist(); render(); showToast(`AI 조사 결과를 자료로 추가했습니다. 출처 ${data.sources?.length || 0}건`);
  } catch (error) { showToast(error.message || 'AI 조사에 실패했습니다. 서버 설정과 연결을 확인해 주세요.'); }
  finally { if (button) { button.disabled = false; button.innerHTML = '✦ AI 조사 실행'; } }
}
function addAiTask() {
  const body = $('#aiInstruction').value.trim();
  if (!body) { showToast('AI에게 요청할 내용을 입력해 주세요.'); $('#aiInstruction').focus(); return; }
  collectMaterials(body);
}
function createProject(name = '') {
  const projectName = name.trim() || `새 프로젝트 ${state.projects.length + 1}`;
  const p = { id:makeId(), name:projectName, claims:'', materials:[], conditions:{}, sourceNotes:'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), analysis:null };
  state.projects.unshift(p); state.activeProjectId = p.id; persist(); render(); $('#claimsInput').focus();
}
function downloadJSON(packet, filename) {
  const blob = new Blob([JSON.stringify(packet, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function safeFilename(name) { return (name || 'project').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g,'_'); }

$('#claimsInput').addEventListener('input', () => {
  const p = currentProject(); p.claims = $('#claimsInput').value; p.analysis = null; $('#claimCount').textContent = p.claims.length.toLocaleString('ko-KR');
  renderComponents(); renderConditions(); renderCoverage(); markEditing(); scheduleSave();
});
$('#parseClaimsBtn').addEventListener('click', () => { renderComponents(); renderConditions(); showToast(getComponents().length ? `${getComponents().length}개 구성 후보를 확인했습니다.` : '구성 후보를 찾지 못했습니다. 청구항을 입력해 주세요.'); });
$('#addMaterialBtn').addEventListener('click', addMaterial);
$('#addAiTaskBtn').addEventListener('click', addAiTask);
$('#analyzeBtn').addEventListener('click', () => {
  if (!currentProject().claims.trim()) { showToast('먼저 청구항을 입력해 주세요.'); $('#claimsInput').focus(); return; }
  if (!getComponents().length) { showToast('구성요소를 자동으로 찾지 못했습니다. 청구항 문장을 확인해 주세요.'); return; }
  analyzeCoverage();
});
$$('.segment').forEach((tab) => tab.addEventListener('click', () => {
  $$('.segment').forEach((item) => item.classList.toggle('active', item === tab));
  $('#manualPanel').hidden = tab.dataset.tab !== 'manual'; $('#aiPanel').hidden = tab.dataset.tab !== 'ai';
}));
$('#newProjectBtn').addEventListener('click', () => createProject(prompt('새 프로젝트 이름을 입력하세요') || ''));
$('#renameBtn').addEventListener('click', () => { const value = prompt('프로젝트 이름', currentProject().name); if (value?.trim()) { currentProject().name = value.trim(); persist(); render(); } });
$('#duplicateBtn').addEventListener('click', () => {
  const copy = structuredClone(currentProject()); copy.id = makeId(); copy.name = `${copy.name} 복사`; copy.createdAt = new Date().toISOString(); copy.updatedAt = copy.createdAt; state.projects.unshift(copy); state.activeProjectId = copy.id; persist(); render(); showToast('프로젝트를 복제했습니다.');
});
$('#exportBtn').addEventListener('click', () => downloadJSON({ export_schema_version:'1.0', workspace:state }, `특허프로젝트_백업_${safeFilename(currentProject().name)}.json`));
$('#handoffBtn').addEventListener('click', () => {
  const packet = makePacket(); localStorage.setItem(PACKET_KEY, JSON.stringify(packet)); downloadJSON(packet, `${safeFilename(currentProject().name)}_준비자료_v1.json`); showToast('준비자료 패킷을 만들고 JSON으로 내보냈습니다.');
});
$('#runModule2Btn').addEventListener('click', () => {
  if (!currentProject().claims.trim()) { showToast('2번 모듈을 시작하기 전에 청구항을 입력해 주세요.'); $('#claimsInput').focus(); return; }
  showConfirm('명세서 작성 모듈로 이동할까요?', '청구항 원문, 기술자료, 출처, 구성별 점검 결과와 작성 조건을 패킷으로 저장한 뒤 2번 모듈을 엽니다.', '전달하고 열기', () => {
    const packet = makePacket(); localStorage.setItem(PACKET_KEY, JSON.stringify(packet));
    location.href = './drafting.html';
  });
});
render();
