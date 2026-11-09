// st-card-creator · Duet panels for SillyTavern: a Library dock on the left, her Overview + Connection dock on the right.
// Reads only what SillyTavern already has (avatars, sprite packs, chat images, card data). Never invents art.
const MODULE = 'st-card-creator';
const ctx = () => SillyTavern.getContext();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const TALK_TITLES = ['Stranger', 'Acquaintance', 'Regular', 'Friend', 'Close friend', 'Bestie', 'Confidant', 'Partner in crime', 'Soulmate', 'Legend'];
const talksForLevel = (lv) => (lv <= 0 ? 0 : 5 * lv * (lv + 1));
function talkLevel(n) { let lv = 0; while (talksForLevel(lv + 1) <= n && lv < 60) lv += 1; const cur = talksForLevel(lv), next = talksForLevel(lv + 1); return { lv, pct: Math.max(0, Math.min(100, Math.round(((n - cur) / Math.max(1, next - cur)) * 100))), left: Math.max(0, next - n) }; }

function prefs() {
    const ext = ctx().extensionSettings; const s = (ext[MODULE] = ext[MODULE] || {}); const p = (s.panels = s.panels || {});
    if (p.left === undefined) p.left = false; if (p.right === undefined) p.right = false;
    p.leftW = p.leftW || 300; p.rightW = p.rightW || 340; p.zoom = p.zoom || 1; p.rightTab = p.rightTab || 'over';
    return p;
}
const save = () => ctx().saveSettingsDebounced?.();
const toast = (kind, msg) => window.toastr?.[kind]?.(msg, 'Duet panels');

function currentChar() { try { const c = ctx(); return c.characterId != null ? c.characters?.[c.characterId] || null : null; } catch { return null; } }
const folderOf = (avatar) => String(avatar || '').replace(/^.*[\\/]/, '').replace(/\.(png|webp|jpg|jpeg|gif)$/i, '').trim();
const avatarUrl = (avatar) => `/characters/${encodeURIComponent(avatar)}`;
const colorOf = (ch) => ch?.data?.extensions?.companion_stage?.color || ch?.data?.extensions?.color || '#ff7cbf';
const profOf = (ch) => ({ ...(ch?.data?.extensions?.companion_stage?.profile || {}) });

/* ---------------- docks ---------------- */
function dock(side) {
    let el = document.getElementById(`stcc-dock-${side}`);
    if (el) return el;
    el = document.createElement('aside'); el.id = `stcc-dock-${side}`; el.className = `stcc-dock stcc-dock-${side}`; el.hidden = true;
    el.innerHTML = `<div class="stcc-grip" title="Drag to resize · double-click to reset"></div><header class="stcc-dh"><b>${side === 'left' ? 'Library' : 'About'}</b><span class="stcc-dsub"></span><button type="button" class="stcc-x" title="Close">×</button></header><div class="stcc-db"></div>`;
    document.body.appendChild(el);
    el.querySelector('.stcc-x').addEventListener('click', () => toggle(side, false));
    const grip = el.querySelector('.stcc-grip');
    grip.addEventListener('pointerdown', (e) => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId); const p = prefs(); const start = e.clientX, w0 = side === 'left' ? p.leftW : p.rightW;
        const move = (ev) => { const d = ev.clientX - start; const w = Math.max(220, Math.min(window.innerWidth * 0.6, side === 'left' ? w0 + d : w0 - d)); if (side === 'left') p.leftW = w; else p.rightW = w; applySize(); };
        const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); save(); };
        grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', () => { const p = prefs(); if (side === 'left') p.leftW = 300; else p.rightW = 340; applySize(); save(); });
    // Ctrl+wheel scales only the dock's text
    el.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); const p = prefs(); p.zoom = Math.max(0.7, Math.min(1.8, +(p.zoom + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2))); applySize(); save(); }, { passive: false });
    return el;
}
function applySize() { const p = prefs(); const l = document.getElementById('stcc-dock-left'), r = document.getElementById('stcc-dock-right'); if (l) l.style.width = p.leftW + 'px'; if (r) r.style.width = p.rightW + 'px'; document.documentElement.style.setProperty('--stcc-z', String(p.zoom)); }
function toggle(side, on) {
    const p = prefs(); const cur = side === 'left' ? p.left : p.right; const v = on === undefined ? !cur : !!on;
    if (side === 'left') p.left = v; else p.right = v; save();
    const el = dock(side); el.hidden = !v; document.body.classList.toggle(`stcc-${side}-open`, v);
    document.querySelectorAll(`[data-stcc-dock="${side}"]`).forEach((b) => b.classList.toggle('active', v));
    if (v) render(side);
}

