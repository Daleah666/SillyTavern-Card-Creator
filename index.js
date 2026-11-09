/**
 * Card creator — hosts Del's "Character card in depth" creator inside the Duet Stage side panel.
 *
 * - Adds a "Card creator" tab to #duet-side-panel and registers "Card creator" with
 *   window.DuetStage.registerPanel. Never edits st-duet-stage; DOM + CSS only.
 * - Serves the creator in an iframe (./creator/index.html, built by build.mjs) and answers
 *   its window.claude runtime through window.__stcc (see shim.js).
 * - AI goes through SillyTavern's generateRaw on the current connection. Nothing is
 *   written into any chat.
 * - "Save to SillyTavern" writes a chara_card_v2 PNG (picture Del picks) keeping
 *   extensions.companion_stage. "Load from SillyTavern" opens any ST card for editing.
 */

import { bootPanels } from './panels.js';
const MODULE = 'st-card-creator';
const VERSION = '0.2.1';
const PANEL_ID = 'duet-side-panel';
const PANEL_NAME = 'Card creator';
const CREATOR_URL = new URL('./creator/index.html', import.meta.url).href;
const IDB_NAME = 'st-card-creator';
const IDB_STORES = ['ls', 'docs', 'backups'];
const MAX_BACKUPS = 30;
const MAX_SIDE = 1536;

const SYS_JSON =
    'You help Del design a role-play character card in a card-maker app. Follow the instructions exactly. ' +
    'Reply with ONLY the JSON that was asked for: no prose before or after, no code fences, no comments.';
const SYS_TEXT =
    'You help Del design a role-play character card in a card-maker app. Follow the instructions exactly and reply with only what was asked for.';

const ctx = () => SillyTavern.getContext();

function settings() {
    const ext = ctx().extensionSettings;
    const s = (ext[MODULE] = ext[MODULE] || {});
    s.links = s.links && typeof s.links === 'object' ? s.links : {};
    if (s.wide === undefined) s.wide = true;
    if (s.folder === undefined) s.folder = '';
    return s;
}
const saveSettings = () => ctx().saveSettingsDebounced?.();

const esc = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
const slug = (t) =>
    String(t || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'character';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toast = (kind, msg) => window.toastr?.[kind]?.(msg, PANEL_NAME);
const avatarUrl = (avatar) => `/characters/${encodeURIComponent(avatar)}`;

/* ---------------- IndexedDB (creator's private storage) ---------------- */
let idbPromise = null;
function idb() {
    idbPromise ||= new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
            for (const s of IDB_STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return idbPromise;
}

async function idbTx(store, mode, fn) {
    const db = await idb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const out = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(out?.result ?? out);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

async function idbAll(store) {
    const db = await idb();
    return new Promise((resolve, reject) => {
        const out = {};
        const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
        req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve(out);
            out[cur.key] = cur.value;
            cur.continue();
        };
        req.onerror = () => reject(req.error);
    });
}

const idbPut = (store, key, val) =>
    idbTx(store, 'readwrite', (s) => s.put(val, key)).catch((e) => console.warn(`[${MODULE}] save failed`, store, e));
const idbDel = (store, key) =>
    idbTx(store, 'readwrite', (s) => s.delete(key)).catch((e) => console.warn(`[${MODULE}] delete failed`, store, e));

/* ---------------- host API used by shim.js inside the iframe ---------------- */
let lsCache = {};
let docsCache = {};
let hook = null;
let hookWaiters = [];
let genChain = Promise.resolve();

function generate(prompt, json) {
    const job = genChain.then(async () => {
        const c = ctx();
        if (!c.onlineStatus || c.onlineStatus === 'no_connection') {
            throw { code: 'offline', message: "SillyTavern isn't connected to an AI. Connect Featherless (plug icon) and try again." };
        }
        const out = await c.generateRaw({
            prompt,
            systemPrompt: json ? SYS_JSON : SYS_TEXT,
            responseLength: json ? 1500 : null,
        });
        return String(out ?? '');
    });
    genChain = job.catch(() => {});
    return job;
}

async function uploadAsset(name, type, b64) {
    const ext = (String(name).match(/\.([a-z0-9]+)$/i)?.[1] || String(type).split('/')[1] || 'png').toLowerCase();
    const base = String(name).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 60) || 'upload';
    const res = await fetch('/api/images/upload', {
        method: 'POST',
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ image: b64, format: ext, ch_name: 'Card creator', filename: `${base}-${Date.now().toString(36)}` }),
    });
    if (!res.ok) throw { code: 'upload', message: `Upload failed (${res.status})` };
    const { path } = await res.json();
    const url = '/' + String(path).replace(/\\/g, '/').replace(/^\/+/, '');
    return JSON.stringify({ id: url, url, name });
}

window.__stcc = {
    version: VERSION,
    lsSnapshot: () => JSON.stringify(lsCache),
    lsPut: (k, v) => {
        lsCache[k] = v;
        idbPut('ls', k, v);
    },
    lsDel: (k) => {
        delete lsCache[k];
        idbDel('ls', k);
    },
    docsSnapshot: () => JSON.stringify(docsCache),
    docPut: (path, json) => {
        docsCache[path] = json;
        idbPut('docs', path, json);
    },
    docDel: (path) => {
        delete docsCache[path];
        idbDel('docs', path);
    },
    generate,
    uploadAsset,
    setHook: (h) => {
        hook = h;
        hookWaiters.splice(0).forEach((fn) => fn(h));
        setStatus('Ready');
    },
};

function waitForHook(ms = 30000) {
    if (hook) return Promise.resolve(hook);
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('The creator is still loading. Try again in a moment.')), ms);
        hookWaiters.push((h) => {
            clearTimeout(t);
            resolve(h);
        });
    });
}

/* ---------------- stage strip: her portrait + Talks meter at the top of the side panel ----------------
   DOM + CSS only, never edits st-duet-stage. Four stage modes, like the Duet buttons:
   pill (name only) · thumb · half · hero. Mode is remembered in settings().stageMode. */
