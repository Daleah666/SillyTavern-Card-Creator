// st-card-creator · Duet panels for SillyTavern: the Duet rail on the left (characters, chats, forks, latest pictures,
// library) and her About dock on the right (hero, ticker, talks, overview, full sheet, reel + idle playlist, story &
// memories, inner voice, subliminals, connection, settings), plus 💗 Right now (heart.js): the relationship bars and her mood. Reads only what SillyTavern already has. Never invents art.
import { heartRender, heartBoot } from './heart.js';
const MODULE = 'st-card-creator';
const ctx = () => SillyTavern.getContext();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const ago = (t) => { const d = (Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 1000; if (!isFinite(d)) return ''; return d < 60 ? 'just now' : d < 3600 ? Math.round(d / 60) + ' min ago' : d < 86400 ? Math.round(d / 3600) + ' h ago' : Math.round(d / 86400) + ' d ago'; };
const TALK_TITLES = ['Stranger', 'Acquaintance', 'Regular', 'Friend', 'Close friend', 'Bestie', 'Confidant', 'Partner in crime', 'Soulmate', 'Legend'];
const talksForLevel = (lv) => (lv <= 0 ? 0 : 5 * lv * (lv + 1));
function talkLevel(n) { let lv = 0; while (talksForLevel(lv + 1) <= n && lv < 60) lv += 1; const cur = talksForLevel(lv), next = talksForLevel(lv + 1); return { lv, pct: Math.max(0, Math.min(100, Math.round(((n - cur) / Math.max(1, next - cur)) * 100))), left: Math.max(0, next - n) }; }
const MOODS = ['neutral', 'joy', 'love', 'desire', 'amusement', 'curiosity', 'excitement', 'pride', 'approval', 'caring', 'relief', 'optimism', 'realization', 'surprise', 'confusion', 'nervousness', 'embarrassment', 'annoyance', 'anger', 'sadness', 'fear', 'disgust'];

function prefs() {
    const ext = ctx().extensionSettings; const s = (ext[MODULE] = ext[MODULE] || {}); const p = (s.panels = s.panels || {});
    if (p.left === undefined) p.left = false; if (p.right === undefined) p.right = false;
    p.leftW = p.leftW || 300; p.rightW = p.rightW || 360; p.zoom = p.zoom || 1; p.rightTab = p.rightTab || 'over'; p.leftTab = p.leftTab || 'rail';
    if (p.peek === undefined) p.peek = true; if (p.idle === undefined) p.idle = false; p.idleEvery = p.idleEvery || 12; p.idleLabels = p.idleLabels || '';
    p.subl = p.subl || { on: false, phrases: '', everyS: 6, flashMs: 70, alpha: 0.32, where: 'chat' };
    p.sec = p.sec || {};
    return p;
}
const save = () => ctx().saveSettingsDebounced?.();
const toast = (kind, msg) => window.toastr?.[kind]?.(msg, 'Duet panels');
function currentChar() { try { const c = ctx(); return c.characterId != null ? c.characters?.[c.characterId] || null : null; } catch { return null; } }
const folderOf = (avatar) => String(avatar || '').replace(/^.*[\\/]/, '').replace(/\.(png|webp|jpg|jpeg|gif)$/i, '').trim();
const avatarUrl = (avatar) => `/characters/${encodeURIComponent(avatar)}`;
const colorOf = (ch) => ch?.data?.extensions?.companion_stage?.color || '#ff7cbf';
const profOf = (ch) => ({ ...(ch?.data?.extensions?.companion_stage?.profile || {}) });
const csOf = (ch) => ch?.data?.extensions?.companion_stage || {};
async function slash(cmd) { try { const c = ctx(); if (typeof c.executeSlashCommandsWithOptions === 'function') return await c.executeSlashCommandsWithOptions(cmd, { handleParserErrors: true, handleExecutionErrors: true }); if (typeof c.executeSlashCommands === 'function') return await c.executeSlashCommands(cmd); } catch (e) { console.warn(`[${MODULE}] slash`, cmd, e); } return null; }
async function postJson(path, body) { const r = await fetch(path, { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify(body || {}) }); if (!r.ok) throw new Error(`${path} → ${r.status}`); return r.json(); }

/* ---------------- docks ---------------- */
function dock(side) {
    let el = document.getElementById(`stcc-dock-${side}`);
    if (el) return el;
    el = document.createElement('aside'); el.id = `stcc-dock-${side}`; el.className = `stcc-dock stcc-dock-${side}`; el.hidden = true;
    el.innerHTML = `<div class="stcc-grip" title="Drag to resize · double-click to reset"></div><header class="stcc-dh"><b>${side === 'left' ? 'Duet' : 'About'}</b><span class="stcc-dsub"></span><button type="button" class="stcc-x" title="Close">×</button></header><div class="stcc-db"></div>`;
    document.body.appendChild(el);
    el.querySelector('.stcc-x').addEventListener('click', () => toggle(side, false));
    const grip = el.querySelector('.stcc-grip');
    grip.addEventListener('pointerdown', (e) => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId); const p = prefs(); const start = e.clientX, w0 = side === 'left' ? p.leftW : p.rightW;
        const move = (ev) => { const d = ev.clientX - start; const w = Math.max(220, Math.min(window.innerWidth * 0.6, side === 'left' ? w0 + d : w0 - d)); if (side === 'left') p.leftW = w; else p.rightW = w; applySize(); };
        const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); save(); };
        grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', () => { const p = prefs(); if (side === 'left') p.leftW = 300; else p.rightW = 360; applySize(); save(); });
    el.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); const p = prefs(); p.zoom = Math.max(0.7, Math.min(1.8, +(p.zoom + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2))); applySize(); save(); }, { passive: false });
    el.addEventListener('click', onDockClick); el.addEventListener('change', onDockChange);
    return el;
}
function applySize() { const p = prefs(); const l = document.getElementById('stcc-dock-left'), r = document.getElementById('stcc-dock-right'); if (l) l.style.width = p.leftW + 'px'; if (r) r.style.width = p.rightW + 'px'; document.documentElement.style.setProperty('--stcc-z', String(p.zoom)); }
function toggle(side, on) {
    const p = prefs(); const cur = side === 'left' ? p.left : p.right; const v = on === undefined ? !cur : !!on;
    if (side === 'left') p.left = v; else p.right = v;
    if (v && innerWidth <= 820) { const o = side === 'left' ? 'right' : 'left'; if (p[o]) { p[o] = false; const od = document.getElementById(`stcc-dock-${o}`); if (od) od.hidden = true; document.body.classList.remove(`stcc-${o}-open`); } }   // 0.3.3: one dock at a time on a phone
    save();
    const el = dock(side); el.hidden = !v; document.body.classList.toggle(`stcc-${side}-open`, v);
    document.querySelectorAll(`[data-stcc-dock="${side}"]`).forEach((b) => b.classList.toggle('active', v));
    if (v) render(side);
}
function ensureButtons() {
    const bar = document.getElementById('top-settings-holder') || document.getElementById('top-bar');
    if (!bar || document.getElementById('stcc-dock-btns')) return;
    const box = document.createElement('div'); box.id = 'stcc-dock-btns'; box.className = 'stcc-dock-btns';
    box.innerHTML = `<button type="button" class="stcc-dockbtn" data-stcc-dock="left" title="Duet rail: characters, chats, forks, latest pictures, library"><i class="fa-solid fa-table-columns"></i></button><button type="button" class="stcc-dockbtn" data-stcc-dock="right" title="About her: overview, sheet, reel, story, inner voice, subliminals, connection, settings"><i class="fa-solid fa-address-card"></i></button>`;
    bar.appendChild(box);
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-stcc-dock]'); if (b) toggle(b.getAttribute('data-stcc-dock')); });
}

