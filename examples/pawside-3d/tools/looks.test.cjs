'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { preset, renderStyles, temperaments, normalize, readFile } = require('../web/looks.js');
test('all ten presets have a distinct identity and usable colors, shape and temperament', () => {
  assert.equal(preset.length, 10);
  assert.equal(new Set(preset.map(p => p.key)).size, preset.length);
  assert.equal(new Set(preset.map(p => p.name)).size, preset.length);
  for (const p of preset) {
    assert.ok(['ink','chestnut'].includes(p.pet));
    assert.ok(p.breed && p.english && Object.hasOwn(temperaments,p.temperament));
    const {coat,form} = normalize(p.pet,p);
    assert.match(coat.eyeRight,/^#[a-f0-9]{6}$/);
    assert.equal(form.pattern, p.form.pattern ?? 'solid');
  }
});
test('format 3 round-trips every renderer and both eyes without modifying the preset', () => {
  const p=preset.find(x=>x.key==='blue'), original=JSON.stringify(p);
  for (const renderStyle of Object.keys(renderStyles)) {
    const appearance=normalize(p.pet,p);
    const source={format:'pawside-three',version:3,pet:p.pet,name:'小雾',preset:p.key,renderStyle,temperament:'sleepy',...appearance};
    const loaded=readFile(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(loaded,{pet:p.pet,name:'小雾',preset:p.key,renderStyle,temperament:'sleepy',...appearance});
    assert.notEqual(loaded.coat.eye,loaded.coat.eyeRight);
  }
  assert.equal(JSON.stringify(p),original);
});
test('original coat files and v2 full looks import, invalid v3 input is rejected', () => {
  const legacy={format:'pawside-three',version:1,pet:'ink',coat:{eye:'#bfb27e'}};
  assert.equal(normalize('ink',readFile(legacy)).coat.eyeRight,'#bfb27e');
  const form={headWidth:1.14};
  assert.deepEqual(readFile({...legacy,version:2,form}).form,form);
  assert.throws(()=>readFile({...legacy,version:3,form,renderStyle:'unknown'}));
  assert.throws(()=>readFile({...legacy,coat:{eye:'red'}}));
  assert.throws(()=>readFile({...legacy,version:5}));
});