const STAGE_MODES = [
    ['pill', '▭', 'Pill: just her name and the Talks meter'],
    ['thumb', '◧', 'Thumb: a small portrait beside the meter'],
    ['half', '◨', 'Half: portrait on one side, meter on the other'],
    ['hero', '⛶', 'Hero: her portrait fills the strip'],
];
const TALK_TITLES = ['Stranger', 'Acquaintance', 'Regular', 'Friend', 'Close friend', 'Bestie', 'Confidant', 'Partner in crime', 'Soulmate', 'Legend'];
const talksForLevel = (lv) => (lv <= 0 ? 0 : 5 * lv * (lv + 1)); // 10, 30, 60, 100, 150 …
function talkLevel(n) {
    let lv = 0;
    while (talksForLevel(lv + 1) <= n && lv < 60) lv += 1;
    const cur = talksForLevel(lv), next = talksForLevel(lv + 1);
    return { lv, cur, next, pct: Math.max(0, Math.min(100, Math.round(((n - cur) / Math.max(1, next - cur)) * 100))), left: Math.max(0, next - n) };
}
function stageMode() {
    const m = settings().stageMode;
    return STAGE_MODES.some(([k]) => k === m) ? m : 'thumb';
}
function currentChar() {
    try {
        const c = ctx();
        const id = c.characterId;
        const ch = id != null && c.characters ? c.characters[id] : null;
        return ch || null;
    } catch {
        return null;
    }
}
function countTalks() {
    try {
        const chat = ctx().chat || [];
        let mine = 0, hers = 0;
        for (const m of chat) {
            if (!m || m.is_system) continue;
            if (m.is_user) mine += 1;
            else hers += 1;
        }
        return { mine, hers, total: mine + hers };
    } catch {
        return { mine: 0, hers: 0, total: 0 };
    }
}
function stageMedia(ch) {
    const st = ch?.data?.extensions?.companion_stage;
    const media = Array.isArray(st?.media) ? st.media : [];
    const idles = media.filter((m) => (m?.type || 'idle') === 'idle').length;
    const expressions = media.filter((m) => m?.type === 'expression').length;
    return { idles, expressions, portrait: st?.portrait && !/^\/_blob\//.test(st.portrait) ? st.portrait : '' };
}
function ensureStage(el) {
    if (!el || el.querySelector('#stcc-stage')) return el?.querySelector('#stcc-stage') || null;
    const strip = document.createElement('section');
    strip.id = 'stcc-stage';
    strip.className = 'stcc-stage';
    strip.setAttribute('aria-label', 'Her stage');
    strip.innerHTML = `
        <div class="stcc-stage-port"><img alt="" hidden><div class="stcc-stage-ph">📷</div></div>
        <div class="stcc-stage-body">
            <div class="stcc-stage-head">
                <b class="stcc-stage-name">—</b>
                <span class="stcc-stage-title"></span>
                <span class="stcc-spacer"></span>
                <div class="stcc-stage-modes" role="group" aria-label="Stage size">
                    ${STAGE_MODES.map(([k, ic, tip]) => `<button type="button" data-stage="${k}" title="${esc(tip)}" aria-pressed="false">${ic}</button>`).join('')}
                </div>
            </div>
            <div class="stcc-talks" title="Talks: every message you two trade. Fill the bar to level her up.">
                <span class="stcc-lv">Lv <b>0</b></span>
                <div class="stcc-talks-bar"><i style="--v:0"></i><em>🗨 Talks</em></div>
                <span class="stcc-talks-n">0</span>
            </div>
            <div class="stcc-stage-foot">
                <span class="stcc-next">Say hi to start</span>
                <span class="stcc-badges"></span>
            </div>
        </div>`;
    el.insertBefore(strip, el.firstElementChild?.nextSibling || null);
    strip.querySelector('.stcc-stage-modes').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-stage]');
        if (!b) return;
        settings().stageMode = b.getAttribute('data-stage');
        saveSettings();
        renderStage();
    });
    strip.querySelector('.stcc-stage-port').addEventListener('click', () => {
        const i = STAGE_MODES.findIndex(([k]) => k === stageMode());
        settings().stageMode = STAGE_MODES[(i + 1) % STAGE_MODES.length][0];
        saveSettings();
        renderStage();
    });
    return strip;
}
let lastLevelKey = '';
function renderStage() {
    const el = panel();
    const strip = el && ensureStage(el);
    if (!strip) return;
    const mode = stageMode();
    strip.dataset.mode = mode;
    strip.querySelectorAll('[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-stage') === mode)));
    const ch = currentChar();
    const media = stageMedia(ch);
    const name = ch?.name || 'No one here yet';
    const pic = ch ? media.portrait || avatarUrl(ch.avatar) : '';
    const img = strip.querySelector('.stcc-stage-port img');
    const ph = strip.querySelector('.stcc-stage-ph');
    if (pic) {
        if (img.getAttribute('src') !== pic) img.src = pic;
        img.hidden = false;
        ph.hidden = true;
    } else {
        img.hidden = true;
        ph.hidden = false;
    }
    strip.querySelector('.stcc-stage-name').textContent = name;
    const t = countTalks();
    const L = talkLevel(t.total);
    strip.querySelector('.stcc-lv b').textContent = String(L.lv);
    strip.querySelector('.stcc-stage-title').textContent = TALK_TITLES[Math.min(L.lv, TALK_TITLES.length - 1)];
    strip.querySelector('.stcc-talks-bar i').style.setProperty('--v', String(L.pct));
    strip.querySelector('.stcc-talks-n').textContent = String(t.total);
    strip.querySelector('.stcc-next').textContent = ch
        ? t.total === 0
            ? 'Say hi to start the meter'
            : `${L.left} more talk${L.left === 1 ? '' : 's'} to Lv ${L.lv + 1}`
        : 'Open a chat to light this up';
    strip.querySelector('.stcc-badges').innerHTML = ch
        ? [
              `<span title="Your messages">🫵 ${t.mine}</span>`,
              `<span title="Her replies">💬 ${t.hers}</span>`,
              media.idles ? `<span title="Idle clips on her card">🎞 ${media.idles}</span>` : '',
              media.expressions ? `<span title="Expressions on her card">🎭 ${media.expressions}</span>` : '',
          ].join('')
        : '';
    const key = `${ch?.avatar || ''}`;
    const seen = (settings().talkLevels = settings().talkLevels || {});
    if (ch) {
        const prev = seen[key];
        if (prev != null && L.lv > prev) {
            strip.classList.remove('stcc-levelup');
            void strip.offsetWidth;
            strip.classList.add('stcc-levelup');
            toast('success', `✨ ${name} hit Lv ${L.lv}: ${TALK_TITLES[Math.min(L.lv, TALK_TITLES.length - 1)]}`);
        }
        if (prev !== L.lv) {
            seen[key] = L.lv;
            saveSettings();
        }
    }
    lastLevelKey = key;
}
let stageTimer = null;
function wireStageEvents() {
    const c = ctx();
    const es = c.eventSource, et = c.eventTypes || c.event_types;
    const bump = () => setTimeout(renderStage, 60);
    if (es && et) {
        ['CHAT_CHANGED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'CHARACTER_EDITED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED']
            .filter((k) => et[k])
            .forEach((k) => es.on(et[k], bump));
    }
    if (!stageTimer) stageTimer = setInterval(renderStage, 4000); // safety net when an event is missed
}

/* ---------------- side panel tab ---------------- */
let activeTab = 'rail';
let frameLoading = false;

function panel() {
    return document.getElementById(PANEL_ID);
}

function ensureTab() {
    const el = panel();
    if (!el) return false;
    if (!el.querySelector('#stcc-tabs')) {
        const tabs = document.createElement('div');
        tabs.id = 'stcc-tabs';
        tabs.className = 'stcc-tabs';
        tabs.innerHTML = `
            <button type="button" data-stcc-tab="rail" class="active" title="Back to the Duet rail">Talking-To</button>
            <button type="button" data-stcc-tab="creator" title="Make or edit character cards"><i class="fa-solid fa-id-card"></i> Card creator</button>`;
        const pane = document.createElement('section');
        pane.id = 'stcc-pane';
        pane.hidden = true;
        pane.innerHTML = `
            <div class="stcc-bar">
                <button type="button" id="stcc-load" title="Open a SillyTavern character in the creator"><i class="fa-solid fa-folder-open"></i> Load from SillyTavern</button>
                <button type="button" id="stcc-save" class="stcc-primary" title="Write this card into SillyTavern as a PNG"><i class="fa-solid fa-floppy-disk"></i> Save to SillyTavern</button>
                <span class="stcc-spacer"></span>
                <button type="button" id="stcc-wide" class="stcc-icon" title="Wide / narrow"><i class="fa-solid fa-left-right"></i></button>
                <button type="button" id="stcc-reload" class="stcc-icon" title="Reload the creator"><i class="fa-solid fa-rotate"></i></button>
            </div>
            <div class="stcc-status" id="stcc-status">Not loaded yet</div>
            <div class="stcc-frame-wrap" id="stcc-frame-wrap"></div>`;
        const anchor = el.querySelector('#duet-rail-body') || el.querySelector('.duet-sp-head')?.nextSibling || el.firstElementChild?.nextSibling;
        el.insertBefore(tabs, anchor || null);
        el.insertBefore(pane, anchor || null);
        ensureStage(el);
        tabs.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-stcc-tab]');
            if (b) setTab(b.getAttribute('data-stcc-tab'));
        });
        pane.querySelector('#stcc-load').addEventListener('click', () => openLoadDialog());
        pane.querySelector('#stcc-save').addEventListener('click', () => openSaveDialog());
        pane.querySelector('#stcc-wide').addEventListener('click', () => {
            settings().wide = !settings().wide;
            saveSettings();
            applyWide();
        });
        pane.querySelector('#stcc-reload').addEventListener('click', () => loadFrame(true));
    }
    applyTabState();
    return true;
}