/* ---------------- data ---------------- */
const SP = { folder: '', list: [], t: 0 };
async function sprites(folder) {
    if (!folder) return [];
    if (SP.folder === folder && Date.now() - SP.t < 20000) return SP.list;
    try { const r = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`); const j = r.ok ? await r.json() : []; SP.list = Array.isArray(j) ? j.map((s) => ({ label: s.label || s.name || '', path: s.path || s.files?.[0]?.path || '' })).filter((s) => s.path) : []; } catch { SP.list = []; }
    SP.folder = folder; SP.t = Date.now(); return SP.list;
}
function chatImages() { try { return (ctx().chat || []).map((m, i) => ({ i, m })).filter(({ m }) => m?.extra?.image).map(({ i, m }) => ({ i, url: m.extra.image, title: m.extra.title || `message ${i + 1}`, who: m.is_user ? 'you' : m.name || 'her' })); } catch { return []; } }
function talks() { let mine = 0, hers = 0; for (const m of ctx().chat || []) { if (!m || m.is_system) continue; if (m.is_user) mine++; else hers++; } return { mine, hers, total: mine + hers }; }
function connection() {
    const c = ctx(); const api = c.mainApi || c.main_api || window.main_api || '?';
    const oai = c.chatCompletionSettings || window.oai_settings || {}; const tg = c.textCompletionSettings || window.textgenerationwebui_settings || {};
    const model = oai.custom_model || oai.openai_model || oai.model || tg.model || tg.custom_model || ''; const src = oai.chat_completion_source || '';
    const url = oai.custom_url || tg.server_urls?.[tg.type] || '';
    let tok = 0, n = 0; try { for (const m of c.chat || []) { if (m?.extra?.token_count) { tok += +m.extra.token_count || 0; n += 1; } } } catch {}
    return { api, model, src, url, online: c.onlineStatus || window.online_status || '', tok, n, featherless: /featherless/i.test(url + ' ' + src) };
}
function lastMood() { const img = document.getElementById('expression-image'); const src = img?.getAttribute('src') || ''; const m = src.match(/\/([^/?.]+)\.(?:png|webp|gif)/i); return m ? decodeURIComponent(m[1]) : ''; }
const CHATS = { avatar: '', list: [], t: 0 };
async function chatsOf(ch) {
    if (!ch) return [];
    if (CHATS.avatar === ch.avatar && Date.now() - CHATS.t < 15000) return CHATS.list;
    try { const j = await postJson('/api/characters/chats', { avatar_url: ch.avatar, simple: false }); const arr = Array.isArray(j) ? j : Object.values(j || {}); CHATS.list = arr.filter((x) => x && x.file_name).map((x) => ({ file: String(x.file_name).replace(/\.jsonl$/i, ''), n: +x.chat_items || 0, last: x.last_mes || '', mes: x.mes || '' })).sort((a, b) => String(b.last).localeCompare(String(a.last))); } catch (e) { console.warn(`[${MODULE}] chats`, e); CHATS.list = []; }
    CHATS.avatar = ch.avatar; CHATS.t = Date.now(); return CHATS.list;
}
const ACT = []; let actLines = -1;
function act(k, text) { ACT.unshift({ t: Date.now(), k, text: String(text || '').replace(/\s+/g, ' ').slice(0, 120) }); ACT.length = Math.min(ACT.length, 30); }
function actSync() { const chat = ctx().chat || []; const n = chat.length; if (actLines >= 0 && n > actLines && n - actLines <= 3) { chat.slice(actLines).forEach((m) => { if (!m || m.is_system) return; act(m.is_user ? 'you' : 'her', `${m.is_user ? (ctx().name1 || 'You') : (m.name || 'her')}: ${clip(String(m.mes || '').replace(/\*+/g, ''), 80)}`); }); } actLines = n; }

/* ---------------- right dock ---------------- */
const VITALS = [['age', 'Age'], ['pronouns', 'Pronouns'], ['species', 'Species'], ['height', 'Height'], ['weight', 'Weight'], ['measurements', 'Measurements'], ['bust', 'Bust'], ['waist', 'Waist'], ['hips', 'Hips'], ['build', 'Build'], ['hair', 'Hair'], ['eyes', 'Eyes'], ['birthday', 'Birthday'], ['zodiac', 'Zodiac'], ['mbti', 'MBTI'], ['iq_word', 'Mind'], ['occupation', 'Work'], ['lives', 'Lives'], ['looks', 'Looks']];
const QUIRKS = [['quirks', 'Quirks'], ['habits', 'Habits'], ['speech', 'Speech'], ['likes', 'Likes'], ['dislikes', 'Dislikes'], ['softspot', 'Soft spot'], ['flaws', 'Flaws'], ['fears', 'Fears'], ['secret', 'Secret'], ['strength', 'Strength'], ['catchphrases', 'Catchphrases'], ['petname', 'Pet names'], ['flirting', 'Flirting'], ['arguing', 'Arguing'], ['backstory', 'Backstory']];
const RTABS = [['over', 'Overview'], ['now', '💗 Right now'], ['sheet', 'Sheet'], ['reel', 'Reel'], ['story', 'Story'], ['inner', 'Inner voice'], ['subl', 'Subliminals'], ['conn', 'Connection'], ['set', 'Settings']];
async function renderRight() {
    const el = dock('right'), body = el.querySelector('.stcc-db'), ch = currentChar(), p = prefs();
    if (!ch) { body.innerHTML = `<p class="stcc-empty">Pick a character and she shows up here.</p>`; return; }
    const d = ch.data || {}, cs = csOf(ch), pr = profOf(ch), col = colorOf(ch), T = talks(), Lv = talkLevel(T.total), mood = lastMood(), conn = connection();
    const heroSrc = document.getElementById('expression-image')?.getAttribute('src') || avatarUrl(ch.avatar);
    el.style.setProperty('--c', col); el.querySelector('.stcc-dsub').textContent = ch.name || '';
    const g = (k) => String(pr[k] ?? cs[k] ?? ch[k] ?? d[k] ?? '').trim();
    const rows = (list, cls) => list.map(([k, l]) => { const v = g(k); return v ? `<div class="${cls}"><span class="stcc-lbl">${l}</span>${cls === 'stcc-qk' ? `<p>${esc(v)}</p>` : `<b>${esc(v)}</b>`}</div>` : ''; }).join('');
    const inner = cs.inner || {}, lines = [inner.now, ...String(inner.thoughts || '').split('\n'), ...String(inner.sayings || '').split('\n'), ...(cs.talkLines || []).map(String)].map((x) => String(x || '').trim()).filter(Boolean);
    actSync();
    const sp = p.rightTab === 'reel' || p.idle ? await sprites(folderOf(ch.avatar)) : [];
    const meta = ctx().chatMetadata || window.chat_metadata || {}; const note = meta.note_prompt || meta.author_note || ''; const summary = meta.summary || meta.summary_text || (meta.extensions && (meta.extensions.summary || meta.extensions.memory)) || '';
    const tick = ACT.length ? ACT.slice(0, 8).map((a) => `<i class="${a.k}">${esc(a.text)}</i>`).join('') : `<i>Quiet. Say something to ${esc(ch.name)}.</i>`;
    const s = p.subl;
    body.innerHTML = `
      <div class="stcc-tick" title="What just happened"><div class="stcc-ttrack${ACT.length > 1 ? ' roll' : ''}">${tick}${ACT.length > 1 ? tick : ''}</div><span class="stcc-tn"><b>${T.total}<small>lines</small></b><b>${conn.tok >= 1000 ? (conn.tok / 1000).toFixed(1) + 'k' : conn.tok}<small>tok</small></b></span></div>
      <div class="stcc-hero"><img src="${esc(heroSrc)}" alt=""><div class="stcc-cap"><span class="stcc-pfp" style="--c:${esc(col)}"><img src="${esc(avatarUrl(ch.avatar))}" alt="">${mood ? `<i title="${esc(mood)}">${esc(mood[0].toUpperCase())}</i>` : ''}</span><div><b>${esc(ch.name || '')}</b><small>${esc(clip(pr.archetype || d.personality || '', 80))}</small></div></div></div>
      <div class="stcc-talks" title="Talks: every line either of you says. Levels climb like a game."><div class="stcc-tl"><b>Lv ${Lv.lv}</b><span>${esc(TALK_TITLES[Math.min(Lv.lv, TALK_TITLES.length - 1)])}</span><small>${T.total} talks · ${Lv.left} to next</small></div><i class="stcc-bar"><em style="width:${Lv.pct}%"></em></i></div>
      <nav class="stcc-rtabs">${RTABS.map(([k, l]) => `<button type="button" data-stcc-rtab="${k}" class="${p.rightTab === k ? 'active' : ''}">${l}</button>`).join('')}</nav>
      <section class="stcc-rt" data-rt="over" ${p.rightTab === 'over' ? '' : 'hidden'}>
        ${g('want') ? `<div class="stcc-wc"><span class="stcc-lbl">Wants</span><p>${esc(g('want'))}</p></div>` : ''}${g('cost') ? `<div class="stcc-wc"><span class="stcc-lbl">Costs her</span><p>${esc(g('cost'))}</p></div>` : ''}
        ${d.description ? `<div class="stcc-wc"><span class="stcc-lbl">Description</span><p>${esc(clip(d.description, 700))}</p></div>` : ''}
        ${(d.tags || []).length ? `<div class="stcc-tags">${(d.tags || []).slice(0, 18).map((t) => `<i>${esc(t)}</i>`).join('')}</div>` : ''}
        <div class="stcc-nums"><div><span class="stcc-lbl">Lines</span><b>${T.total}</b><small>${T.mine} you · ${T.hers} her</small></div><div><span class="stcc-lbl">Mood</span><b>${esc(mood || 'neutral')}</b></div><div><span class="stcc-lbl">Tokens seen</span><b>${conn.tok.toLocaleString()}</b><small>${conn.n} counted lines</small></div><div><span class="stcc-lbl">Sprites</span><b>${SP.folder === folderOf(ch.avatar) ? SP.list.length : '…'}</b></div></div></section>
      <section class="stcc-rt" data-rt="now" ${p.rightTab === 'now' ? '' : 'hidden'}><div id="stcc-now"></div></section>
      <section class="stcc-rt" data-rt="sheet" ${p.rightTab === 'sheet' ? '' : 'hidden'}><h5>Vitals</h5><div class="stcc-vit">${rows(VITALS, 'stcc-vr') || '<p class="stcc-empty">No vitals on her card yet.</p>'}</div><h5>Quirks &amp; habits</h5><div class="stcc-qks">${rows(QUIRKS, 'stcc-qk') || '<p class="stcc-empty">Nothing noted yet.</p>'}</div>${d.scenario ? `<h5>Scenario</h5><p class="stcc-note">${esc(clip(d.scenario, 600))}</p>` : ''}</section>
      <section class="stcc-rt" data-rt="reel" ${p.rightTab === 'reel' ? '' : 'hidden'}><div class="stcc-lhead"><span>${sp.length} sprite${sp.length === 1 ? '' : 's'} · click one and she wears it</span></div>
        <div class="stcc-strip">${sp.map((x) => `<figure class="stcc-tile sm" data-src="${esc(x.path)}" data-emote="${esc(x.label)}" title="${esc(x.label)} · click: she wears it · right-click for more">${/\.(mp4|webm)(\?|$)/i.test(x.path) ? `<video src="${esc(x.path)}" muted loop playsinline autoplay></video>` : `<img src="${esc(x.path)}" alt="" loading="lazy">`}<figcaption><b>${esc(x.label)}</b></figcaption></figure>`).join('') || '<p class="stcc-empty">No sprite pack yet. Add one from the Library (drop a picture).</p>'}</div>
        <h5>Idle playlist</h5><label class="stcc-tg"><input type="checkbox" data-stcc-set="idle" ${p.idle ? 'checked' : ''}><span>Rotate her sprites while nobody is talking</span></label>
        <div class="stcc-row"><label>Every <select data-stcc-set="idleEvery">${[6, 12, 20, 45].map((v) => `<option value="${v}" ${+p.idleEvery === v ? 'selected' : ''}>${v} s</option>`).join('')}</select></label><label class="stcc-grow">Only these <input data-stcc-set="idleLabels" value="${esc(p.idleLabels)}" placeholder="neutral, joy, love (empty = all)"></label></div></section>
      <section class="stcc-rt" data-rt="story" ${p.rightTab === 'story' ? '' : 'hidden'}><h5>Story so far</h5>${summary ? `<p class="stcc-note">${esc(clip(String(summary), 900))}</p>` : `<p class="stcc-empty">No summary yet. The Summarize extension writes one; or jot it in the Author's Note.</p>`}
        <h5>Author's note</h5>${note ? `<p class="stcc-note">${esc(clip(String(note), 600))}</p>` : '<p class="stcc-empty">Empty.</p>'}
        <h5>Memories</h5>${(cs.memories || []).length ? `<ul class="stcc-inner">${cs.memories.slice(0, 12).map((m) => `<li>${esc(clip(m.text || m.about || m, 140))}</li>`).join('')}</ul>` : '<p class="stcc-empty">Duet Stage keeps her memories; its Memory tab exports them onto the card.</p>'}
        <div class="stcc-row"><button type="button" data-stcc-act="summarize" title="Ask the Summarize extension for a fresh summary (/summarize)">Update the summary</button><button type="button" data-stcc-act="branch" title="Fork this chat from here (/branch)">⑂ Fork from here</button></div></section>
      <section class="stcc-rt" data-rt="inner" ${p.rightTab === 'inner' ? '' : 'hidden'}>${lines.length ? `<ul class="stcc-inner">${lines.slice(0, 40).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="stcc-empty">No inner voice lines on her card. Duet Stage → Inner voice writes them.</p>'}</section>
      <section class="stcc-rt" data-rt="subl" ${p.rightTab === 'subl' ? '' : 'hidden'}><label class="stcc-tg"><input type="checkbox" data-stcc-subl="on" ${s.on ? 'checked' : ''}><span><b>Subliminals on</b> (flashes over the chat; Esc stops them)</span></label>
        <label class="stcc-fld"><span>Your lines <small>one per line, first person, present tense</small></span><textarea rows="5" data-stcc-subl="phrases" placeholder="I am calm.\nI like who I am.">${esc(s.phrases)}</textarea></label>
        <div class="stcc-row"><label>Where <select data-stcc-subl="where"><option value="chat" ${s.where === 'chat' ? 'selected' : ''}>Over the chat</option><option value="all" ${s.where === 'all' ? 'selected' : ''}>Over everything</option></select></label><label>Each <select data-stcc-subl="flashMs">${[30, 70, 120, 400, 1800].map((v) => `<option value="${v}" ${+s.flashMs === v ? 'selected' : ''}>${v >= 1000 ? (v / 1000) + ' s fade' : v + ' ms'}</option>`).join('')}</select></label><label>Every <select data-stcc-subl="everyS">${[3, 6, 10, 20].map((v) => `<option value="${v}" ${+s.everyS === v ? 'selected' : ''}>${v} s</option>`).join('')}</select></label><label>Strength <select data-stcc-subl="alpha">${[['0.15', 'Ghost'], ['0.32', 'Faint'], ['0.55', 'Visible']].map(([v, l]) => `<option value="${v}" ${String(s.alpha) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <p class="stcc-note">Never faster than one flash every 2 seconds. Slow fade is the strongest setting; the research on unread flashes is thin.</p></section>
      <section class="stcc-rt" data-rt="conn" ${p.rightTab === 'conn' ? '' : 'hidden'}><div class="stcc-nums"><div><span class="stcc-lbl">API</span><b>${esc(conn.api)}</b><small>${esc(conn.src || '')}</small></div><div><span class="stcc-lbl">Model</span><b>${esc(conn.model || '—')}</b></div><div><span class="stcc-lbl">Status</span><b>${esc(conn.online || '—')}</b></div><div><span class="stcc-lbl">Endpoint</span><b>${esc(clip(conn.url || (conn.featherless ? 'Featherless (managed)' : '—'), 40))}</b></div><div><span class="stcc-lbl">Tokens in chat</span><b>${conn.tok.toLocaleString()}</b></div></div>
        <p class="stcc-note">${conn.featherless ? 'Featherless is wired in. Pick models at featherless.ai/models; Duet Stage can use the same key through its Connections panel.' : 'The model layer is whatever SillyTavern’s plug icon says. Featherless: Chat Completion → Custom (OpenAI-compatible), https://api.featherless.ai/v1.'}</p></section>
      <section class="stcc-rt" data-rt="set" ${p.rightTab === 'set' ? '' : 'hidden'}><label class="stcc-tg"><input type="checkbox" data-stcc-set="peek" ${p.peek ? 'checked' : ''}><span>Enlarge pictures on hover (above the pointer)</span></label>
        <div class="stcc-row"><button type="button" data-stcc-act="reset-w">Reset dock widths</button><button type="button" data-stcc-act="reset-z">Reset text size</button></div>
        <p class="stcc-note">Drag a dock's inner edge to resize it. Ctrl+wheel over a dock scales only its text. st-card-creator ${window.StCardCreator?.version || ''}.</p></section>`;
    if (p.rightTab === 'now') heartRender();
}

/* ---------------- left dock: the Duet rail ---------------- */
const LTABS = [['rail', 'Rail'], ['lib', 'Library']];
async function renderLeft() {
    const el = dock('left'), body = el.querySelector('.stcc-db'), ch = currentChar(), p = prefs(), c = ctx();
    el.querySelector('.stcc-dsub').textContent = ch ? ch.name : '';
    const col = ch ? colorOf(ch) : '#ff7cbf'; el.style.setProperty('--c', col);
    const chars = (c.characters || []).map((x, i) => ({ x, i })).filter(({ x }) => x && x.avatar);
    const open = (k, d = true) => p.sec[k] === undefined ? d : !!p.sec[k];
    const sec = (k, label, count, inner) => `<div class="stcc-sec"><button type="button" class="stcc-sech" data-stcc-sec="${k}" aria-expanded="${open(k)}"><i class="dot"></i>${label}${count != null ? `<small>${count}</small>` : ''}<i class="chev">${open(k) ? '▾' : '▸'}</i></button>${open(k) ? inner : ''}</div>`;
    const tile = (src, label, sub, kind, extra = '') => `<figure class="stcc-tile" data-src="${esc(src)}" data-kind="${kind}" ${extra} tabindex="0" title="${esc(label)} · click to enlarge · right-click for more">${/\.(mp4|webm)(\?|$)/i.test(src) ? `<video src="${esc(src)}" muted loop playsinline autoplay></video>` : `<img src="${esc(src)}" alt="" loading="lazy">`}<figcaption><b>${esc(label)}</b><small>${esc(sub)}</small></figcaption></figure>`;
    let html = `<nav class="stcc-rtabs">${LTABS.map(([k, l]) => `<button type="button" data-stcc-ltab="${k}" class="${p.leftTab === k ? 'active' : ''}">${l}</button>`).join('')}</nav>`;
    if (p.leftTab === 'rail') {
        const chats = ch ? await chatsOf(ch) : [];
        const curFile = String(c.chatId || c.chat_id || window.chat_metadata?.file_name || '').replace(/\.jsonl$/i, '');
        const imgs = chatImages(); const sp = ch ? await sprites(folderOf(ch.avatar)) : [];
        html += sec('chars', 'Characters', chars.length, `<div class="stcc-list">${chars.map(({ x, i }) => `<button type="button" class="stcc-item ${ch && x.avatar === ch.avatar ? 'on' : ''}" data-stcc-char="${i}" style="--c:${esc(colorOf(x))}"><img src="${esc(avatarUrl(x.avatar))}" alt=""><span><b>${esc(x.name)}</b><small>${esc(clip(profOf(x).archetype || x.data?.personality || x.data?.creator_notes || '', 48))}</small></span>${ch && x.avatar === ch.avatar ? '<i>TALKING</i>' : ''}</button>`).join('')}</div>`);
        if (ch) html += sec('chats', `Chats with ${esc(ch.name)}`, chats.length, `<div class="stcc-list">${chats.length ? chats.slice(0, 30).map((t) => `<button type="button" class="stcc-item ${t.file === curFile ? 'on' : ''}" data-stcc-chat="${esc(t.file)}"><span><b>${esc(t.file)}</b><small>${t.n} lines${t.last ? ' · ' + esc(ago(t.last)) : ''}${t.mes ? ' · ' + esc(clip(String(t.mes).replace(/\*+/g, ''), 60)) : ''}</small></span></button>`).join('') : '<p class="stcc-empty">No saved chats yet.</p>'}<div class="stcc-row"><button type="button" data-stcc-act="newchat">+ New chat</button><button type="button" data-stcc-act="branch">⑂ Fork from here</button></div></div>`);
        const latest = [...imgs.map((x) => ({ src: x.url, label: x.title, sub: x.who })), ...sp.slice(0, 8).map((x) => ({ src: x.path, label: x.label, sub: 'sprite' }))].slice(0, 12);
        html += sec('pics', 'Latest pictures', latest.length, `<div class="stcc-strip">${latest.map((x) => tile(x.src, x.label, x.sub, 'pic')).join('') || '<p class="stcc-empty">Nothing yet.</p>'}</div>`);
        html += `<div class="stcc-me"><img src="${esc(c.userAvatar ? `/User Avatars/${encodeURIComponent(c.userAvatar)}` : '')}" alt="" onerror="this.style.visibility='hidden'"><div><b>You · ${esc(c.name1 || 'You')}</b><small>${ch ? `Talking to ${esc(ch.name)}${lastMood() ? ' · ' + esc(lastMood()) : ''}` : 'Pick someone to talk to'}</small></div></div>`;
    } else {
        if (!ch) html += `<p class="stcc-empty">Pick a character to see her pictures.</p>`;
        else {
            const folder = folderOf(ch.avatar), sp = await sprites(folder), imgs = chatImages();
            html += `<div class="stcc-lhead"><span>${sp.length} sprite${sp.length === 1 ? '' : 's'} · ${imgs.length} chat image${imgs.length === 1 ? '' : 's'}</span><label class="stcc-up" title="Add a sprite: pick a file, name the emotion"><input type="file" accept="image/*" hidden><i class="fa-solid fa-plus"></i> Sprite</label></div>
              <div class="stcc-drop" data-folder="${esc(folder)}">Drop a picture here to add it as her sprite</div>
              <h5>Her face</h5><div class="stcc-grid">${tile(avatarUrl(ch.avatar), 'Avatar', 'card picture', 'avatar')}${sp.map((x) => tile(x.path, x.label, 'sprite', 'sprite', `data-emote="${esc(x.label)}"`)).join('')}</div>
              ${imgs.length ? `<h5>In the chat</h5><div class="stcc-grid">${imgs.map((x) => tile(x.url, x.title, x.who, 'chat')).join('')}</div>` : ''}`;
        }
    }
    body.innerHTML = html;
    const drop = body.querySelector('.stcc-drop');
    if (drop) { ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); })); ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); })); drop.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])].find((x) => /^image\//.test(x.type)); if (f) uploadSprite(drop.dataset.folder, f); }); }
    const up = body.querySelector('.stcc-up input'); if (up) up.addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f && ch) uploadSprite(folderOf(ch.avatar), f); });
}
async function uploadSprite(folder, file) {
    const label = (window.prompt('Which emotion is this? (' + MOODS.slice(0, 8).join(', ') + '…)', 'neutral') || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!label) return;
    try { const fd = new FormData(); fd.append('name', folder); fd.append('label', label); fd.append('avatar', file, file.name); const headers = { ...ctx().getRequestHeaders() }; delete headers['Content-Type']; const r = await fetch('/api/sprites/upload', { method: 'POST', headers, body: fd }); if (!r.ok) throw new Error(`upload → ${r.status}`); SP.t = 0; toast('success', `${label} added to ${folder}'s sprites.`); render(); } catch (e) { console.warn(`[${MODULE}] sprite upload`, e); toast('error', 'That upload didn’t take. Is Character Expressions on?'); }
}

