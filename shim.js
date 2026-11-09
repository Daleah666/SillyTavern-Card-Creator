/*
 * Runs inside the creator iframe before any creator script. Stands in for claude.ai's
 * window.claude runtime using the SillyTavern host (window.parent.__stcc):
 *   sample    -> ST generateRaw on the current connection (never touches the chat)
 *   db        -> Firestore-style API persisted in IndexedDB "st-card-creator"
 *   assets    -> uploads into ST user images ("Card creator" folder)
 *   downloads -> browser download
 * localStorage is swapped for a private IndexedDB-backed store so the creator's many
 * "redz-*" keys can't fill SillyTavern's shared localStorage quota.
 * Everything crossing from the host is a string, so objects stay in this realm.
 */
(function () {
    'use strict';
    let host = null;
    try {
        host = window.parent !== window ? window.parent.__stcc : null;
    } catch {
        host = null;
    }
    if (!host) {
        console.warn('[card creator] Not opened from SillyTavern: AI, saving and the database are off.');
        return;
    }

    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    const fail = (code, message) => Object.assign(new Error(message), { code });

    /* ---------- localStorage ---------- */
    const ls = new Map(Object.entries(JSON.parse(host.lsSnapshot() || '{}')));
    const lsApi = {
        getItem: (k) => (ls.has(String(k)) ? ls.get(String(k)) : null),
        setItem: (k, v) => {
            k = String(k);
            v = String(v);
            ls.set(k, v);
            host.lsPut(k, v);
        },
        removeItem: (k) => {
            k = String(k);
            if (ls.delete(k)) host.lsDel(k);
        },
        clear: () => {
            for (const k of ls.keys()) host.lsDel(k);
            ls.clear();
        },
        key: (i) => [...ls.keys()][i] ?? null,
        get length() {
            return ls.size;
        },
    };
    const storage = new Proxy(lsApi, {
        get: (t, p) => (p in t ? t[p] : typeof p === 'string' && ls.has(p) ? ls.get(p) : undefined),
        set: (t, p, v) => (p in t ? false : (lsApi.setItem(p, v), true)),
        deleteProperty: (t, p) => (lsApi.removeItem(p), true),
        has: (t, p) => p in t || ls.has(p),
        ownKeys: () => [...ls.keys()],
        getOwnPropertyDescriptor: (t, p) =>
            ls.has(p) ? { value: ls.get(p), enumerable: true, configurable: true, writable: true } : undefined,
    });
    try {
        Object.defineProperty(window, 'localStorage', { configurable: true, get: () => storage });
    } catch (e) {
        console.warn('[card creator] Could not isolate localStorage; using the shared one.', e);
    }

    /* ---------- db: a small Firestore look-alike ---------- */
    const docs = new Map(Object.entries(JSON.parse(host.docsSnapshot() || '{}')).map(([p, j]) => [p, JSON.parse(j)]));
    const listeners = new Set();
    const colOf = (path) => path.slice(0, path.lastIndexOf('/'));
    const idOf = (path) => path.slice(path.lastIndexOf('/') + 1);
    const autoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const getField = (o, f) => String(f).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
    const cmp = (a, b) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a < b ? -1 : 1);

    function docSnap(path) {
        const has = docs.has(path);
        const data = has ? docs.get(path) : undefined;
        return {
            id: idOf(path),
            exists: has,
            ref: docRef(path),
            data: () => clone(data),
            get: (f) => clone(getField(data, f)),
        };
    }

    function test(d, [f, op, v]) {
        const x = getField(d, f);
        switch (op) {
            case '==': return x === v;
            case '!=': return x !== v;
            case '<': return x < v;
            case '<=': return x <= v;
            case '>': return x > v;
            case '>=': return x >= v;
            case 'array-contains': return Array.isArray(x) && x.includes(v);
            case 'array-contains-any': return Array.isArray(x) && Array.isArray(v) && v.some((y) => x.includes(y));
            case 'in': return Array.isArray(v) && v.includes(x);
            case 'not-in': return Array.isArray(v) && !v.includes(x);
            default: return false;
        }
    }

    function runQuery(col, spec) {
        let rows = [...docs.keys()].filter((p) => colOf(p) === col && spec.where.every((w) => test(docs.get(p), w)));
        if (spec.order) {
            const [f, dir] = spec.order;
            rows.sort((a, b) => cmp(getField(docs.get(a), f), getField(docs.get(b), f)) * (dir === 'desc' ? -1 : 1));
        }
        if (spec.lim != null) rows = rows.slice(0, spec.lim);
        const list = rows.map(docSnap);
        return { docs: list, size: list.length, empty: !list.length, forEach: (fn) => list.forEach(fn) };
    }

    function fire(l) {
        try {
            l.cb(l.path ? docSnap(l.path) : runQuery(l.col, l.spec));
        } catch (e) {
            try { l.onErr?.(e); } catch { /* listener error */ }
        }
    }

    function changed(path) {
        const col = colOf(path);
        setTimeout(() => {
            for (const l of listeners) if (l.path === path || l.col === col) fire(l);
        }, 0);
    }

    function write(path, data) {
        docs.set(path, clone(data));
        host.docPut(path, JSON.stringify(data));
        changed(path);
    }

    function listen(l) {
        listeners.add(l);
        setTimeout(() => fire(l), 0);
        return () => listeners.delete(l);
    }

    function docRef(path) {
        path = String(path).replace(/^\/+|\/+$/g, '');
        return {
            id: idOf(path),
            path,
            get: async () => docSnap(path),
            set: async (data, opts) => write(path, opts && opts.merge && docs.has(path) ? { ...docs.get(path), ...clone(data) } : data),
            update: async (patch) => {
                if (!docs.has(path)) throw fail('not-found', `No document to update: ${path}`);
                const next = clone(docs.get(path));
                for (const [k, v] of Object.entries(patch || {})) {
                    const keys = k.split('.');
                    let o = next;
                    for (const key of keys.slice(0, -1)) o = o[key] && typeof o[key] === 'object' ? o[key] : (o[key] = {});
                    o[keys[keys.length - 1]] = clone(v);
                }
                write(path, next);
            },
            delete: async () => {
                if (docs.delete(path)) {
                    host.docDel(path);
                    changed(path);
                }
            },
            onSnapshot: (cb, onErr) => listen({ path, cb, onErr }),
            collection: (sub) => query(`${path}/${sub}`),
        };
    }

    function query(col, spec = { where: [], order: null, lim: null }) {
        col = String(col).replace(/^\/+|\/+$/g, '');
        const next = (p) => query(col, { ...spec, ...p });
        return {
            where: (f, op, v) => next({ where: [...spec.where, [f, op, v]] }),
            orderBy: (f, dir = 'asc') => next({ order: [f, dir] }),
            limit: (n) => next({ lim: Number(n) }),
            get: async () => runQuery(col, spec),
            onSnapshot: (cb, onErr) => listen({ col, spec, cb, onErr }),
            doc: (id) => docRef(`${col}/${id ?? autoId()}`),
            add: async (data) => {
                const ref = docRef(`${col}/${autoId()}`);
                await ref.set(data);
                return ref;
            },
        };
    }

    const db = { collection: (name) => query(name), doc: (path) => docRef(path) };

    /* ---------- sample: AI through SillyTavern's current connection ---------- */
    function promptText(p) {
        if (typeof p === 'string') return p;
        if (Array.isArray(p)) {
            return p
                .map((m) => (typeof m === 'string' ? m : typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.map((c) => c?.text || '').join('\n') : ''))
                .join('\n\n');
        }
        if (p && typeof p === 'object') return String(p.prompt ?? p.text ?? JSON.stringify(p));
        return String(p ?? '');
    }

    function parseJsonLoose(text) {
        let t = String(text || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/```(?:json)?/gi, '')
            .trim();
        const start = t.search(/[[{]/);
        if (start < 0) throw fail('parse', 'The AI reply had no JSON in it.');
        const close = t[start] === '{' ? '}' : ']';
        const end = t.lastIndexOf(close);
        let body = end > start ? t.slice(start, end + 1) : t.slice(start);
        const tries = [
            (s) => s,
            (s) => s.replace(/,\s*([}\]])/g, '$1'),
            (s) => s.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/,\s*([}\]])/g, '$1'),
        ];
        for (const fix of tries) {
            try {
                return JSON.parse(fix(body));
            } catch { /* next */ }
        }
        throw fail('parse', "The AI reply wasn't valid JSON. Try again, or pick a stronger model in SillyTavern.");
    }

    async function run(prompt, opts, json) {
        opts = opts || {};
        if (opts.signal?.aborted) throw fail('aborted', 'Stopped');
        let text;
        try {
            text = await host.generate(promptText(prompt), json);
        } catch (e) {
            throw fail(e?.code || 'ai', e?.message || String(e));
        }
        if (opts.signal?.aborted) throw fail('aborted', 'Stopped');
        try { opts.onText?.(text); } catch { /* progress hook */ }
        return json ? parseJsonLoose(text) : text;
    }

    const sample = (prompt, opts) => run(prompt, opts, false);
    sample.json = (prompt, opts) => run(prompt, opts, true);
    sample.limits = async () => ({ images: false, tools: false, provider: 'SillyTavern' });

    /* ---------- assets + downloads ---------- */
    const toB64 = (file) =>
        new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result).split(',')[1] || '');
            r.onerror = () => rej(r.error);
            r.readAsDataURL(file);
        });

    const assets = {
        upload: async (file) => {
            const b64 = await toB64(file);
            return JSON.parse(await host.uploadAsset(String(file.name || 'upload'), String(file.type || ''), b64));
        },
        list: async () => [],
    };

    const downloads = {
        save: async ({ filename, data, mime }) => {
            const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(a.href);
                a.remove();
            }, 1000);
        },
    };

    const CAPS = { sample, db, assets, downloads };
    window.claude = { use: async (name) => CAPS[name] || null, host: 'SillyTavern' };

    window.__stcc = {
        hook(h) {
            host.setHook({
                exportJson: () => h.exportJson(),
                activeId: () => h.activeId(),
                cardName: () => h.cardName(),
                portrait: () => h.portrait(),
                listChars: () => (typeof h.listChars === 'function' ? h.listChars() : []),
                peekCardJson: (id) => (typeof h.peekCardJson === 'function' ? h.peekCardJson(id) : ''),
                stampStAvatar: (avatar) => (typeof h.stampStAvatar === 'function' ? !!h.stampStAvatar(avatar) : false),
                forgetChar: (id) => (typeof h.forgetChar === 'function' ? !!h.forgetChar(id) : false),
                loadCardJson: (id, json) => h.loadCard(String(id), JSON.parse(json)),
            });
        },
    };
})();