function applyWide() {
    panel()?.classList.toggle('stcc-wide', activeTab === 'creator' && !!settings().wide);
}

function applyTabState() {
    const el = panel();
    if (!el) return;
    el.classList.toggle('stcc-on', activeTab === 'creator');
    el.querySelectorAll('[data-stcc-tab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-stcc-tab') === activeTab));
    const pane = el.querySelector('#stcc-pane');
    if (pane) pane.hidden = activeTab !== 'creator';
    applyWide();
    renderStage();
}

function setTab(tab) {
    activeTab = tab === 'creator' ? 'creator' : 'rail';
    if (activeTab === 'rail' && panel()?.classList.contains('stcc-standalone')) return closeStandalone();
    applyTabState();
    if (activeTab === 'creator') loadFrame(false);
}

function setStatus(text) {
    const s = document.getElementById('stcc-status');
    if (s) s.textContent = text;
}

async function loadFrame(force) {
    const wrap = document.getElementById('stcc-frame-wrap');
    if (!wrap || frameLoading) return;
    let frame = wrap.querySelector('iframe');
    if (frame && !force) return;
    frameLoading = true;
    try {
        setStatus('Loading the creator…');
        hook = null;
        [lsCache, docsCache] = await Promise.all([idbAll('ls'), idbAll('docs')]);
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'stcc-frame';
            frame.title = 'Character card creator';
            frame.setAttribute('allow', 'clipboard-write; microphone; autoplay');
            wrap.appendChild(frame);
        }
        frame.src = `${CREATOR_URL}?v=${VERSION}&t=${Date.now()}`;
    } catch (e) {
        console.error(`[${MODULE}] creator failed to load`, e);
        setStatus("The creator couldn't load. See the browser console.");
    } finally {
        frameLoading = false;
    }
}

/* ---------------- standalone fallback (no st-duet-stage installed) ---------------- */
const hasDuet = () => typeof window.DuetStage?.registerPanel === 'function';