/* ---------------- clicks & changes inside the docks ---------------- */
async function onDockClick(e) {
    const p = prefs();
    const rt = e.target.closest('[data-stcc-rtab]'); if (rt) { p.rightTab = rt.getAttribute('data-stcc-rtab'); save(); renderRight(); return; }
    const lt = e.target.closest('[data-stcc-ltab]'); if (lt) { p.leftTab = lt.getAttribute('data-stcc-ltab'); save(); renderLeft(); return; }
    const sh = e.target.closest('[data-stcc-sec]'); if (sh) { const k = sh.getAttribute('data-stcc-sec'); p.sec[k] = !(p.sec[k] === undefined ? true : p.sec[k]); save(); renderLeft(); return; }
    const cb = e.target.closest('[data-stcc-char]'); if (cb) { const id = +cb.getAttribute('data-stcc-char'); const c = ctx(); try { if (typeof c.selectCharacterById === 'function') await c.selectCharacterById(id); else if (typeof window.selectCharacterById === 'function') await window.selectCharacterById(id); else { document.querySelector(`#rm_print_characters_block .character_select[chid="${id}"]`)?.click(); } } catch (err) { console.warn(`[${MODULE}] select`, err); } setTimeout(render, 400); return; }
    const chb = e.target.closest('[data-stcc-chat]'); if (chb) { const file = chb.getAttribute('data-stcc-chat'); const c = ctx(); try { if (typeof c.openCharacterChat === 'function') await c.openCharacterChat(file); else if (typeof window.openCharacterChat === 'function') await window.openCharacterChat(file); else await slash(`/go "${file}"`); } catch (err) { console.warn(`[${MODULE}] open chat`, err); } setTimeout(render, 500); return; }
    const em = e.target.closest('.stcc-tile[data-emote]'); if (em && em.closest('#stcc-dock-right')) { const label = em.getAttribute('data-emote'); await slash(`/emote ${label}`); toast('info', `${label}.`); return; }
    const ab = e.target.closest('[data-stcc-act]'); if (ab) { const a = ab.getAttribute('data-stcc-act'); if (a === 'branch') { await slash('/branch'); toast('success', 'Forked. You are on the new branch; the original is untouched.'); setTimeout(render, 800); } else if (a === 'newchat') { const c = ctx(); if (typeof c.doNewChat === 'function') await c.doNewChat({ deleteCurrentChat: false }); else document.getElementById('option_start_new_chat')?.click(); setTimeout(render, 800); } else if (a === 'summarize') { await slash('/summarize'); setTimeout(renderRight, 1500); } else if (a === 'reset-w') { p.leftW = 300; p.rightW = 360; applySize(); save(); } else if (a === 'reset-z') { p.zoom = 1; applySize(); save(); } return; }
}
function onDockChange(e) {
    const p = prefs(), el = e.target;
    if (el.dataset.stccSet) { const k = el.dataset.stccSet; p[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'idleEvery') p[k] = +el.value; save(); idleArm(); return; }
    if (el.dataset.stccSubl) { const k = el.dataset.stccSubl; p.subl[k] = el.type === 'checkbox' ? el.checked : (/^(flashMs|everyS|alpha)$/.test(k) ? +el.value : el.value); save(); sublArm(); return; }
}