/* ---------------- top-bar buttons ---------------- */
function ensureButtons() {
    const bar = document.getElementById('top-settings-holder') || document.getElementById('top-bar');
    if (!bar || document.getElementById('stcc-dock-btns')) return;
    const box = document.createElement('div'); box.id = 'stcc-dock-btns'; box.className = 'stcc-dock-btns';
    box.innerHTML = `<button type="button" class="stcc-dockbtn" data-stcc-dock="left" title="Library: her pictures, sprites and chat images (drop files here to add a sprite)"><i class="fa-solid fa-images"></i></button><button type="button" class="stcc-dockbtn" data-stcc-dock="right" title="About her: overview, vitals, inner voice, connection"><i class="fa-solid fa-address-card"></i></button>`;
    bar.appendChild(box);
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-stcc-dock]'); if (b) toggle(b.getAttribute('data-stcc-dock')); });
}

/* ---------------- data ---------------- */
async function sprites(folder) {
    if (!folder) return [];
    try { const r = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j) ? j.map((s) => ({ label: s.label || s.name || '', path: s.path || s.files?.[0]?.path || '' })).filter((s) => s.path) : []; } catch { return []; }
}
function chatImages() { try { return (ctx().chat || []).map((m, i) => ({ i, m })).filter(({ m }) => m?.extra?.image).map(({ i, m }) => ({ i, url: m.extra.image, title: m.extra.title || `message ${i + 1}`, who: m.is_user ? 'you' : m.name || 'her' })); } catch { return []; } }
function connection() {
    const c = ctx(); const api = c.mainApi || c.main_api || window.main_api || '?';
    const oai = c.chatCompletionSettings || window.oai_settings || {}; const tg = c.textCompletionSettings || window.textgenerationwebui_settings || {};
    let model = oai.custom_model || oai.openai_model || oai.model || tg.model || tg.custom_model || ''; const src = oai.chat_completion_source || '';
    const url = oai.custom_url || tg.server_urls?.[tg.type] || '';
    let tok = 0, n = 0; try { for (const m of c.chat || []) { if (m?.extra?.token_count) { tok += +m.extra.token_count || 0; n += 1; } } } catch {}
    return { api, model, src, url, online: c.onlineStatus || window.online_status || '', tok, n, featherless: /featherless/i.test(url + ' ' + src) };
}
function lastMood() { const img = document.getElementById('expression-image'); const src = img?.getAttribute('src') || ''; const m = src.match(/\/([^/?.]+)\.(?:png|webp|gif)/i); return m ? m[1] : ''; }