function ensureStandalonePanel() {
    let el = panel();
    if (el) return el;
    if (hasDuet()) return null; // Duet Stage owns the panel; it'll show up on its own
    el = document.createElement('aside');
    el.id = PANEL_ID;
    el.className = 'stcc-standalone';
    el.setAttribute('aria-label', PANEL_NAME);
    el.innerHTML = `
        <div class="stcc-sa-head">
            <i class="fa-solid fa-id-card"></i><b>${PANEL_NAME}</b>
            <span class="stcc-spacer"></span>
            <button type="button" id="stcc-sa-close" class="stcc-icon" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    document.body.appendChild(el);
    el.querySelector('#stcc-sa-close').addEventListener('click', () => closeStandalone());
    return el;
}

function closeStandalone() {
    const el = panel();
    if (!el?.classList.contains('stcc-standalone')) return;
    el.classList.remove('open');
    activeTab = 'rail';
    applyTabState();
}

function ensureLaunchers() {
    // Extensions settings block (always), so the creator is reachable without Duet Stage.
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (host && !document.getElementById('stcc-settings')) {
        const block = document.createElement('div');
        block.id = 'stcc-settings';
        block.className = 'stcc-settings';
        block.innerHTML = `
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Card creator</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <p class="stcc-note">Design character cards in depth and save them into SillyTavern as PNGs. Works on its own; docks into the Duet Stage side panel when that extension is installed.</p>
                    <div class="flex-container">
                        <button type="button" id="stcc-open-settings" class="menu_button"><i class="fa-solid fa-id-card"></i> Open the Card creator</button>
                    </div>
                    <small class="stcc-ver">v${VERSION}${hasDuet() ? ' · Duet Stage detected' : ' · standalone mode'}</small>
                </div>
            </div>`;
        host.appendChild(block);
        block.querySelector('#stcc-open-settings').addEventListener('click', () => openCreator());
    }
    // Wand (extensions) menu entry next to the chat bar.
    const menu = document.getElementById('extensionsMenu');
    if (menu && !document.getElementById('stcc-wand')) {
        const item = document.createElement('div');
        item.id = 'stcc-wand';
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.tabIndex = 0;
        item.innerHTML = `<div class="fa-solid fa-id-card extensionsMenuExtensionButton"></div><span>Card creator</span>`;
        item.addEventListener('click', () => openCreator());
        menu.appendChild(item);
    }
}

async function openCreator() {
    const isOpen = () => panel()?.classList.contains('open');
    if (hasDuet()) {
        if (!isOpen()) window.DuetStage?.toggleSidePanel?.();
        for (let i = 0; i < 40 && !panel(); i++) await sleep(50);
        if (panel()?.classList.contains('duet-stage-collapsed')) window.DuetStage?.stageMode?.setActive?.(false);
    } else {
        ensureStandalonePanel()?.classList.add('open');
    }
    if (!ensureTab()) {
        toast('warning', 'Open the Duet side panel first (theater icon → Show Side Panel).');
        return;
    }
    setTab('creator');
}

/* ---------------- ST card helpers ---------------- */
async function api(path, body) {
    const res = await fetch(path, { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify(body || {}) });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    const type = res.headers.get('content-type') || '';
    return type.includes('json') ? res.json() : res.text();
}

const getStChar = (avatar) => api('/api/characters/get', { avatar_url: avatar });

function defaultStage(name) {
    const r = () => 2 + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10);
    return {
        profile: { first: String(name || '').split(' ')[0] || name || '' },
        primary: { Charm: r(), Wit: r(), Nerve: r(), Heart: r(), Chaos: r() },
        primaryScale: 20,
        body: { stats: [], notes: [] },
        tags: [],
        kinds: ['companion'],
        highlights: [],
        media: [],
        layout: 1,
        idle: { order: 'random', autoplay: true },
        view: 'companion',
        spicyTags: [],
        motives: [],
        tagLibrary: {},
        trackers: { breast: false, butt: false },
        aiBias: { lewd: 2, pace: 1, change: 1, dev: 'none', stage: 'always', bots: true, xp: false, xpMode: 'image', xpRef: true },
    };
}

function toV2(ch) {
    const d = structuredClone(ch?.data && typeof ch.data === 'object' ? ch.data : {});
    for (const f of ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example']) {
        if (d[f] == null) d[f] = ch?.[f] ?? '';
    }
    d.creator_notes ??= ch?.creatorcomment ?? '';
    d.system_prompt ??= '';
    d.post_history_instructions ??= '';
    d.alternate_greetings = Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [];
    d.tags = Array.isArray(d.tags) ? d.tags : Array.isArray(ch?.tags) ? ch.tags : [];
    d.creator ??= '';
    d.character_version ??= '';
    d.extensions = d.extensions && typeof d.extensions === 'object' ? d.extensions : {};
    const st = (d.extensions.companion_stage = d.extensions.companion_stage && typeof d.extensions.companion_stage === 'object'
        ? d.extensions.companion_stage
        : defaultStage(d.name));
    // Hero still = ST avatar file only. Never keep Claude/_blob portraits (they invent peeks / wrong faces).
    if (ch.avatar) {
        st.portrait = avatarUrl(ch.avatar);
        st.stAvatar = ch.avatar;
    } else if (!st.portrait || /^\/_blob\//.test(st.portrait) || /claude\.(ai|site)/i.test(st.portrait)) {
        st.portrait = '';
    }
    if (Array.isArray(st.media)) {
        st.media = st.media.filter(
            (m) => m && m.url && !/^\/_blob\//.test(m.url) && !/claude\.(ai|site)/i.test(String(m.url)),
        );
    }
    return { spec: 'chara_card_v2', spec_version: '2.0', data: d };
}

function linkedAvatar(id) {
    const a = settings().links[id];
    return a && ctx().characters?.some((c) => c.avatar === a) ? a : '';
}

/** ST expression folder name for an avatar file (Bambi.png → Bambi). */
function spriteFolder(avatar) {
    return String(avatar || '')
        .replace(/^.*[\\/]/, '')
        .replace(/\.(png|webp|jpg|jpeg|gif)$/i, '')
        .trim();
}

function spriteFileName(path) {
    return String(path || '')
        .split('?')[0]
        .replace(/^.*[\\/]/, '');
}

function isMotionClip(name) {
    return /\.gif$/i.test(name) || /(?:^|[-_])(idle|breath|cycle|bounce|sway|flourish|wave)(?:[-_.]|$)/i.test(name);
}

/**
 * Pull existing ST expression-pack files into companion_stage.media so Idles
 * is not stuck at 0. Never invents clips or faces — only `/characters/{folder}/…`.
 */
async function wireStSprites(stage, avatar) {
    const folder = spriteFolder(avatar);
    if (!folder || !stage) return { added: 0, idles: 0, expressions: 0, folder: '' };
    let sprites = [];
    try {
        const res = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
        if (res.ok) sprites = await res.json();
    } catch (e) {
        console.warn(`[${MODULE}] sprites fetch failed`, e);
    }
    if (!Array.isArray(sprites) || !sprites.length) {
        return { added: 0, idles: 0, expressions: 0, folder };
    }
    stage.media = Array.isArray(stage.media) ? stage.media : [];
    const have = new Set(
        stage.media.map((m) => String(m?.id || '')).concat(stage.media.map((m) => spriteFileName(m?.url || m?.name || ''))),
    );
    let added = 0;
    let idles = 0;
    let expressions = 0;
    for (const sp of sprites) {
        const path = String(sp?.path || '');
        const file = spriteFileName(path);
        if (!path || !file) continue;
        if (/^Bambi\.png$/i.test(file) && folder.toLowerCase() === 'bambi') continue;
        const id = `st:${folder}:${file}`;
        if (have.has(id) || have.has(file)) continue;
        const label = String(sp.label || file.replace(/\.[^.]+$/, '')).trim() || 'Clip';
        const motion = isMotionClip(file);
        const item = {
            id,
            url: path.startsWith('/') ? path : `/${path}`,
            name: file,
            label: file.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            variant: '',
            type: motion ? 'idle' : 'expression',
            kind: /\.(mp4|webm|mov)$/i.test(file) ? 'video' : 'image',
            source: 'SillyTavern',
            emotion: motion ? undefined : label.charAt(0).toUpperCase() + label.slice(1),
            tags: ['st-sprites', folder.toLowerCase()],
            motion: label,
            group: label,
            bytes: 0,
            locked: !!motion,
            addedAt: new Date().toISOString(),
            touched: new Date().toISOString(),
        };
        stage.media.push(item);
        have.add(id);
        have.add(file);
        added++;
        if (motion) idles++;
        else expressions++;
    }
    stage.idle = stage.idle && typeof stage.idle === 'object' ? stage.idle : { order: 'random', autoplay: true };
    // Keep the approved ST still on the hero until Del hits Play idles.
    if (added) stage.idle.autoplay = false;
    return { added, idles, expressions, folder, total: stage.media.length };
}

function normName(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/** Prefer an existing Claude-app card over minting st-*. Match: link map → stAvatar → name → stable slug. */
function resolveCreatorId(avatar, cardName, hookApi) {
    const s = settings();
    for (const [id, a] of Object.entries(s.links || {})) {
        if (a === avatar) return { id, how: 'link' };
    }
    const list = typeof hookApi?.listChars === 'function' ? hookApi.listChars() || [] : [];
    const byAvatar = list.find((c) => c?.stAvatar === avatar);
    if (byAvatar?.id) return { id: byAvatar.id, how: 'stAvatar' };
    const want = normName(cardName);
    if (want) {
        const byName = list.find((c) => normName(c?.name) === want);
        if (byName?.id) return { id: byName.id, how: 'name' };
    }
    const stable = `st-${slug(String(avatar || '').replace(/\.png$/i, ''))}`;
    const byStable = list.find((c) => c?.id === stable);
    if (byStable?.id) return { id: byStable.id, how: 'stable-existing' };
    return { id: stable, how: 'stable-new' };
}

/** Open existing Claude card: keep her stage depth, overlay ST text fields, stamp stAvatar. */
function mergeOntoExisting(existingJson, stCard, avatar) {
    if (!existingJson) {
        const out = structuredClone(stCard);
        out.data.extensions.companion_stage.stAvatar = avatar;
        return out;
    }
    let existing;
    try {
        existing = JSON.parse(existingJson);
    } catch {
        const out = structuredClone(stCard);
        out.data.extensions.companion_stage.stAvatar = avatar;
        return out;
    }
    const out = structuredClone(existing);
    out.spec = 'chara_card_v2';
    out.spec_version = '2.0';
    out.data = out.data && typeof out.data === 'object' ? out.data : {};
    for (const f of [
        'name',
        'description',
        'personality',
        'scenario',
        'first_mes',
        'mes_example',
        'creator_notes',
        'system_prompt',
        'post_history_instructions',
        'creator',
        'character_version',
    ]) {
        if (stCard.data[f] != null && stCard.data[f] !== '') out.data[f] = stCard.data[f];
    }
    if (Array.isArray(stCard.data.alternate_greetings) && stCard.data.alternate_greetings.length) {
        out.data.alternate_greetings = stCard.data.alternate_greetings;
    }
    if (Array.isArray(stCard.data.tags) && stCard.data.tags.length) out.data.tags = stCard.data.tags;
    out.data.extensions = out.data.extensions && typeof out.data.extensions === 'object' ? out.data.extensions : {};
    const stage =
        out.data.extensions.companion_stage && typeof out.data.extensions.companion_stage === 'object'
            ? out.data.extensions.companion_stage
            : (out.data.extensions.companion_stage = structuredClone(stCard.data.extensions.companion_stage));
    stage.stAvatar = avatar;
    if (!stage.portrait || /^\/_blob\//.test(stage.portrait) || /claude\.(ai|site)/i.test(stage.portrait)) {
        stage.portrait = avatarUrl(avatar);
    }
    return out;
}

/* ---------------- PNG with a chara tEXt chunk ---------------- */
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}

function pngWithChara(pngBuf, json) {
    const src = new Uint8Array(pngBuf);
    const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
    const SIG = 8;
    const kept = [];
    let off = SIG;
    let iend = null;
    while (off < src.length) {
        const len = view.getUint32(off);
        const type = String.fromCharCode(...src.subarray(off + 4, off + 8));
        const chunk = src.subarray(off, off + 12 + len);
        if (type === 'IEND') iend = chunk;
        else if (type === 'tEXt') {
            const data = src.subarray(off + 8, off + 8 + len);
            const key = String.fromCharCode(...data.subarray(0, Math.max(0, data.indexOf(0))));
            if (!/^(chara|ccv3)$/i.test(key)) kept.push(chunk);
        } else kept.push(chunk);
        off += 12 + len;
    }
    const text = new TextEncoder().encode(`chara\0${utf8ToB64(json)}`);
    const chunk = new Uint8Array(12 + text.length);
    const cv = new DataView(chunk.buffer);
    cv.setUint32(0, text.length);
    chunk.set([0x74, 0x45, 0x58, 0x74], 4);
    chunk.set(text, 8);
    cv.setUint32(8 + text.length, crc32(chunk.subarray(4, 8 + text.length)));
    const parts = [src.subarray(0, SIG), ...kept, chunk, iend];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
}

async function imageToPng(source) {
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    try {
        const img = new Image();
        img.decoding = 'async';
        await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error("That picture couldn't be opened."));
            img.src = url;
        });
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) throw new Error("That picture couldn't be converted to PNG.");
        return blob.arrayBuffer();
    } finally {
        if (source instanceof Blob) URL.revokeObjectURL(url);
    }
}

async function backupStPng(avatar) {
    try {
        const res = await fetch(`${avatarUrl(avatar)}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        await idbPut('backups', `${new Date().toISOString()}|${avatar}`, await res.arrayBuffer());
        const keys = Object.keys(await idbAll('backups')).sort();
        for (const k of keys.slice(0, Math.max(0, keys.length - MAX_BACKUPS))) await idbDel('backups', k);
    } catch (e) {
        console.warn(`[${MODULE}] backup of ${avatar} failed`, e);
    }
}

