import test from 'node:test';
import assert from 'node:assert/strict';
import { localClock } from '../lib/cards.ts';
import { stelliPath, stelliState } from '../lib/stellipath.ts';
import { appIconFilename, resolveMascotMood } from '../lib/stelli-mascot.ts';

test('StelliPath switches phases at local calendar boundaries and clamps past milestones', () => {
  for (const [day, phase, countdown] of [
    ['2027-01-16', 'StelliPent', 1],
    ['2027-01-17', '2027', 0],
    ['2027-12-26', '2027', 0],
    ['2027-12-27', '2028', 0],
    ['2028-12-31', '2028', 0],
    ['2029-01-01', '2029', 0],
    ['2029-12-30', '2029', 0],
    ['2029-12-31', '2029', 0],
  ] as const) {
    assert.equal(stelliPath(day).phase.phase, phase);
    assert.equal(stelliPath(day).days.stelliPent, countdown);
  }
  assert.equal(stelliPath('2026-11-27').position, 0);
  assert.equal(stelliPath('2027-01-17').position, 0.25);
  assert.ok(stelliPath('2028-02-29').position > stelliPath('2028-02-28').position);
  assert.equal(stelliPath('2029-12-31').position, 1);
  assert.deepEqual(stelliPath('2029-12-31').days, { stelliPent: 0, year1: 0, year2: 0, year3: 0 });
});

test('the journey uses the member timezone even when the UTC day differs', () => {
  const now = new Date('2027-01-16T16:05:00Z');
  assert.equal(stelliPath(localClock(now, 'Asia/Manila').day).phase.phase, '2027');
  assert.equal(stelliPath(localClock(now, 'America/New_York').day).phase.phase, 'StelliPent');
  assert.equal(stelliState('SBG'), 'SbG');
  assert.equal(stelliState('SP2S'), 'sP2S');
  assert.equal(stelliState('AOS'), 'AoS');
});

test('Stelli mood changes at 9 and 11 pm, and daily completion takes priority', () => {
  for (const [hour, completed, mood] of [
    [20, false, 'happy'],
    [21, false, 'sad'],
    [22, false, 'sad'],
    [23, false, 'disappointed'],
    [23, true, 'blissful'],
  ] as const) {
    assert.equal(resolveMascotMood(hour, completed), mood);
  }
  assert.equal(appIconFilename('blissful'), 'App_Icon_BlissFul_Stelli.png');
});
