/**
 * Elfheim sheet: one D&D number set for an RPG character or an isekai roleplay.
 * The side tab and the card creator both read and write this shape.
 * Numbers follow the fifth-edition modifier and proficiency rules.
 */

export const ABS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const LOOKS = [
    {
        id: 'lunara',
        file: 'lunara.webp',
        filled: true,
        name: 'Lunara Moonwhisper',
        frame: 'isekai',
        title: 'The Naive Temptress',
        race: 'Night Elf (Corrupted)',
        className: 'Sorcerer',
        sub: 'Damsel of Delight',
        level: '69',
        bg: 'Sage',
        align: 'Chaotic neutral',
        passive: 'Bimbofied: My body is a temple... please come worship.',
        status: 'Free',
        origin: 'Once a powerful mage, now a giggling, busty plaything who accidentally summoned her own pleasure artifacts.',
        scores: { str: 8, dex: 14, con: 12, int: 9, wis: 6, cha: 25 },
        skills: 'Arcana, Persuasion, Insight',
        feats: 'Seduction: +15; Arcane Pleasure: +12; Gullibility: +20',
    },
    {
        id: 'damsel',
        file: 'damsel.webp',
        filled: true,
        name: 'Damsel',
        frame: 'isekai',
        title: 'Damsel',
        className: 'Bard',
        level: '5',
        hp: '120',
        mp: '45',
        passive: 'Helpless Gaze',
        status: 'Captive',
        origin: 'A level 5 damsel. The system window lists her as captive, and Helpless Gaze is the only passive on her plaque.',
        scores: { str: 8, int: 3, wis: 2, cha: 18 },
        skills: 'Persuasion, Performance, Deception',
    },
    { id: 'green', file: 'green.webp', filled: false, name: '' },
    { id: 'horned', file: 'horned.webp', filled: false, name: '' },
    { id: 'cap', file: 'cap.webp', filled: false, name: '' },
];

export const RACES = [
    { id: 'nightelf', label: 'Night elf', dnd: 'Night Elf', speed: '30 ft' },
    { id: 'elf', label: 'Elf', dnd: 'High Elf', speed: '30 ft' },
    { id: 'summoned', label: 'Summoned heroine', dnd: 'Human (summoned)', speed: '30 ft' },
    { id: 'demon', label: 'Demon', dnd: 'Tiefling', speed: '30 ft' },
];

export const CLASSES = [
    { id: 'sorcerer', label: 'Sorcerer', dnd: 'Sorcerer', die: 6, skills: 'Arcana, Persuasion, Insight' },
    { id: 'bard', label: 'Damsel (Bard)', dnd: 'Bard', die: 8, skills: 'Persuasion, Performance, Deception' },
    { id: 'warlock', label: 'Warlock', dnd: 'Warlock', die: 8, skills: 'Arcana, Deception, Intimidation' },
    { id: 'wizard', label: 'Wizard', dnd: 'Wizard', die: 6, skills: 'Arcana, History, Investigation' },
    { id: 'rogue', label: 'Rogue', dnd: 'Rogue', die: 8, skills: 'Stealth, Sleight of Hand, Perception' },
    { id: 'cleric', label: 'Cleric', dnd: 'Cleric', die: 8, skills: 'Insight, Medicine, Religion' },
];

export const BACKGROUNDS = [
    { id: 'sage', label: 'Sage', dnd: 'Sage' },
    { id: 'acolyte', label: 'Acolyte', dnd: 'Acolyte' },
    { id: 'noble', label: 'Noble', dnd: 'Noble' },
    { id: 'urchin', label: 'Urchin', dnd: 'Urchin' },
    { id: 'outlander', label: 'Isekai arrival', dnd: 'Outlander' },
    { id: 'folk', label: 'Folk hero', dnd: 'Folk Hero' },
];

export const ALIGNMENTS = [
    'Lawful good', 'Neutral good', 'Chaotic good',
    'Lawful neutral', 'Neutral', 'Chaotic neutral',
    'Lawful evil', 'Neutral evil', 'Chaotic evil',
];