/* ---------------- modal ---------------- */
function modal(title, bodyHtml) {
    closeModal();
    const m = document.createElement('div');
    m.id = 'stcc-modal';
    m.innerHTML = `
        <div class="stcc-modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <header><b>${esc(title)}</b><button type="button" class="stcc-icon" data-stcc-close title="Close">✕</button></header>
            <div class="stcc-modal-body">${bodyHtml}</div>
        </div>`;
    m.addEventListener('click', (ev) => {
        if (ev.target === m || ev.target.closest('[data-stcc-close]')) closeModal();
    });
    m.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closeModal();
    });
    document.body.appendChild(m);
    return m;
}
function closeModal() {
    document.getElementById('stcc-modal')?.remove();
}

/* ---------------- Load from SillyTavern ---------------- */
function openLoadDialog() {
    const chars = (ctx().characters || [])
        .filter((c) => c?.avatar)
        .map((c) => ({ name: c.name || c.avatar, avatar: c.avatar, stage: !!c.data?.extensions?.companion_stage }))
        .sort((a, b) => Number(b.stage) - Number(a.stage) || a.name.localeCompare(b.name));
    const thumb = (a) => ctx().getThumbnailUrl?.('avatar', a) || avatarUrl(a);
    const m = modal(
        'Load from SillyTavern',
        `<input type="search" class="stcc-search" placeholder="Search characters" aria-label="Search characters">
         <p class="stcc-note">Pick a card to edit. Cards made in the creator (♥) open with all their stage data.</p>
         <div class="stcc-grid">${chars
             .map(
                 (c) => `<button type="button" class="stcc-tile" data-avatar="${esc(c.avatar)}" data-name="${esc(c.name.toLowerCase())}">
                    <img loading="lazy" src="${esc(thumb(c.avatar))}" alt="">
                    <span>${c.stage ? '♥ ' : ''}${esc(c.name)}</span></button>`,
             )
             .join('')}</div>`,
    );
    const search = m.querySelector('.stcc-search');
    search.focus();
    search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        m.querySelectorAll('.stcc-tile').forEach((t) => (t.hidden = !!q && !t.dataset.name.includes(q)));
    });
    m.querySelector('.stcc-grid').addEventListener('click', async (ev) => {
        const t = ev.target.closest('.stcc-tile');
        if (!t) return;
        closeModal();
        await loadFromSt(t.dataset.avatar);
    });
}