/* ---------------- render: right dock ---------------- */
const VITALS = [['age', 'Age'], ['pronouns', 'Pronouns'], ['species', 'Species'], ['height', 'Height'], ['weight', 'Weight'], ['measurements', 'Measurements'], ['bust', 'Bust'], ['build', 'Build'], ['hair', 'Hair'], ['eyes', 'Eyes'], ['birthday', 'Birthday'], ['zodiac', 'Zodiac'], ['mbti', 'MBTI'], ['occupation', 'Work'], ['lives', 'Lives']];
const QUIRKS = [['quirks', 'Quirks'], ['habits', 'Habits'], ['speech', 'Speech'], ['likes', 'Likes'], ['dislikes', 'Dislikes'], ['softspot', 'Soft spot'], ['flaws', 'Flaws'], ['fears', 'Fears'], ['secret', 'Secret'], ['catchphrases', 'Catchphrases']];
function renderRight() {
    const el = dock('right'), body = el.querySelector('.stcc-db'), ch = currentChar(), p = prefs();
    if (!ch) { body.innerHTML = `<p class="stcc-empty">Pick a character and she shows up here.</p>`; return; }
    const d = ch.data || {}, cs = d.extensions?.companion_stage || {}, pr = profOf(ch), col = colorOf(ch), talks = (() => { let mine = 0, hers = 0; for (const m of ctx().chat || []) { if (!m || m.is_system) continue; if (m.is_user) mine++; else hers++; } return { mine, hers, total: mine + hers }; })();
    const Lv = talkLevel(talks.total), mood = lastMood(), heroSrc = document.getElementById('expression-image')?.getAttribute('src') || avatarUrl(ch.avatar);
    el.style.setProperty('--c', col); el.querySelector('.stcc-dsub').textContent = ch.name || '';
    const g = (k) => String(pr[k] ?? ch[k] ?? d[k] ?? '').trim();
    const rows = (list, cls) => list.map(([k, l]) => { const v = g(k); return v ? `<div class="${cls}"><span class="stcc-lbl">${l}</span>${cls === 'stcc-qk' ? `<p>${esc(v)}</p>` : `<b>${esc(v)}</b>`}</div>` : ''; }).join('');
    const inner = cs.inner || {}, lines = [inner.now, ...(String(inner.thoughts || '').split('\n')), ...(String(inner.sayings || '').split('\n')), ...((cs.talkLines || []).map(String))].map((x) => String(x || '').trim()).filter(Boolean);
    const conn = connection();
    const tabs = [['over', 'Overview'], ['sheet', 'Sheet'], ['inner', 'Inner voice'], ['conn', 'Connection']];
    body.innerHTML = `
      <div class="stcc-hero"><img src="${esc(heroSrc)}" alt=""><div class="stcc-cap"><span class="stcc-pfp" style="--c:${esc(col)}"><img src="${esc(avatarUrl(ch.avatar))}" alt="">${mood ? `<i title="${esc(mood)}">${esc(mood[0].toUpperCase())}</i>` : ''}</span><div><b>${esc(ch.name || '')}</b><small>${esc(clip(d.creator_notes && !/renamed/i.test(d.creator_notes) ? '' : '', 0))}${esc(clip(pr.archetype || d.personality || '', 80))}</small></div></div></div>
      <div class="stcc-talks" title="Talks: every line either of you says. Levels climb like a game."><div class="stcc-tl"><b>Lv ${Lv.lv}</b><span>${esc(TALK_TITLES[Math.min(Lv.lv, TALK_TITLES.length - 1)])}</span><small>${talks.total} talks · ${Lv.left} to next</small></div><i class="stcc-bar"><em style="width:${Lv.pct}%"></em></i></div>
      <nav class="stcc-rtabs">${tabs.map(([k, l]) => `<button type="button" data-stcc-rtab="${k}" class="${p.rightTab === k ? 'active' : ''}">${l}</button>`).join('')}</nav>
      <section class="stcc-rt" data-rt="over" ${p.rightTab === 'over' ? '' : 'hidden'}>
        ${pr.want || cs.want ? `<div class="stcc-wc"><span class="stcc-lbl">Wants</span><p>${esc(pr.want || cs.want)}</p></div>` : ''}${pr.cost || cs.cost ? `<div class="stcc-wc"><span class="stcc-lbl">Costs her</span><p>${esc(pr.cost || cs.cost)}</p></div>` : ''}
        ${d.description ? `<div class="stcc-wc"><span class="stcc-lbl">Description</span><p>${esc(clip(d.description, 700))}</p></div>` : ''}
        ${(d.tags || []).length ? `<div class="stcc-tags">${(d.tags || []).slice(0, 18).map((t) => `<i>${esc(t)}</i>`).join('')}</div>` : ''}
        <div class="stcc-nums"><div><span class="stcc-lbl">Lines</span><b>${talks.total}</b><small>${talks.mine} you · ${talks.hers} her</small></div><div><span class="stcc-lbl">Mood</span><b>${esc(mood || 'neutral')}</b></div><div><span class="stcc-lbl">Tokens seen</span><b>${conn.tok.toLocaleString()}</b><small>${conn.n} counted lines</small></div></div></section>
      <section class="stcc-rt" data-rt="sheet" ${p.rightTab === 'sheet' ? '' : 'hidden'}><h5>Vitals</h5><div class="stcc-vit">${rows(VITALS, 'stcc-vr') || '<p class="stcc-empty">No vitals on her card yet.</p>'}</div><h5>Quirks &amp; habits</h5><div class="stcc-qks">${rows(QUIRKS, 'stcc-qk') || '<p class="stcc-empty">Nothing noted yet.</p>'}</div></section>
      <section class="stcc-rt" data-rt="inner" ${p.rightTab === 'inner' ? '' : 'hidden'}>${lines.length ? `<ul class="stcc-inner">${lines.slice(0, 40).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="stcc-empty">No inner voice lines on her card. Duet Stage → Inner voice writes them.</p>'}</section>
      <section class="stcc-rt" data-rt="conn" ${p.rightTab === 'conn' ? '' : 'hidden'}><div class="stcc-nums"><div><span class="stcc-lbl">API</span><b>${esc(conn.api)}</b><small>${esc(conn.src || '')}</small></div><div><span class="stcc-lbl">Model</span><b>${esc(conn.model || '—')}</b></div><div><span class="stcc-lbl">Status</span><b>${esc(conn.online || '—')}</b></div><div><span class="stcc-lbl">Endpoint</span><b>${esc(clip(conn.url || (conn.featherless ? 'Featherless (managed)' : '—'), 40))}</b></div></div>
        <p class="stcc-note">${conn.featherless ? 'Featherless is wired in. Pick models at featherless.ai/models; Duet Stage can use the same key through its Connections panel.' : 'The model layer is whatever SillyTavern’s plug icon says. Featherless: Chat Completion → Custom (OpenAI-compatible), https://api.featherless.ai/v1.'}</p></section>`;
    body.querySelectorAll('[data-stcc-rtab]').forEach((b) => b.addEventListener('click', () => { p.rightTab = b.getAttribute('data-stcc-rtab'); save(); renderRight(); }));
}

/* ---------------- render: left dock (Library) ---------------- */
async function renderLeft() {
    const el = dock('left'), body = el.querySelector('.stcc-db'), ch = currentChar();
    el.querySelector('.stcc-dsub').textContent = ch ? ch.name : '';
    if (!ch) { body.innerHTML = `<p class="stcc-empty">Pick a character to see her pictures.</p>`; return; }
    const folder = folderOf(ch.avatar), sp = await sprites(folder), imgs = chatImages(), col = colorOf(ch); el.style.setProperty('--c', col);
    const tile = (src, label, sub, kind) => `<figure class="stcc-tile" data-src="${esc(src)}" data-kind="${kind}" tabindex="0" title="${esc(label)} · click to enlarge · right-click for more">${/\.(mp4|webm)(\?|$)/i.test(src) ? `<video src="${esc(src)}" muted loop playsinline autoplay></video>` : `<img src="${esc(src)}" alt="" loading="lazy">`}<figcaption><b>${esc(label)}</b><small>${esc(sub)}</small></figcaption></figure>`;
    body.innerHTML = `
      <div class="stcc-lhead"><span>${sp.length} sprite${sp.length === 1 ? '' : 's'} · ${imgs.length} chat image${imgs.length === 1 ? '' : 's'}</span><label class="stcc-up" title="Add a sprite: pick a file, name the emotion"><input type="file" accept="image/*" hidden><i class="fa-solid fa-plus"></i> Sprite</label></div>
      <div class="stcc-drop" data-folder="${esc(folder)}">Drop a picture here to add it as her sprite</div>
      <h5>Her face</h5><div class="stcc-grid">${tile(avatarUrl(ch.avatar), 'Avatar', 'card picture', 'avatar')}${sp.map((s) => tile(s.path, s.label, 'sprite', 'sprite')).join('')}</div>
      ${imgs.length ? `<h5>In the chat</h5><div class="stcc-grid">${imgs.map((x) => tile(x.url, x.title, x.who, 'chat')).join('')}</div>` : ''}`;
    const drop = body.querySelector('.stcc-drop');
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])].find((x) => /^image\//.test(x.type)); if (f) uploadSprite(folder, f); });
    body.querySelector('.stcc-up input').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) uploadSprite(folder, f); });
}
async function uploadSprite(folder, file) {
    const label = (window.prompt(`Which emotion is this? (neutral, joy, love, desire, amusement, curiosity, annoyance…)`, 'neutral') || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!label) return;
    try {
        const fd = new FormData(); fd.append('name', folder); fd.append('label', label); fd.append('avatar', file, file.name);
        const headers = { ...ctx().getRequestHeaders() }; delete headers['Content-Type'];
        const r = await fetch('/api/sprites/upload', { method: 'POST', headers, body: fd });
        if (!r.ok) throw new Error(`upload → ${r.status}`);
        toast('success', `${label} added to ${folder}'s sprites.`); renderLeft();
    } catch (e) { console.warn(`[${MODULE}] sprite upload`, e); toast('error', 'That upload didn’t take. Is Character Expressions on?'); }
}