/* ---------------- idle playlist: her sprites rotate while nobody is talking ---------------- */
const IDLE = { t: 0, i: 0, lastInput: Date.now() };
function idleArm() { clearInterval(IDLE.t); const p = prefs(); if (!p.idle) return; IDLE.t = setInterval(idleTick, Math.max(3, +p.idleEvery || 12) * 1000); }
async function idleTick() {
    const ch = currentChar(); if (!ch || document.hidden) return; if (document.querySelector('#send_textarea')?.value?.trim()) return; if (document.body.classList.contains('stcc-generating') || window.is_send_press) return;
    const p = prefs(); const sp = await sprites(folderOf(ch.avatar)); if (sp.length < 2) return;
    const want = String(p.idleLabels || '').split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean); const pool = want.length ? sp.filter((x) => want.includes(String(x.label).toLowerCase())) : sp; if (!pool.length) return;
    IDLE.i = (IDLE.i + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))) % pool.length; await slash(`/emote ${pool[IDLE.i].label}`);
}

/* ---------------- subliminals over the chat ---------------- */
const SUBL = { t: 0, i: 0 };
function sublLayer() { let l = document.getElementById('stcc-subl'); if (!l) { l = document.createElement('div'); l.id = 'stcc-subl'; l.hidden = true; document.body.appendChild(l); } return l; }
function sublArm() { clearInterval(SUBL.t); const s = prefs().subl, l = sublLayer(); const ph = String(s.phrases || '').split('\n').map((x) => x.trim()).filter(Boolean); l.hidden = !(s.on && ph.length); l.classList.toggle('all', s.where === 'all'); if (l.hidden) return; SUBL.t = setInterval(() => sublFlash(ph), Math.max(2, +s.everyS || 6) * 1000); }
function sublFlash(ph) {
    const s = prefs().subl, l = sublLayer(); if (l.hidden || document.hidden) return; const host = s.where === 'all' ? document.documentElement : (document.getElementById('sheld') || document.documentElement); const r = host.getBoundingClientRect();
    const sp = document.createElement('span'); sp.textContent = ph[SUBL.i++ % ph.length]; const ms = Math.max(16, +s.flashMs || 70); sp.className = ms >= 600 ? 'soft' : ''; sp.style.setProperty('--a', String(s.alpha || 0.32)); sp.style.setProperty('--ms', ms + 'ms');
    sp.style.left = (r.left + r.width * (0.15 + Math.random() * 0.7)) + 'px'; sp.style.top = (r.top + r.height * (0.15 + Math.random() * 0.6)) + 'px'; l.appendChild(sp); setTimeout(() => sp.remove(), ms + 600);
}