async function loadFromSt(avatar) {
    try {
        setStatus(`Opening ${avatar}…`);
        const h = await waitForHook();
        const ch = await getStChar(avatar);
        const stCard = toV2({ ...ch, avatar });
        const { id, how } = resolveCreatorId(avatar, stCard.data.name, h);
        const before = typeof h.peekCardJson === 'function' ? h.peekCardJson(id) : '';
        const existed = !!before || how === 'link' || how === 'stAvatar' || how === 'name' || how === 'stable-existing';
        const card = mergeOntoExisting(before, stCard, avatar);
        const stage = card?.data?.extensions?.companion_stage;
        const wired = await wireStSprites(stage, avatar);
        if (wired.added) {
            console.info(
                `[${MODULE}] wired ST sprites for ${wired.folder}: +${wired.added} (idles ${wired.idles}, expr ${wired.expressions})`,
            );
        }
        settings().links[id] = avatar;
        // Drop stale synthetic ids that pointed at the same avatar under a different key.
        for (const [otherId, a] of Object.entries(settings().links)) {
            if (a === avatar && otherId !== id) delete settings().links[otherId];
        }
        saveSettings();
        // Collapse Claude-app duplicates for this ST character (same stAvatar / orphaned st-* same name).
        const want = normName(stCard.data.name);
        for (const c of h.listChars?.() || []) {
            if (!c?.id || c.id === id || c.id === 'redz') continue;
            const sameAvatar = c.stAvatar === avatar;
            const orphanSt = /^st-/.test(c.id) && want && normName(c.name) === want;
            if (sameAvatar || orphanSt) {
                h.forgetChar?.(c.id);
                if (settings().links[c.id]) delete settings().links[c.id];
            }
        }
        saveSettings();
        await h.loadCardJson(id, JSON.stringify(card));
        // Kill leftover idle/expression video layers so no partial face peeks over the ST hero.
        try {
            const frame = document.getElementById('stcc-frame');
            const idoc = frame?.contentDocument;
            const pvid = idoc?.getElementById('pvid');
            if (pvid) {
                pvid.pause?.();
                pvid.removeAttribute('src');
                pvid.removeAttribute('poster');
                while (pvid.firstChild) pvid.removeChild(pvid.firstChild);
                pvid.load?.();
                pvid.hidden = true;
                pvid.style.display = 'none';
            }
            idoc?.querySelectorAll('.port img:not(#portImg), .port video:not(#portImg)').forEach((el) => {
                el.hidden = true;
                el.style.display = 'none';
            });
            const port = idoc?.querySelector('.port');
            if (port) {
                port.style.overflow = 'hidden';
                port.style.background = '#000';
            }
            // Keep Soft Soft / idle face prefs from painting a second face into the hero.
            ['pfFront', 'pfBack'].forEach((pid) => {
                const el = idoc?.getElementById(pid);
                if (!el) return;
                el.querySelectorAll('img, video, canvas').forEach((m) => {
                    m.removeAttribute('src');
                    m.hidden = true;
                    m.style.display = 'none';
                });
            });
            const img = idoc?.getElementById('portImg');
            if (img) {
                // Exact ST still — no cover-crop inventing a left-edge peek.
                img.style.objectFit = 'contain';
                img.style.objectPosition = 'center top';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.background = '#000';
                if (avatar) {
                    const still = avatarUrl(avatar);
                    img.dataset.orig = still;
                    img.src = `${still}?t=${Date.now()}`;
                }
            }
        } catch (e) {
            console.warn(`[${MODULE}] could not clear portrait peeks`, e);
        }
        const verb = existed ? 'Opened existing' : 'Linked new';
        const idleN = (card.data.extensions.companion_stage.media || []).filter((m) => (m.type || 'idle') === 'idle').length;
        const clipNote = wired.added ? ` · Idles ${idleN}` : idleN ? ` · Idles ${idleN}` : '';
        setStatus(`${verb} ${card.data.name} · ${id} · ST ${avatar}${clipNote}`);
        toast(
            'success',
            existed
                ? `Opened existing ${card.data.name}${idleN ? ` · ${idleN} idles` : ''} (not a duplicate)`
                : `Opened ${card.data.name}${idleN ? ` · ${idleN} idles` : ''}`,
        );
    } catch (e) {
        console.error(`[${MODULE}] load failed`, e);
        setStatus("Couldn't open that card.");
        toast('error', `Couldn't open that card: ${e?.message || e}`);
    }
}

