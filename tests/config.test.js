import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, PARTS, SPEC, togglePart, validateConfig, readSaved } from '../src/config.js';
import { createCustomPart } from '../src/custom-parts.js';

test('accessories can be installed and removed without changing the original config', () => {
  const original = { ...DEFAULT_CONFIG, parts: [] };
  const installed = togglePart(original, 'saddlebags').config;
  assert.deepEqual(installed.parts, ['saddlebags']);
  assert.deepEqual(original.parts, []);
  assert.deepEqual(togglePart(installed, 'saddlebags').config.parts, []);
});

test('cowl and windshield replace each other while preserving other accessories', () => {
  const initial = { version: 1, color: 'green', parts: ['cowl', 'saddlebags', 'brownSeat'] };
  const result = togglePart(initial, 'windshield');
  assert.deepEqual(result.removed, ['cowl']);
  assert.deepEqual(result.config.parts, ['saddlebags', 'brownSeat', 'windshield']);
  assert.equal(result.config.color, 'green');
  const reversed = togglePart(result.config, 'cowl');
  assert.ok(reversed.config.parts.includes('cowl'));
  assert.ok(!reversed.config.parts.includes('windshield'));
});

test('every accessory round trips through a JSON configuration', () => {
  for (const part of PARTS) {
    const config = togglePart({ ...DEFAULT_CONFIG, parts: [] }, part.id).config;
    assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(config))), config);
  }
});

test('untrusted imports reject conflicts, unknown data and malformed configurations', () => {
  for (const value of [null, {}, { version: 3, color: 'black', parts: [] }, { version: 1, color: 'invalid', parts: [] }, { version: 1, color: 'black', parts: ['unknown'] }, { version: 1, color: 'black', parts: ['rack','rack'] }, { version: 1, color: 'black', parts: ['cowl','windshield'] }, {...DEFAULT_CONFIG,finish:'invalid'}, {...DEFAULT_CONFIG,customParts:[{}]}]) assert.throws(() => validateConfig(value));
});

test('legacy v1 builds migrate to gloss without losing existing accessories', () => {
  const legacy={version:1,color:'green',parts:['rack','brownSeat']};
  assert.deepEqual(validateConfig(legacy),{...DEFAULT_CONFIG,color:'green',parts:['rack','brownSeat']});
});

test('finish and custom accessories survive save and JSON round trips', () => {
  const config={...DEFAULT_CONFIG,finish:'matte',customParts:[createCustomPart({template:'windshield',name:'我的風鏡',sourceUrl:'https://example.com/parts/1',position:[-.6,1,0],rotation:[0,0,15]})]};
  const serialized=JSON.stringify(config);
  assert.deepEqual(readSaved({getItem:()=>serialized}),config);
  assert.deepEqual(validateConfig(JSON.parse(serialized)),config);
  const installed=togglePart(config,'rack').config;
  assert.deepEqual(installed.customParts,config.customParts);
  assert.equal(installed.finish,'matte');
});

test('storage failures and corrupt saved data recover without crashing', () => {
  assert.equal(readSaved({ getItem: () => '{broken' }), null);
  assert.equal(readSaved({ getItem: () => { throw Error('denied'); } }), null);
  assert.deepEqual(readSaved({ getItem: () => JSON.stringify(DEFAULT_CONFIG) }), DEFAULT_CONFIG);
});

test('wheel sizes derive from official tyre dimensions in metres', () => {
  assert.equal(SPEC.wheelbase, 1.49);
  assert.ok(Math.abs(SPEC.frontRadius - .3202) < 1e-9);
  assert.ok(Math.abs(SPEC.rearRadius - .3232) < 1e-9);
});
