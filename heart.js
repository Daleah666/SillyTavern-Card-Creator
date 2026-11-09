// st-card-creator · 💗 Right now: where you two stand. Ported from 0.1.5 (main) into the 0.3.x About dock.
// Six bars per character (Affection · Trust · Spark · Comfort · Jealousy · Energy), a stage name, her mood, a thought
// and her outfit. 💞 Score every reply (off until you switch it on) judges each of her messages with one quiet call on
// your connection and moves the bars; 🗣 "She knows where you two stand" whispers a short note into her prompt.
// Saved per character in extensionSettings['st-card-creator'].hearts (the same place 0.1.5 kept them).
const MODULE = 'st-card-creator';
const ctx = () => SillyTavern.getContext();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toast = (kind, msg) => window.toastr?.[kind]?.(msg, 'Right now');
const settings = () => { const ext = ctx().extensionSettings; return (ext[MODULE] = ext[MODULE] || {}); };
const saveSettings = () => ctx().saveSettingsDebounced?.();

const HEART = [['aff', '💗 Affection', '#ff7cbf'], ['trust', '🤝 Trust', '#7dd3fc'], ['spark', '✨ Spark', '#c084fc'], ['comfort', '☁ Comfort', '#86efac'], ['jeal', '😾 Jealousy', '#fbbf24'], ['energy', '⚡ Energy', '#fde047']];
const STAGES = [[0, 'Strangers'], [20, 'Friendly'], [40, 'Close friends'], [60, 'Crushing'], [78, 'Sweethearts'], [92, 'Devoted']];
const EMOS = { happy: '😊', flirty: '😏', playful: '😜', calm: '😌', neutral: '😐', shy: '😳', sad: '🥺', annoyed: '😤', jealous: '😾', sleepy: '😴', excited: '🤩', soft: '🥰', bratty: '😼' };
const TEMPERS = [[0, 'chill'], [35, 'warm'], [60, 'spicy'], [80, 'feral']];
const HEART_DEF = { aff: 35, trust: 40, spark: 25, comfort: 40, jeal: 5, energy: 70 };
const HEART_KEY = `${MODULE}-heart`;
const clamp100 = (v) => Math.max(0, Math.min(100, Math.round(+v || 0)));
let heartBusy = false, heartEdit = false, genChain = Promise.resolve();

function generate(prompt, json) {
    const job = genChain.then(async () => {
        const c = ctx();
        if (!c.onlineStatus || c.onlineStatus === 'no_connection') throw { message: "SillyTavern isn't connected to an AI. Connect one (plug icon) and try again." };
        const out = await c.generateRaw({ prompt, systemPrompt: json ? 'Reply with ONLY the JSON that was asked for: no prose, no code fences.' : 'Follow the instructions exactly and reply with only what was asked for.', responseLength: json ? 300 : null });
        return String(out ?? '');
    });
    genChain = job.catch(() => {});
    return job;
}
function curChar() { const c = ctx(); const ch = c.characterId != null ? c.characters?.[c.characterId] : null; return ch ? { avatar: ch.avatar, name: ch.name, data: ch.data || {}, desc: ch.description || ch.data?.description || '' } : null; }
function heartOf(avatar) {
    const s = settings();
    s.hearts = s.hearts && typeof s.hearts === 'object' ? s.hearts : {};
    const h = (s.hearts[avatar] = Object.assign({}, HEART_DEF, s.hearts[avatar] || {}));
    HEART.forEach(([k]) => (h[k] = clamp100(h[k])));
    h.log = Array.isArray(h.log) ? h.log : [];
    return h;
}
const stageOf = (h) => { const v = (h.aff + h.trust + h.spark + h.comfort) / 4; let out = STAGES[0][1]; STAGES.forEach(([n, l]) => { if (v >= n) out = l; }); return out; };
const temperOf = (h) => { const v = Math.round(h.spark * 0.5 + h.energy * 0.3 + h.aff * 0.2); let out = TEMPERS[0][1]; TEMPERS.forEach(([n, l]) => { if (v >= n) out = l; }); return out; };
const moodName = (h) => String(h.emo || 'neutral').replace(/^./, (x) => x.toUpperCase());
const userName = () => ctx().name1 || 'you';
const wantCost = (ch) => { const cs = ch?.data?.extensions?.companion_stage || {}, p = cs.profile || {}; return { want: p.want || cs.want || '', cost: p.cost || cs.cost || '' }; };
const showing = () => { const p = settings().panels || {}; return p.rightTab === 'now' && !!document.getElementById('stcc-now'); };