/* ---------------- Save to SillyTavern ---------------- */
async function galleryFolders() {
    try {
        const f = await api('/api/images/folders', {});
        return Array.isArray(f) ? f : [];
    } catch {
        return [];
    }
}

async function galleryImages(folder) {
    try {
        const list = await api('/api/images/list', { folder, sortField: 'date', sortOrder: 'desc' });
        return (Array.isArray(list) ? list : [])
            .map((x) => (typeof x === 'string' ? x : x?.name || x?.file || ''))
            .filter((n) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(n))
            .map((n) => `/user/images/${encodeURIComponent(folder)}/${encodeURIComponent(n)}`);
    } catch {
        return [];
    }
}

async function openSaveDialog() {
    let h;
    try {
        h = await waitForHook(5000);
    } catch (e) {
        toast('warning', e.message);
        return;
    }
    const id = h.activeId();
    const name = h.cardName() || 'Unnamed';
    let linked = linkedAvatar(id);
    // Also honour stAvatar stamped on the open Claude card.
    if (!linked) {
        try {
            const stamped = JSON.parse(h.exportJson())?.data?.extensions?.companion_stage?.stAvatar;
            if (stamped && ctx().characters?.some((c) => c.avatar === stamped)) linked = stamped;
        } catch {
            /* ignore */
        }
    }
    if (!linked) {
        const hit = (ctx().characters || []).find((c) => normName(c.name) === normName(name));
        if (hit?.avatar) linked = hit.avatar;
    }
    const sameName = (ctx().characters || []).filter((c) => c.name === name && c.avatar !== linked).map((c) => c.avatar);
    const portrait = String(h.portrait() || '');
    const quick = [];
    if (linked) quick.push({ label: 'Her current ST picture', src: avatarUrl(linked) });
    if (portrait && (portrait.startsWith('/') || portrait.startsWith('data:image')) && !portrait.startsWith('/_blob/') && portrait !== (linked && avatarUrl(linked))) {
        quick.push({ label: 'Creator portrait', src: portrait });
    }
    const folders = await galleryFolders();
    const s = settings();
    const startFolder = folders.includes(s.folder) ? s.folder : folders.find((f) => f.toLowerCase() === name.toLowerCase()) || folders[0] || '';
    const targets = [
        ...(linked ? [{ v: linked, t: `Update ${linked}` }] : []),
        { v: '', t: 'New card' },
        ...sameName.map((a) => ({ v: a, t: `Replace ${a} (same name)` })),
    ];

    const m = modal(
        'Save to SillyTavern',
        `<p class="stcc-note">Saves <b>${esc(name)}</b> as a chara_card_v2 PNG. All creator data stays inside the card (companion_stage). Nothing is posted to any chat.</p>
         <label class="stcc-row">Where<select id="stcc-target">${targets.map((t) => `<option value="${esc(t.v)}">${esc(t.t)}</option>`).join('')}</select></label>
         <div class="stcc-pick">
            <div class="stcc-preview"><img id="stcc-preview" alt="Chosen picture"><span id="stcc-preview-none">Pick a picture →</span></div>
            <div class="stcc-pick-src">
                ${quick.length ? `<div class="stcc-quick">${quick.map((q, i) => `<button type="button" class="stcc-tile small" data-src-i="${i}"><img src="${esc(q.src)}" alt=""><span>${esc(q.label)}</span></button>`).join('')}</div>` : ''}
                <label class="stcc-row">Her pictures<select id="stcc-folder">
                    <option value="">— gallery folder —</option>
                    ${folders.map((f) => `<option value="${esc(f)}"${f === startFolder ? ' selected' : ''}>${esc(f)}</option>`).join('')}
                    <option value="__chars__">Character pictures</option>
                </select></label>
                <div class="stcc-grid small" id="stcc-gallery"></div>
                <label class="stcc-file"><i class="fa-solid fa-upload"></i> From this PC…<input type="file" id="stcc-file" accept="image/*" hidden></label>
            </div>
         </div>
         <div class="stcc-actions"><span id="stcc-save-msg" class="stcc-note"></span><button type="button" class="stcc-primary" id="stcc-do-save" disabled><i class="fa-solid fa-floppy-disk"></i> Save</button></div>`,
    );

    let chosen = null;
    const prev = m.querySelector('#stcc-preview');
    const none = m.querySelector('#stcc-preview-none');
    const btn = m.querySelector('#stcc-do-save');
    const choose = (src, label) => {
        chosen = src;
        if (prev.dataset.blob) URL.revokeObjectURL(prev.dataset.blob);
        prev.src = src instanceof Blob ? (prev.dataset.blob = URL.createObjectURL(src)) : src;
        prev.title = label || '';
        none.hidden = true;
        btn.disabled = false;
    };
    if (quick[0]) choose(quick[0].src, quick[0].label);
    m.querySelectorAll('[data-src-i]').forEach((b) => b.addEventListener('click', () => choose(quick[+b.dataset.srcI].src, quick[+b.dataset.srcI].label)));

    const gallery = m.querySelector('#stcc-gallery');
    const paintFolder = async (folder) => {
        gallery.innerHTML = folder ? '<span class="stcc-note">Loading…</span>' : '';
        if (!folder) return;
        const urls =
            folder === '__chars__'
                ? (ctx().characters || []).filter((c) => c.avatar).map((c) => avatarUrl(c.avatar))
                : await galleryImages(folder);
        gallery.innerHTML = urls.length
            ? urls.slice(0, 200).map((u) => `<button type="button" class="stcc-tile small" data-url="${esc(u)}"><img loading="lazy" src="${esc(u)}" alt=""></button>`).join('')
            : '<span class="stcc-note">No pictures in this folder.</span>';
    };
    gallery.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-url]');
        if (t) choose(t.dataset.url, decodeURIComponent(t.dataset.url.split('/').pop()));
    });
    const folderSel = m.querySelector('#stcc-folder');
    folderSel.addEventListener('change', () => {
        if (folderSel.value !== '__chars__') {
            s.folder = folderSel.value;
            saveSettings();
        }
        paintFolder(folderSel.value);
    });
    paintFolder(folderSel.value);
    m.querySelector('#stcc-file').addEventListener('change', (ev) => {
        const f = ev.target.files?.[0];
        if (f) choose(f, f.name);
    });

    btn.addEventListener('click', async () => {
        const target = m.querySelector('#stcc-target').value;
        const msg = m.querySelector('#stcc-save-msg');
        btn.disabled = true;
        msg.textContent = 'Saving…';
        try {
            const file = await saveToSt({ hook: h, id, target, picture: chosen });
            closeModal();
            toast('success', `Saved ${name} → ${file}`);
            setStatus(`Saved ${name} → ${file}`);
        } catch (e) {
            console.error(`[${MODULE}] save failed`, e);
            msg.textContent = `Couldn't save: ${e?.message || e}`;
            btn.disabled = false;
        }
    });
}