/* ---------------- peek (hover/click enlarge, above the pointer) + right-click ---------------- */
function ensurePeek() {
    if (document.getElementById('stcc-peek')) return;
    const pk = document.createElement('div'); pk.id = 'stcc-peek'; pk.hidden = true; document.body.appendChild(pk);
    const place = (x, y) => { const w = pk.offsetWidth || 300, h = pk.offsetHeight || 300; let left = x - w / 2, top = y - h - 18; if (top < 8) { top = Math.min(window.innerHeight - h - 8, y + 26); left = x + 26; } pk.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, left)) + 'px'; pk.style.top = Math.max(8, top) + 'px'; };
    let t = 0;
    document.addEventListener('pointerover', (e) => { const f = e.target.closest?.('.stcc-tile'); if (!f || e.pointerType === 'touch' || !prefs().peek) return; clearTimeout(t); t = setTimeout(() => { const src = f.dataset.src; pk.innerHTML = /\.(mp4|webm)(\?|$)/i.test(src) ? `<video src="${esc(src)}" autoplay muted loop playsinline></video>` : `<img src="${esc(src)}" alt="">`; pk.hidden = false; place(e.clientX, e.clientY); }, 350); });
    document.addEventListener('pointermove', (e) => { if (pk.hidden) return; if (!e.target.closest?.('.stcc-tile')) { pk.hidden = true; return; } place(e.clientX, e.clientY); });
    document.addEventListener('pointerdown', () => { clearTimeout(t); pk.hidden = true; }, true);
    document.addEventListener('contextmenu', (e) => {
        const f = e.target.closest?.('.stcc-tile'); if (!f) return; e.preventDefault();
        const src = f.dataset.src, emote = f.dataset.emote; let m = document.getElementById('stcc-ctx'); if (!m) { m = document.createElement('div'); m.id = 'stcc-ctx'; document.body.appendChild(m); document.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('#stcc-ctx')) m.hidden = true; }, true); }
        m.innerHTML = `${emote ? `<button data-a="emote">She wears it now</button>` : ''}<button data-a="send">Send it in the chat</button><button data-a="open">Open full size</button><button data-a="copy">Copy the link</button>`; m.hidden = false; m.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px'; m.style.top = Math.min(e.clientY, window.innerHeight - 140) + 'px';
        m.onclick = async (ev) => { const a = ev.target.closest('button')?.dataset.a; m.hidden = true; if (a === 'emote') slash(`/emote ${emote}`); if (a === 'open') window.open(src, '_blank'); if (a === 'copy') { try { await navigator.clipboard.writeText(new URL(src, location.href).href); toast('success', 'Link copied.'); } catch {} } if (a === 'send') { const ta = document.getElementById('send_textarea'); if (ta) { ta.value = (ta.value ? ta.value + '\n' : '') + `![${f.querySelector('b')?.textContent || 'picture'}](${src})`; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); } } };
    });
}