/** Profile keys the Elfheim tab is allowed to write. Other profile fields stay put. */
export const SHEET_KEYS = [
    'rpg_mode', 'dnd_race', 'dnd_class', 'dnd_sub', 'dnd_level', 'dnd_bg', 'dnd_align',
    'dnd_str', 'dnd_dex', 'dnd_con', 'dnd_int', 'dnd_wis', 'dnd_cha',
    'dnd_hp', 'dnd_ac', 'dnd_speed', 'dnd_skills', 'dnd_feats', 'dnd_spells', 'dnd_gear',
];

export const BEATS = {
    rpg: [
        {
            id: 'road',
            title: 'The Elfheim road',
            ability: 'dex',
            skill: 'Stealth',
            dc: 12,
            ok: { status: 'Unseen', text: 'She keeps to the trees and the road does not see her.' },
            fail: { status: 'Winded', hp: -4, text: 'A branch snaps. Something on the road turns, and she takes the brunt of it.' },
        },
        {
            id: 'shrine',
            title: 'The moon shrine',
            ability: 'int',
            skill: 'Arcana',
            dc: 13,
            ok: { status: 'Blessed', text: 'The shrine answers. A cool mark settles, and the road ahead is blessed.' },
            fail: { status: 'Marked', text: 'The shrine takes an offering she did not mean to give. She is marked.' },
        },
        {
            id: 'gate',
            title: 'The gate',
            ability: 'cha',
            skill: 'Persuasion',
            dc: 14,
            ok: { status: 'Welcomed', text: 'The gate wardens hear her out and let her through.' },
            fail: { status: 'Turned away', hp: -2, text: 'The gate stays shut. She is turned away, bruised and still outside.' },
        },
    ],
    isekai: [
        {
            id: 'bonds',
            title: 'The captive mark',
            ability: 'cha',
            skill: 'Persuasion',
            dc: 13,
            ok: { status: 'Free', text: 'She talks the mark into letting go. Status: Free.' },
            fail: { status: 'Captive', hp: -3, text: 'The mark tightens. Status: Captive.' },
        },
        {
            id: 'window',
            title: 'System window',
            ability: 'int',
            skill: 'Arcana',
            dc: 11,
            ok: { status: 'Appraised', text: 'A window opens over her head and reads her sheet back to her.' },
            fail: { status: 'Glitched', hp: -1, text: 'The window stutters and shows the wrong line.' },
        },
        {
            id: 'skill',
            title: 'Skill unlock',
            ability: 'wis',
            skill: 'Insight',
            dc: 12,
            ok: { status: 'Awake', text: 'A skill slot blinks open. She understands the next step.' },
            fail: { status: 'Dazed', hp: -2, text: 'The unlock flares and misses. She is left dazed.' },
        },
    ],
};