async function saveToSt({ hook: h, id, target, picture }) {
    if (!picture) throw new Error('Pick a picture first.');
    const card = JSON.parse(h.exportJson());
    if (card?.spec !== 'chara_card_v2' || !card.data?.name) throw new Error('The creator returned an unexpected card.');
    card.data.extensions = card.data.extensions || {};
    if (!card.data.extensions.companion_stage) throw new Error('The card is missing its companion_stage block.');
    // Always stamp the ST avatar we are writing so the next Load finds this same Claude card.
    if (target) card.data.extensions.companion_stage.stAvatar = target;

    const old = target ? await getStChar(target) : null;
    if (target) await backupStPng(target);

    const png = pngWithChara(await imageToPng(picture), JSON.stringify(card));
    const fd = new FormData();
    fd.append('avatar', new File([png], `${slug(card.data.name)}.png`, { type: 'image/png' }));
    fd.append('file_type', 'png');
    if (target) fd.append('preserved_name', target);
    const res = await fetch('/api/characters/import', {
        method: 'POST',
        headers: ctx().getRequestHeaders({ omitContentType: true }),
        body: fd,
        cache: 'no-cache',
    });
    if (!res.ok) throw new Error(`SillyTavern refused the card (${res.status})`);
    const out = await res.json();
    if (out?.error || !out?.file_name) throw new Error('SillyTavern could not read the card.');
    const avatar = `${out.file_name}.png`;

    // Import clears the chat pointer and favourite; put them back on an update.
    if (old) {
        const restore = { avatar, data: { extensions: { fav: old.data?.extensions?.fav ?? old.fav ?? false } }, fav: old.fav ?? false };
        if (old.chat) restore.chat = old.chat;
        if (old.create_date) restore.create_date = old.create_date;
        await api('/api/characters/merge-attributes', restore).catch((e) => console.warn(`[${MODULE}] restore chat link failed`, e));
    }

    settings().links[id] = avatar;
    for (const [otherId, a] of Object.entries(settings().links)) {
        if (a === avatar && otherId !== id) delete settings().links[otherId];
    }
    saveSettings();
    try {
        h.stampStAvatar?.(avatar);
    } catch (e) {
        console.warn(`[${MODULE}] could not restamp stAvatar after save`, e);
    }
    await ctx().getCharacters?.();
    return avatar;
}

/* ---------------- boot ---------------- */
function registerWithDuet() {
    const api = window.DuetStage;
    if (typeof api?.registerPanel !== 'function') return false;
    if (api.listPanels?.().includes(PANEL_NAME)) return true;
    return api.registerPanel(PANEL_NAME, () => openCreator(), PANEL_NAME);
}

function boot() {
    settings();
    window.StCardCreator = { open: openCreator, load: loadFromSt, version: VERSION };
    bootPanels();
    let tries = 0;
    const tick = setInterval(() => {
        tries += 1;
        const reg = registerWithDuet();
        ensureLaunchers();
        // Give st-duet-stage ~6s to show up; after that, run on our own panel.
        if (!reg && !panel() && tries >= 12) ensureStandalonePanel();
        ensureTab();
        if ((reg && panel()) || tries > 120) clearInterval(tick);
    }, 500);
    try {
        wireStageEvents();
    } catch (e) {
        console.warn(`[${MODULE}] stage events`, e);
    }
    new MutationObserver(() => {
        const el = panel();
        if (el && !el.querySelector('#stcc-tabs')) ensureTab();
        if (el && !el.querySelector('#stcc-stage')) renderStage();
    }).observe(document.body, { childList: true });
}

jQuery(() => boot());
