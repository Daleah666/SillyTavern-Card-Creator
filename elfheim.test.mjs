import assert from 'node:assert/strict';
import {
    abilityMod,
    applyBeat,
    applyLook,
    assignScores,
    blankView,
    commitCreation,
    currentBeat,
    derivedMp,
    lookById,
    proficiency,
    renderPanel,
    rollAbility,
    rollCheck,
    STANDARD_ARRAY,
    suggestedHp,
} from './elfheim.js';

assert.equal(abilityMod(10), 0);
assert.equal(abilityMod(8), -1);
assert.equal(abilityMod(18), 4);
assert.equal(abilityMod(25), 7);
assert.equal(abilityMod(''), 0);
assert.equal(proficiency(1), 2);
assert.equal(proficiency(5), 3);
assert.equal(proficiency(69), 19);
assert.equal(derivedMp({ dnd_int: '16', dnd_level: '5' }), 19);
assert.equal(derivedMp({ dnd_int: '3', dnd_level: '5' }), 1);
assert.equal(suggestedHp(6, 1, 10), 6);

const sheet = blankView();
sheet.profile.dnd_level = '5';
sheet.profile.dnd_dex = '14';
sheet.profile.dnd_skills = 'Stealth, Persuasion';
const failOne = rollCheck(sheet.profile, { ability: 'dex', skill: 'Stealth', dc: 30 }, () => 0);
assert.equal(failOne.die, 1);
assert.equal(failOne.ok, false);
const crit = rollCheck(sheet.profile, { ability: 'dex', skill: 'Stealth', dc: 30 }, () => 19 / 20);
assert.equal(crit.die, 20);
assert.equal(crit.ok, true);
assert.equal(crit.prof, 3);

sheet.profile.dnd_hp = '20';
const line = applyBeat(sheet, currentBeat(sheet.elfheim), { die: 4, mod: -1, prof: 0, total: 3, dc: 13, ok: false });
assert.match(line, /Captive/);
assert.equal(sheet.elfheim.status, 'Captive');
assert.equal(sheet.elfheim.hp, '17');
assert.equal(sheet.elfheim.beat, 1);
assert.equal(sheet.elfheim.log.length, 1);

const lunara = applyLook(blankView(), lookById('lunara'));
assert.equal(lunara.name, 'Lunara Moonwhisper');
assert.equal(lunara.profile.dnd_class, 'Sorcerer');
assert.equal(lunara.profile.dnd_cha, '25');
assert.equal(lunara.elfheim.status, 'Free');
assert.equal(lunara.elfheim.frame, 'isekai');

const kept = blankView();
kept.name = 'Redz';
kept.profile.dnd_str = '12';
const green = applyLook(kept, lookById('green'));
assert.equal(green.name, 'Redz');
assert.equal(green.profile.dnd_str, '12');
assert.equal(green.elfheim.look, 'green');

const damsel = applyLook(lunara, lookById('damsel'));
assert.equal(damsel.profile.dnd_hp, '120');
assert.equal(damsel.profile.dnd_dex, '');
assert.equal(damsel.profile.dnd_race, '');
assert.equal(damsel.profile.dnd_cha, '18');
assert.equal(damsel.elfheim.mp, '45');
assert.equal(damsel.elfheim.status, 'Captive');

const made = blankView();
made.profile.dnd_class = 'Sorcerer';
made.profile.dnd_race = 'High Elf';
assignScores(made.profile, STANDARD_ARRAY);
commitCreation(made);
assert.equal(made.profile.dnd_str, '15');
assert.equal(made.profile.dnd_skills, 'Arcana, Persuasion, Insight');
assert.equal(made.profile.dnd_speed, '30 ft');
assert.ok(Number(made.profile.dnd_hp) > 0);

const rolled = rollAbility(() => 0);
assert.equal(rolled.total, 3);
const html = renderPanel(lunara, (file) => `./creator/elfheim/${file}`);
assert.match(html, /Lunara Moonwhisper/);
assert.match(html, /lunara\.webp/);
assert.match(html, /The captive mark/);
assert.match(html, /width="150"/);
console.log('elfheim tests passed');