const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function abilityMod(score) {
    const n = typeof score === 'number' ? score : parseInt(score, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.floor((n - 10) / 2);
}

export function fmtMod(n) {
    const v = Number(n) || 0;
    return v >= 0 ? `+${v}` : String(v);
}

export function proficiency(level) {
    const lv = Math.max(1, parseInt(level, 10) || 1);
    return 2 + Math.floor((lv - 1) / 4);
}

/** Blank MP displays as 4 + INT modifier × level, and never below 1. */
export function derivedMp(profile) {
    const level = Math.max(1, parseInt(profile?.dnd_level, 10) || 1);
    return Math.max(1, 4 + abilityMod(profile?.dnd_int) * level);
}

export function mpShown(profile, elfheim) {
    const raw = elfheim?.mp;
    if (raw !== '' && raw != null) return { text: String(raw), derived: false };
    return { text: String(derivedMp(profile || {})), derived: true };
}

export function suggestedHp(hitDie, level, conScore) {
    const die = Math.max(1, parseInt(hitDie, 10) || 8);
    const lv = Math.max(1, parseInt(level, 10) || 1);
    const con = abilityMod(conScore);
    const per = Math.floor(die / 2) + 1 + con;
    return Math.max(1, die + con + (lv - 1) * per);
}

export function maxHp(profile) {
    const n = parseInt(profile?.dnd_hp, 10);
    return Number.isFinite(n) ? n : null;
}

export function currentHp(profile, elfheim) {
    const max = maxHp(profile);
    if (elfheim?.hp !== '' && elfheim?.hp != null) {
        const n = parseInt(elfheim.hp, 10);
        if (Number.isFinite(n)) return n;
    }
    return max;
}

export function blankElfheim() {
    return { frame: 'isekai', title: '', passive: '', status: '', origin: '', mp: '', look: '', log: [], beat: 0, hp: '' };
}

export function normalizeElfheim(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const elf = { ...blankElfheim(), ...src };
    elf.frame = elf.frame === 'rpg' ? 'rpg' : 'isekai';
    elf.title = String(elf.title || '').slice(0, 80);
    elf.passive = String(elf.passive || '').slice(0, 160);
    elf.status = String(elf.status || '').slice(0, 40);
    elf.origin = String(elf.origin || '').slice(0, 600);
    elf.mp = elf.mp == null ? '' : String(elf.mp).replace(/[^\d]/g, '').slice(0, 6);
    elf.look = String(elf.look || '');
    elf.log = Array.isArray(elf.log) ? elf.log.map((line) => String(line)).slice(-40) : [];
    elf.beat = Math.max(0, parseInt(elf.beat, 10) || 0);
    elf.hp = elf.hp == null || elf.hp === '' ? '' : String(Math.max(0, parseInt(elf.hp, 10) || 0));
    return elf;
}

export function blankView() {
    return {
        source: 'empty',
        avatar: '',
        id: '',
        name: '',
        portrait: '',
        ownPortrait: '',
        profile: { rpg_mode: 'elfheim' },
        elfheim: blankElfheim(),
        note: '',
    };
}

export function viewFromCard(raw) {
    const view = blankView();
    view.source = raw?.source || 'empty';
    view.avatar = raw?.avatar || '';
    view.id = raw?.id || '';
    view.name = raw?.name || '';
    view.portrait = raw?.portrait || '';
    view.ownPortrait = raw?.ownPortrait || raw?.portrait || '';
    view.profile = { rpg_mode: 'elfheim', ...(raw?.profile || {}) };
    view.elfheim = normalizeElfheim(raw?.elfheim);
    view.note = raw?.note || '';
    return view;
}

export function sheetPatch(view) {
    const profile = {};
    for (const key of SHEET_KEYS) {
        if (view.profile?.[key] !== undefined) profile[key] = view.profile[key];
    }
    profile.rpg_mode = 'elfheim';
    return {
        profile,
        elfheim: normalizeElfheim(view.elfheim),
        name: String(view.name || '').slice(0, 80),
        portrait: view.portrait || '',
        rpg_mode: 'elfheim',
        addRpg: true,
    };
}

export function lookById(id) {
    return LOOKS.find((look) => look.id === id) || null;
}

export function applyLook(sheet, look) {
    const next = viewFromCard(sheet);
    next.elfheim.look = look.id;
    if (!look.filled) return next;
    if (look.name) next.name = look.name;
    next.elfheim.frame = look.frame === 'rpg' ? 'rpg' : 'isekai';
    next.elfheim.title = look.title || '';
    next.elfheim.passive = look.passive || '';
    next.elfheim.status = look.status || '';
    next.elfheim.origin = look.origin || '';
    next.elfheim.mp = look.mp != null ? String(look.mp) : '';
    next.elfheim.log = [];
    next.elfheim.beat = 0;
    next.elfheim.hp = '';
    next.profile.dnd_race = look.race || '';
    next.profile.dnd_class = look.className || '';
    next.profile.dnd_sub = look.sub || '';
    next.profile.dnd_level = look.level ? String(look.level) : '';
    next.profile.dnd_bg = look.bg || '';
    next.profile.dnd_align = look.align || '';
    next.profile.dnd_hp = look.hp ? String(look.hp) : '';
    next.profile.dnd_ac = '';
    next.profile.dnd_speed = '';
    next.profile.dnd_skills = look.skills || '';
    next.profile.dnd_feats = look.feats || '';
    next.profile.dnd_spells = '';
    next.profile.dnd_gear = '';
    for (const ab of ABS) {
        const score = look.scores?.[ab];
        next.profile[`dnd_${ab}`] = score == null ? '' : String(score);
    }
    return next;
}

export function raceIdFrom(profile) {
    return RACES.find((race) => race.dnd === profile?.dnd_race)?.id || '';
}

export function classIdFrom(profile) {
    return CLASSES.find((item) => item.dnd === profile?.dnd_class)?.id || '';
}

export function bgIdFrom(profile) {
    return BACKGROUNDS.find((item) => item.dnd === profile?.dnd_bg)?.id || '';
}

function field(name, label, value, max, extra = '') {
    return `<label class="elf-lab"><span>${label}</span><input data-elf="${name}" maxlength="${max}" value="${esc(value || '')}"${extra}></label>`;
}

function select(name, label, options, current) {
    return `<label class="elf-lab"><span>${label}</span><select data-pick="${name}">${options}</select></label>`;
}

function optionList(list, currentId, currentText) {
    const known = list.some((item) => item.id === currentId);
    const head = !known && currentText ? `<option value="" selected>${esc(currentText)}</option>` : '<option value="">Choose…</option>';
    return head + list.map((item) => `<option value="${esc(item.id)}"${item.id === currentId ? ' selected' : ''}>${esc(item.label)}</option>`).join('');
}

export function renderPanel(view, asset) {
    const profile = view.profile || {};
    const elf = normalizeElfheim(view.elfheim);
    const look = lookById(elf.look);
    const src = look ? asset(look.file) : (view.portrait || '');
    const mp = mpShown(profile, elf);
    const max = maxHp(profile);
    const cur = currentHp(profile, elf);
    const hpText = cur == null ? '–' : max == null || cur === max ? String(cur) : `${cur}/${max}`;
    const frame = elf.frame === 'rpg' ? 'rpg' : 'isekai';
    const beat = currentBeat(elf);
    const prof = proficiency(profile.dnd_level);
    const scores = ABS.map((ab) => {
        const raw = profile[`dnd_${ab}`];
        const mod = raw === '' || raw == null ? '–' : fmtMod(abilityMod(raw));
        return `<label class="elf-ab"><span>${ab.toUpperCase()}</span><input data-ab="${ab}" inputmode="numeric" maxlength="3" value="${esc(raw ?? '')}" aria-label="${ab.toUpperCase()}"><b>${mod}</b></label>`;
    }).join('');
    const looks = `<button type="button" data-look="own" aria-pressed="${elf.look ? 'false' : 'true'}">Keep hers</button>`
        + LOOKS.map((item) => `<button type="button" data-look="${item.id}" aria-pressed="${elf.look === item.id ? 'true' : 'false'}">${item.filled ? esc(item.name) : esc(item.id === 'green' ? 'Green elf' : item.id === 'horned' ? 'Horned girl' : 'Blonde cap')}</button>`).join('');
    const alignOpts = (!profile.dnd_align || ALIGNMENTS.includes(profile.dnd_align) ? '' : `<option selected>${esc(profile.dnd_align)}</option>`)
        + ALIGNMENTS.map((name) => `<option${name === profile.dnd_align ? ' selected' : ''}>${esc(name)}</option>`).join('');
    const check = beat
        ? `<p class="elf-beat"><b>${esc(beat.title)}</b> ${beat.ability.toUpperCase()} ${fmtMod(abilityMod(profile[`dnd_${beat.ability}`]))}${proficient(profile, beat.skill) ? ` ${fmtMod(prof)} prof` : ''} vs DC ${beat.dc}</p><button type="button" class="elf-go" data-act="check">Roll ${esc(beat.skill)}</button>`
        : `<p class="elf-beat">The road is quiet.</p><button type="button" data-act="again">Walk it again</button>`;
    const where = view.source === 'st' || view.source === 'hook'
        ? 'This writes onto her card.'
        : 'No character is open. Confirm keeps a draft in this browser until one is.';
    return `<div class="elf-panel">
        <figure class="elf-plaque">
            ${src ? `<img src="${esc(src)}" alt="" width="150">` : '<div class="elf-ph">No portrait</div>'}
            <figcaption>
                <b data-show="name">${esc(view.name || 'Unnamed')}</b>
                <small data-show="title">${esc(elf.title || (frame === 'rpg' ? 'RPG character' : 'Isekai'))}</small>
                <span class="elf-line">${esc(profile.dnd_race || 'Race')} · ${esc(profile.dnd_class || 'Class')} · LVL ${esc(profile.dnd_level || '1')}</span>
                <span class="elf-line">HP ${esc(hpText)} · MP ${esc(mp.text)}${mp.derived ? ' derived' : ''}</span>
                <span class="elf-line" data-show="passive">Passive: ${esc(elf.passive || 'none')}</span>
                <span class="elf-line" data-show="status">Status: ${esc(elf.status || 'none')}</span>
            </figcaption>
        </figure>
        ${elf.origin ? `<p class="elf-origin">${esc(elf.origin)}</p>` : ''}
        <p class="elf-step">1. Look</p>
        <div class="elf-row">${looks}</div>
        <p class="elf-step">2. Frame</p>
        <div class="elf-row" role="group" aria-label="Elfheim frame">
            <button type="button" data-frame="rpg" aria-pressed="${frame === 'rpg' ? 'true' : 'false'}">RPG character</button>
            <button type="button" data-frame="isekai" aria-pressed="${frame === 'isekai' ? 'true' : 'false'}">Isekai</button>
        </div>
        <p class="elf-step">3. Scores</p>
        <div class="elf-row">
            <button type="button" data-act="array">Standard array</button>
            <button type="button" data-act="roll">Roll 4d6</button>
        </div>
        <div class="elf-abs">${scores}</div>
        <p class="elf-step">4. Elfheim</p>
        ${field('name', 'Name', view.name, 80)}
        ${field('level', 'Level', profile.dnd_level || '', 3)}
        ${select('race', 'Race', optionList(RACES, raceIdFrom(profile), raceIdFrom(profile) ? '' : profile.dnd_race))}
        ${select('class', 'Class', optionList(CLASSES, classIdFrom(profile), classIdFrom(profile) ? '' : profile.dnd_class))}
        ${select('bg', 'Background', optionList(BACKGROUNDS, bgIdFrom(profile), bgIdFrom(profile) ? '' : profile.dnd_bg))}
        <label class="elf-lab"><span>Alignment</span><select data-elf="align"><option value="">Choose…</option>${alignOpts}</select></label>
        <p class="elf-step">5. Plaque</p>
        ${field('title', 'Title', elf.title, 80)}
        ${field('passive', 'Passive', elf.passive, 160)}
        ${field('status', 'Status', elf.status, 40)}
        ${field('mp', 'MP', elf.mp, 6, ' placeholder="blank derives from INT"')}
        <label class="elf-lab"><span>Origin</span><textarea data-elf="origin" maxlength="600" rows="3">${esc(elf.origin)}</textarea></label>
        <button type="button" class="elf-go" data-act="confirm">Confirm</button>
        <p class="elf-note">${esc(where)}</p>
        <p class="elf-step">${frame === 'rpg' ? 'Adventure' : 'System window'}</p>
        ${check}
        ${view.note ? `<p class="elf-note" data-show="note">${esc(view.note)}</p>` : ''}
        ${elf.log.length ? `<ol class="elf-log">${[...elf.log].reverse().map((line) => `<li>${esc(line)}</li>`).join('')}</ol>` : ''}
    </div>`;
}

const LIMITS = { name: 80, title: 80, passive: 160, status: 40, origin: 600, mp: 6, level: 3, align: 40 };

/** Copy the open form onto the view. Does not fill blanks. */
export function syncForm(root, view) {
    const profile = view.profile;
    const elf = view.elfheim;
    root.querySelectorAll('[data-elf]').forEach((el) => {
        const key = el.dataset.elf;
        const max = LIMITS[key] || 80;
        const value = String(el.value || '').slice(0, max);
        if (key === 'name') view.name = value;
        else if (key === 'level') profile.dnd_level = value.replace(/[^\d]/g, '').slice(0, 3);
        else if (key === 'align') profile.dnd_align = value;
        else if (key === 'mp') elf.mp = value.replace(/[^\d]/g, '').slice(0, 6);
        else if (key in LIMITS) elf[key] = value;
    });
    root.querySelectorAll('[data-ab]').forEach((el) => {
        const ab = el.dataset.ab;
        if (!ABS.includes(ab)) return;
        const n = String(el.value || '').replace(/[^\d]/g, '').slice(0, 3);
        profile[`dnd_${ab}`] = n;
    });
    const race = root.querySelector('[data-pick="race"]');
    const cls = root.querySelector('[data-pick="class"]');
    const bg = root.querySelector('[data-pick="bg"]');
    if (race?.value) {
        const hit = RACES.find((item) => item.id === race.value);
        if (hit) profile.dnd_race = hit.dnd;
    }
    if (cls?.value) {
        const hit = CLASSES.find((item) => item.id === cls.value);
        if (hit) profile.dnd_class = hit.dnd;
    }
    if (bg?.value) {
        const hit = BACKGROUNDS.find((item) => item.id === bg.value);
        if (hit) profile.dnd_bg = hit.dnd;
    }
    profile.rpg_mode = 'elfheim';
    view.elfheim = normalizeElfheim(elf);
}

/** Fill speed, skills, AC, and HP when the form left them blank. */
export function commitCreation(view) {
    const profile = view.profile;
    const race = RACES.find((item) => item.dnd === profile.dnd_race);
    const cls = CLASSES.find((item) => item.dnd === profile.dnd_class);
    if (race && !profile.dnd_speed) profile.dnd_speed = race.speed;
    if (cls && !profile.dnd_skills) profile.dnd_skills = cls.skills;
    const level = Math.max(1, parseInt(profile.dnd_level, 10) || 1);
    profile.dnd_level = String(level);
    if (!profile.dnd_ac) profile.dnd_ac = String(10 + abilityMod(profile.dnd_dex));
    if (!profile.dnd_hp && cls) profile.dnd_hp = String(suggestedHp(cls.die, level, profile.dnd_con));
    profile.rpg_mode = 'elfheim';
    view.elfheim = normalizeElfheim(view.elfheim);
}

export function rollAbility(rng = Math.random) {
    const dice = [0, 1, 2, 3].map(() => 1 + Math.floor(rng() * 6)).sort((a, b) => a - b);
    return { dice, dropped: dice[0], total: dice[1] + dice[2] + dice[3] };
}

export function rollScores(rng = Math.random) {
    return ABS.map(() => rollAbility(rng).total);
}

export function assignScores(profile, totals) {
    ABS.forEach((ab, i) => {
        profile[`dnd_${ab}`] = String(totals[i]);
    });
}

export function proficient(profile, skill) {
    const want = String(skill || '').trim().toLowerCase();
    if (!want) return false;
    return String(profile?.dnd_skills || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .includes(want);
}

export function rollCheck(profile, beat, rng = Math.random) {
    const die = 1 + Math.floor(rng() * 20);
    const mod = abilityMod(profile?.[`dnd_${beat.ability}`]);
    const prof = proficient(profile, beat.skill) ? proficiency(profile?.dnd_level) : 0;
    const total = die + mod + prof;
    return {
        die,
        mod,
        prof,
        total,
        dc: beat.dc,
        crit: die === 20,
        fum: die === 1,
        ok: die === 20 || (die !== 1 && total >= beat.dc),
    };
}

export function beatsFor(frame) {
    return BEATS[frame === 'rpg' ? 'rpg' : 'isekai'];
}

export function currentBeat(elfheim) {
    const list = beatsFor(elfheim?.frame);
    const index = Math.max(0, parseInt(elfheim?.beat, 10) || 0);
    return index < list.length ? list[index] : null;
}

export function applyBeat(sheet, beat, roll) {
    const side = roll.ok ? beat.ok : beat.fail;
    const elf = sheet.elfheim;
    const profile = sheet.profile;
    if (side.status) elf.status = side.status;
    if (side.hp) {
        const cur0 = currentHp(profile, elf);
        if (cur0 != null) elf.hp = String(Math.max(0, cur0 + side.hp));
    }
    const profBit = roll.prof ? ` ${fmtMod(roll.prof)} prof` : '';
    const hpNow = currentHp(profile, elf);
    const hpBit = hpNow == null ? '' : ` HP ${hpNow}.`;
    const line = `${beat.title}: ${roll.die} ${fmtMod(roll.mod)}${profBit} = ${roll.total} vs DC ${beat.dc}. ${side.text}${hpBit}`;
    elf.log = [...(elf.log || []), line].slice(-40);
    elf.beat = (parseInt(elf.beat, 10) || 0) + 1;
    sheet.note = line;
    return line;
}