function heartPrompt() {
    const ch = curChar(); if (!ch) return '';
    const h = heartOf(ch.avatar);
    return `[${ch.name.toUpperCase()} RIGHT NOW]\nRelationship with ${userName()}: ${stageOf(h)} (affection ${h.aff}, trust ${h.trust}, spark ${h.spark}, comfort ${h.comfort}, jealousy ${h.jeal}, energy ${h.energy}, all 0-100).\nMood: ${moodName(h).toLowerCase()} ${h.level || 5}/10, temper ${temperOf(h)}.${h.wear ? `\nWearing: ${h.wear}.` : ''}${h.thought ? `\nOn her mind: ${h.thought}` : ''}\nLet this shape her tone and what she allows quietly. Never recite the numbers. Low trust = guarded; high spark = flirtier; high jealousy = pointed little remarks; low energy = slower, softer.\n[END RIGHT NOW]`;
}
function heartInject() {
    try {
        const c = ctx(), on = settings().heartPrompt !== false, types = c.extension_prompt_types || {};
        c.setExtensionPrompt?.(HEART_KEY, on ? heartPrompt() : '', types.IN_PROMPT ?? 0, 1, false, c.extension_prompt_roles?.SYSTEM ?? 0);
    } catch (e) { console.warn(`[${MODULE}] heart prompt`, e); }
}
function heartPillHtml(e) {
    const names = { aff: '💗', trust: '🤝', spark: '✨', comfort: '☁', jeal: '😾', energy: '⚡' };
    const parts = Object.entries(e.d || {}).map(([k, v]) => names[k] + (v > 0 ? '+' : '') + v);
    return `<span class="stcc-pill ${esc(e.verdict || 'meh')}" title="${esc(e.why || '')}">${parts.length ? parts.join(' ') : '±0'}${e.why ? ` <small>· ${esc(e.why)}</small>` : ''}</span>`;
}