/* ---------------- boot ---------------- */
let renderT = 0;
function render(side) { if (side === 'left' || !side) renderLeft(); if (side === 'right' || !side) renderRight(); }
function scheduleRender() { clearTimeout(renderT); renderT = setTimeout(() => { const p = prefs(); if (p.left) renderLeft(); if (p.right) renderRight(); }, 250); }
export function bootPanels() {
    try {
        const p = prefs(); ensureButtons(); ensurePeek(); applySize();
        if (innerWidth <= 820) { p.left = false; p.right = false; save(); }   // 0.3.3: a phone opens with the chat, not the docks
        if (p.left) toggle('left', true); if (p.right) toggle('right', true);
        const c = ctx(), es = c.eventSource, et = c.eventTypes || c.event_types;
        if (es && et) { ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_DELETED', 'GENERATION_ENDED', 'SETTINGS_UPDATED'].forEach((k) => { if (et[k]) es.on(et[k], () => { if (k === 'CHAT_CHANGED') { CHATS.t = 0; actLines = -1; } scheduleRender(); }); }); if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, () => document.body.classList.add('stcc-generating')); if (et.GENERATION_ENDED) es.on(et.GENERATION_ENDED, () => document.body.classList.remove('stcc-generating')); }
        new MutationObserver(() => ensureButtons()).observe(document.body, { childList: true });
        const img = document.getElementById('expression-image'); if (img) new MutationObserver(scheduleRender).observe(img, { attributes: true, attributeFilter: ['src'] });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && prefs().subl.on) { prefs().subl.on = false; save(); sublArm(); toast('info', 'Subliminals off.'); } });
        idleArm(); sublArm(); heartBoot();
        window.StCardCreatorPanels = { toggle, render, act };
    } catch (e) { console.warn(`[${MODULE}] panels`, e); }
}