/* ---------------- peek (hover/click enlarge, above the pointer) + right-click ---------------- */
function ensurePeek() {
    if (document.getElementById('stcc-peek')) return;
    const pk = document.createElement('div'); pk.id = 'stcc-peek'; pk.hidden = true; document.body.appendChild(pk);
    const place = (x, y) => { const w = pk.offsetWidth || 300, h = pk.offsetHeight || 300; let left = x - w / 2, top = y - h - 18; if (top < 8) { top = Math.min(window.innerHeight - h - 8, y + 26); left = x + 26; } pk.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, left)) + 'px'; pk.style.top = Math.max(8, top) + 'px'; };
    let t = 0;
    document.addEventListener('pointerover', (e) => { const f = e.target.closest?.('.stcc-tile'); if (!f || e.pointerType === 'touch') return; clearTimeout(t); t = setTimeout(() => { const src = f.dataset.src; pk.innerHTML = /\.(mp4|webm)(\?|$)/i.test(src) ? `<video src="${esc(src)}" autoplay muted loop playsinline></video>` : `<img src="${esc(src)}" alt="">`; pk.hidden = false; place(e.clientX, e.clientY); }, 350); });
    document.addEventListener('pointermove', (e) => { if (pk.hidden) return; if (!e.target.closest?.('.stcc-tile')) { pk.hidden = true; return; } place(e.clientX, e.clientY); });
    document.addEventListener('pointerdown', () => { clearTimeout(t); pk.hidden = true; }, true);
    document.addEventListener('contextmenu', (e) => {
        const f = e.target.closest?.('.stcc-tile'); if (!f) return; e.preventDefault();
        const src = f.dataset.src; let m = document.getElementById('stcc-ctx'); if (!m) { m = document.createElement('div'); m.id = 'stcc-ctx'; document.body.appendChild(m); document.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('#stcc-ctx')) m.hidden = true; }, true); }
        m.innerHTML = `<button data-a="send">Send it in the chat</button><button data-a="open">Open full size</button><button data-a="copy">Copy the link</button>`; m.hidden = false; m.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px'; m.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
        m.onclick = async (ev) => { const a = ev.target.closest('button')?.dataset.a; m.hidden = true; if (a === 'open') window.open(src, '_blank'); if (a === 'copy') { try { await navigator.clipboard.writeText(new URL(src, location.href).href); toast('success', 'Link copied.'); } catch {} } if (a === 'send') { const ta = document.getElementById('send_textarea'); if (ta) { ta.value = (ta.value ? ta.value + '\n' : '') + `![${f.querySelector('b')?.textContent || 'picture'}](${src})`; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); } } };
    });
}

/* ---------------- boot ---------------- */
let renderT = 0;
function render(side) { if (side === 'left' || !side) renderLeft(); if (side === 'right' || !side) renderRight(); }
function scheduleRender() { clearTimeout(renderT); renderT = setTimeout(() => { const p = prefs(); if (p.left) renderLeft(); if (p.right) renderRight(); }, 250); }
export function bootPanels() {
    try {
        const p = prefs(); ensureButtons(); ensurePeek(); applySize();
        if (p.left) toggle('left', true); if (p.right) toggle('right', true);
        const c = ctx(), es = c.eventSource, et = c.eventTypes || c.event_types;
        if (es && et) { ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_DELETED', 'GENERATION_ENDED', 'SETTINGS_UPDATED'].forEach((k) => { if (et[k]) es.on(et[k], scheduleRender); }); }
        new MutationObserver(() => ensureButtons()).observe(document.body, { childList: true });
        const img = document.getElementById('expression-image'); if (img) new MutationObserver(scheduleRender).observe(img, { attributes: true, attributeFilter: ['src'] });
        window.StCardCreatorPanels = { toggle, render };
    } catch (e) { console.warn(`[${MODULE}] panels`, e); }
}