export function heartRender() {
    const pane = document.getElementById('stcc-now'); if (!pane) return;
    const ch = curChar(); pane.innerHTML = '';
    const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
    if (!ch) { pane.appendChild(el('p', 'stcc-empty', 'Open a character chat and her bars show up here.')); return; }
    const h = heartOf(ch.avatar);
    pane.appendChild(el('div', 'stcc-now-head', `<b>💗 ${esc(ch.name)} · right now</b><span class="stcc-now-stage">${esc(stageOf(h))}</span>`));
    const line = (ic, inner) => el('div', 'stcc-now-ln', `<span>${ic}</span>${inner}`);
    pane.appendChild(line(EMOS[h.emo] || '😐', `<span class="t"><b>${esc(moodName(h))}</b> · ${h.level || 5}/10 · ${esc(temperOf(h))}</span>`));
    const think = line('💭', `<span class="t think">${esc(h.thought || "Wonder what you'll do next.")}</span><button type="button" class="stcc-icon" title="What is she thinking right now? One quick call on your connection.">↻</button>`);
    think.querySelector('button').addEventListener('click', async () => {
        const t = think.querySelector('.think'); t.textContent = '…';
        try {
            const out = await generate(`Character: ${ch.name}. ${String(ch.desc).slice(0, 400)}\nMood: ${moodName(h)} ${h.level || 5}/10, ${temperOf(h)}. Relationship with ${userName()}: ${stageOf(h)} (affection ${h.aff}, trust ${h.trust}, spark ${h.spark}, jealousy ${h.jeal}).\nWrite ONE short line (under 16 words) of what she is thinking right now, in her voice, present tense, no quotes.`, false);
            const v = String(out).trim().replace(/^["“]|["”]$/g, '').split('\n')[0].slice(0, 140);
            if (v) { h.thought = v; saveSettings(); heartInject(); }
            t.textContent = h.thought || '…';
        } catch (e) { t.textContent = h.thought || "Wonder what you'll do next."; toast('warning', e?.message || 'Could not ask.'); }
    });
    pane.appendChild(think);
    const wear = line('👗', `<span class="t">${esc(h.wear || 'Not noted yet')}</span><button type="button" class="stcc-icon" title="What she's wearing right now">✎</button>`);
    wear.querySelector('button').addEventListener('click', () => { const v = prompt(`What is ${ch.name} wearing right now?`, h.wear || ''); if (v === null) return; h.wear = v.trim().slice(0, 90); saveSettings(); heartInject(); heartRender(); });
    pane.appendChild(wear);
    const wc = wantCost(ch);
    if (wc.want || wc.cost) pane.appendChild(line('🎯', `<span class="t">${wc.want ? 'Wants ' + esc(String(wc.want).replace(/^wants?\s+/i, '').replace(/\.$/, '')) + '.' : ''}${wc.cost ? ' Cost: ' + esc(String(wc.cost).replace(/\.$/, '')) + '.' : ''}</span>`));
    pane.appendChild(el('div', 'stcc-now-stagerow', `<b>💞 ${esc(stageOf(h))}</b><small>moves with how you talk to her</small>`));
    const bars = el('div', 'stcc-now-bars');
    HEART.forEach(([k, n, col]) => {
        const row = el('div', 'stcc-now-bar');
        if (heartEdit) {
            row.innerHTML = `<span>${n}</span><input type="range" min="0" max="100" value="${h[k]}" aria-label="${esc(n)}"><small>${h[k]}</small>`;
            const r = row.querySelector('input');
            r.addEventListener('input', () => { h[k] = clamp100(r.value); row.querySelector('small').textContent = h[k]; });
            r.addEventListener('change', () => { saveSettings(); heartInject(); });
        } else row.innerHTML = `<span>${n}</span><div class="tr"><i style="width:${h[k]}%;background:${col}"></i></div><small>${h[k]}</small>`;
        bars.appendChild(row);
    });
    pane.appendChild(bars);
    const sw = el('label', 'stcc-now-sw', `<input type="checkbox"${settings().heartScore ? ' checked' : ''}> <span>💞 Score every reply (dating-sim style: what landed, what didn't)</span>`);
    sw.querySelector('input').addEventListener('change', (ev) => { settings().heartScore = !!ev.target.checked; saveSettings(); toast('info', settings().heartScore ? 'Every reply gets scored: one quick call on your connection each.' : 'Scoring off. The bars only move by hand now.'); });
    pane.appendChild(sw);
    const pr = el('label', 'stcc-now-sw', `<input type="checkbox"${settings().heartPrompt !== false ? ' checked' : ''}> <span>🗣 She knows where you two stand (adds a short note to her prompt)</span>`);
    pr.querySelector('input').addEventListener('change', (ev) => { settings().heartPrompt = !!ev.target.checked; saveSettings(); heartInject(); });
    pane.appendChild(pr);
    const log = (h.log || []).slice(0, 4);
    if (log.length) { const lg = el('div', 'stcc-now-log'); log.forEach((e) => lg.appendChild(el('div', 'r', `${heartPillHtml(e)}<small>“${esc(e.u || '')}”</small>`))); pane.appendChild(lg); }
    const tools = el('div', 'stcc-row');
    const edit = el('button', '', heartEdit ? 'Done' : '🎚 Set the bars'); edit.type = 'button';
    edit.addEventListener('click', () => { heartEdit = !heartEdit; heartRender(); });
    const reset = el('button', '', '↺ Reset'); reset.type = 'button';
    reset.addEventListener('click', () => { if (!confirm(`Reset ${ch.name}'s bars to the start?`)) return; Object.assign(h, HEART_DEF); h.log = []; delete h.emo; delete h.level; saveSettings(); heartInject(); heartRender(); });
    tools.append(edit, reset); pane.appendChild(tools);
}

