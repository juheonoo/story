const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];

const state = {
  date: new Date(),
  month: new Date(),
  room: localStorage.getItem('ow_room') || makeRoomCode(),
  photos: [],
  reaction: '❤️',
  theme: localStorage.getItem('ow_theme') || 'classic'
};

localStorage.setItem('ow_room', state.room);

function key() { return `ow_entries_${state.room}`; }
function dateKey(d = state.date) { return d.toISOString().slice(0, 10); }
function load() { return JSON.parse(localStorage.getItem(key()) || '{}'); }
function saveAll(data) { localStorage.setItem(key(), JSON.stringify(data)); }
function makeRoomCode() { return `ROOM-${Math.floor(1000 + Math.random() * 9000)}`; }
function formatDate(d) {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1200;
        let { width, height } = img;
        if (width > height && width > max) { height = Math.round(height * max / width); width = max; }
        if (height >= width && height > max) { width = Math.round(width * max / height); height = max; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function render() {
  document.body.dataset.theme = state.theme;
  $('#roomCodeText').textContent = state.room;
  $('#dateTitle').textContent = formatDate(state.date);
  $('#daySubtitle').textContent = dateKey(state.date) === dateKey(new Date()) ? '오늘의 추억을 저장하는 날' : '이 날의 추억 보기';
  $('#myName').value = localStorage.getItem('ow_name') || '';
  renderPreview();
  renderTimeline();
  renderCalendar();
  renderAlbum();
}

function renderPreview() {
  const grid = $('#previewGrid');
  grid.innerHTML = '';
  grid.classList.toggle('empty', state.photos.length === 0);
  state.photos.forEach((src, i) => {
    const el = document.createElement('div');
    el.className = 'photo';
    el.innerHTML = `<img src="${src}" alt="선택한 사진 ${i+1}"><button aria-label="삭제">×</button>`;
    el.querySelector('button').onclick = () => { state.photos.splice(i,1); renderPreview(); };
    grid.appendChild(el);
  });
}

function renderTimeline() {
  const data = load();
  const entries = data[dateKey()] || [];
  $('#entryCount').textContent = `${entries.length}개`;
  const box = $('#timeline');
  if (!entries.length) {
    box.innerHTML = `<div class="empty-msg">아직 기록 없음.<br>사진 한 장만 남겨도 나중에 은근 세다.</div>`;
    return;
  }
  box.innerHTML = entries.map((e, idx) => `
    <article class="entry">
      <div class="entry-top"><span class="name">${escapeHtml(e.name || '익명')}</span><span>${e.mood || '🙂'}</span></div>
      <div class="photo-grid ${e.photos?.length ? '' : 'empty'}">
        ${(e.photos || []).map(src => `<div class="photo"><img src="${src}" alt="기록 사진"></div>`).join('')}
      </div>
      ${e.menu ? `<p class="menu">🍽️ ${escapeHtml(e.menu)}</p>` : ''}
      ${e.memo ? `<p>${escapeHtml(e.memo)}</p>` : '<p>오늘의 기록 없음</p>'}
      <div class="reactions">
        ${['❤️','😂','🔥','😭'].map(r => `<button onclick="addReaction(${idx}, '${r}')">${r} ${e.reactions?.[r] || 0}</button>`).join('')}
      </div>
    </article>
  `).join('');
}

window.addReaction = (idx, r) => {
  const data = load();
  const dk = dateKey();
  data[dk][idx].reactions = data[dk][idx].reactions || {};
  data[dk][idx].reactions[r] = (data[dk][idx].reactions[r] || 0) + 1;
  saveAll(data);
  renderTimeline();
  renderAlbum();
};

function renderCalendar() {
  const d = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  $('#monthTitle').textContent = d.toLocaleDateString('ko-KR', { year:'numeric', month:'long' });
  const grid = $('#calendarGrid');
  grid.innerHTML = '';
  const data = load();
  const start = d.getDay();
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  for (let i=0; i<start; i++) grid.appendChild(dayBtn('', true));
  for (let day=1; day<=last; day++) {
    const cur = new Date(d.getFullYear(), d.getMonth(), day);
    const dk = dateKey(cur);
    const btn = dayBtn(day, false);
    btn.classList.toggle('has', !!data[dk]?.length);
    btn.classList.toggle('selected', dk === dateKey(state.date));
    btn.onclick = () => { state.date = cur; switchTab('today'); render(); };
    grid.appendChild(btn);
  }
}
function dayBtn(text, muted) {
  const b = document.createElement('button');
  b.className = `day ${muted ? 'muted' : ''}`;
  b.textContent = text;
  return b;
}

function renderAlbum() {
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();
  const data = load();
  const list = [];
  Object.entries(data).forEach(([day, entries]) => entries.forEach(e => list.push({day, ...e})));
  list.sort((a,b) => b.day.localeCompare(a.day));
  const filtered = list.filter(e => !q || `${e.day} ${e.name} ${e.memo || ''} ${e.menu || ''}`.toLowerCase().includes(q));
  const photoCount = list.reduce((n,e)=>n+(e.photos?.length||0),0);
  $('#totalStats').textContent = `${list.length}기록 · ${photoCount}사진`;
  $('#albumList').innerHTML = filtered.length ? filtered.map(e => `
    <div class="album-item">
      ${e.photos?.[0] ? `<img class="album-thumb" src="${e.photos[0]}" alt="대표 사진">` : `<div class="album-thumb"></div>`}
      <div><strong>${e.day} · ${escapeHtml(e.name || '익명')}</strong><p class="hint">${e.mood || ''} ${e.menu ? '🍽️ ' + escapeHtml(e.menu) + ' · ' : ''}${escapeHtml(e.memo || '오늘의 기록 없음')}</p></div>
    </div>
  `).join('') : `<div class="empty-msg">앨범에 아직 기록이 없음.</div>`;
}

function switchTab(id) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === id));
}
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$$('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
$('#prevDay').onclick = () => { state.date.setDate(state.date.getDate()-1); render(); };
$('#nextDay').onclick = () => { state.date.setDate(state.date.getDate()+1); render(); };
$('#prevMonth').onclick = () => { state.month.setMonth(state.month.getMonth()-1); renderCalendar(); };
$('#nextMonth').onclick = () => { state.month.setMonth(state.month.getMonth()+1); renderCalendar(); };
$('#newRoomBtn').onclick = () => { state.room = makeRoomCode(); localStorage.setItem('ow_room', state.room); render(); };
$('#joinRoomBtn').onclick = () => {
  const code = prompt('친구가 알려준 방 코드를 입력해줘. 예: ROOM-1234');
  if (!code) return;
  state.room = code.trim().toUpperCase();
  localStorage.setItem('ow_room', state.room);
  render();
};
$('#photoInput').onchange = async (e) => {
  const files = [...e.target.files].slice(0, 3 - state.photos.length);
  if (state.photos.length >= 3) return alert('하루 사진은 최대 3장까지만 가능함. 이게 앱 컨셉이다.');
  for (const file of files) state.photos.push(await resizeImage(file));
  e.target.value = '';
  renderPreview();
};
$('#memo').oninput = () => $('#countText').textContent = `${$('#memo').value.length}/200`;
$('#myName').oninput = () => localStorage.setItem('ow_name', $('#myName').value.trim());
$('#saveBtn').onclick = () => {
  const name = $('#myName').value.trim() || '나';
  const memo = $('#memo').value.trim();
  const menu = $('#menu').value.trim();
  if (state.photos.length === 0) return alert('사진은 최소 1장 이상 등록해야 저장됨. 추억앱인데 사진 없으면 개허전함.');
  const data = load();
  const dk = dateKey();
  data[dk] = data[dk] || [];
  const mineIdx = data[dk].findIndex(e => e.owner === 'me');
  const entry = { owner:'me', name, mood: $('#mood').value, menu, memo, photos:[...state.photos], reactions:{}, createdAt: Date.now() };
  if (mineIdx >= 0) data[dk][mineIdx] = entry; else data[dk].push(entry);
  saveAll(data);
  state.photos = [];
  $('#memo').value = '';
  $('#menu').value = '';
  $('#countText').textContent = '0/200';
  render();
};
$$('.emoji-row button').forEach(b => b.onclick = () => state.reaction = b.dataset.reaction);
$('#addFriendDemo').onclick = () => {
  const data = load(); const dk = dateKey(); data[dk] = data[dk] || [];
  data[dk].push({ owner:'friend', name: $('#friendName').value.trim() || '친구', mood: state.reaction, menu: $('#friendMenu').value.trim(), memo: $('#friendMemo').value.trim(), photos: demoPhotos(), reactions:{}, createdAt: Date.now() });
  saveAll(data); $('#friendMemo').value = ''; $('#friendMenu').value = ''; switchTab('today'); render();
};
function demoPhotos() {
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop stop-color='#d8b894'/><stop offset='1' stop-color='#8b6a4f'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><circle cx='420' cy='150' r='70' fill='#fff7'/><path d='M0 450 C160 320 290 520 600 330 L600 600 L0 600Z' fill='#fff8'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-size='42' fill='#fff' font-family='sans-serif'>친구 사진</text></svg>`);
  return [`data:image/svg+xml,${svg}`];
}
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${state.room}-backup.json`; a.click(); URL.revokeObjectURL(a.href);
};
$('#clearBtn').onclick = () => { if(confirm('현재 방 기록을 전부 삭제할까?')) { localStorage.removeItem(key()); render(); } };
$('#themeBtn').onclick = () => $('#themePanel').classList.toggle('hidden');
$$('.theme-chip').forEach(btn => btn.onclick = () => {
  state.theme = btn.dataset.theme;
  localStorage.setItem('ow_theme', state.theme);
  applyTheme();
});
function applyTheme() {
  document.body.dataset.theme = state.theme;
  $$('.theme-chip').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === state.theme));
}
$('#searchInput').oninput = renderAlbum;
applyTheme();
render();