async function heartScore(mesId) {
    if (heartBusy || !settings().heartScore) return;
    const c = ctx(), chat = c.chat || [], m = chat[mesId] ?? chat[chat.length - 1];
    if (!m || m.is_user || m.is_system) return;
    let me = null; for (let i = (mesId ?? chat.length - 1) - 1; i >= 0; i--) { if (chat[i]?.is_user) { me = chat[i]; break; } }
    const ch = curChar(); if (!ch || !me || String(me.mes || '').trim().length < 2) return;
    heartBusy = true; const h = heartOf(ch.avatar);
    try {
        const out = await generate(`You are the relationship engine of a dating sim. Character: ${ch.name}: ${String(ch.desc).slice(0, 400)}\nCurrent: affection ${h.aff}, trust ${h.trust}, spark ${h.spark}, comfort ${h.comfort}, jealousy ${h.jeal} (all 0-100). Stage: ${stageOf(h)}.\nThe user (${userName()}) said: ${String(me.mes).slice(0, 500)}\nShe answered: ${String(m.mes).slice(0, 700)}\nJudge how the user's move landed with her. Reply with JSON only: {"aff":-5..5,"trust":-5..5,"spark":-5..5,"comfort":-5..5,"jeal":-5..5,"emo":one of happy flirty playful calm neutral shy sad annoyed jealous sleepy excited soft bratty,"level":1..10,"verdict":"good"|"meh"|"bad","why":"under 8 words"}`, true);
        const j = JSON.parse(String(out).replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
        const d = {};
        ['aff', 'trust', 'spark', 'comfort', 'jeal'].forEach((k) => { const v = Math.max(-5, Math.min(5, Math.round(+j[k] || 0))); if (v) { d[k] = v; h[k] = clamp100(h[k] + v); } });
        h.energy = clamp100(h.energy - 1);
        if (EMOS[j.emo]) h.emo = j.emo;
        if (+j.level) h.level = Math.max(1, Math.min(10, Math.round(+j.level)));
        const entry = { d, why: String(j.why || '').slice(0, 60), verdict: /good|bad/.test(j.verdict) ? j.verdict : 'meh', t: Date.now(), u: String(me.mes).slice(0, 60) };
        h.log = [entry].concat(h.log || []).slice(0, 20);
        saveSettings(); heartInject();
        if (showing()) heartRender();
        try { const mesEl = document.querySelector(`#chat .mes[mesid="${mesId}"] .mes_text`); if (mesEl && !mesEl.querySelector('.stcc-pill')) { const span = document.createElement('div'); span.innerHTML = heartPillHtml(entry); mesEl.appendChild(span.firstChild); } } catch (e) { /* the pill is a nicety */ }
    } catch (e) { console.warn(`[${MODULE}] heart score`, e); }
    finally { heartBusy = false; }
}

export function heartBoot() {
    try {
        const c = ctx(), ev = c.eventSource, T = c.eventTypes || c.event_types || {};
        if (ev && T.MESSAGE_RECEIVED) ev.on(T.MESSAGE_RECEIVED, (id) => { heartScore(id); });
        if (ev && T.CHAT_CHANGED) ev.on(T.CHAT_CHANGED, () => { heartInject(); if (showing()) heartRender(); });
        if (ev && T.CHARACTER_SELECTED) ev.on(T.CHARACTER_SELECTED, () => { heartInject(); if (showing()) heartRender(); });
        heartInject();
    } catch (e) { console.warn(`[${MODULE}] heart boot`, e); }
}
