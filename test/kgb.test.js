const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PARAMETERS,
  bedragVoorKind,
  berekenAfbouw,
  berekenKgb,
  rondAfOpHeleEuro,
  formatEuro,
} = require('../src/kgb.js');

const p2026 = DEFAULT_PARAMETERS[2026];
const p2027 = DEFAULT_PARAMETERS[2027];

test('bedrag per kind houdt rekening met leeftijdsverhogingen', () => {
  assert.equal(bedragVoorKind(5, p2026), p2026.bedragPerKind);
  assert.equal(bedragVoorKind(12, p2026), p2026.bedragPerKind + p2026.verhoging12tot15);
  assert.equal(bedragVoorKind(15, p2026), p2026.bedragPerKind + p2026.verhoging12tot15);
  assert.equal(bedragVoorKind(16, p2026), p2026.bedragPerKind + p2026.verhoging16en17);
  assert.equal(bedragVoorKind(17, p2026), p2026.bedragPerKind + p2026.verhoging16en17);
  assert.equal(bedragVoorKind(18, p2026), 0);
  assert.equal(bedragVoorKind('', p2026), 0);
});

test('geen afbouw onder het drempelinkomen', () => {
  const r = berekenKgb({ leeftijden: [3, 13], toetsingsinkomen: 20000, heeftToeslagpartner: true, toetsingsinkomenPartner: 10000 }, p2026);
  assert.equal(r.afbouw, 0);
  assert.equal(r.alleenstaandeOuderkop, 0);
  assert.equal(r.perJaar, 2 * p2026.bedragPerKind + p2026.verhoging12tot15);
  assert.equal(r.perMaand, r.perJaar / 12);
});

test('alleenstaande ouder krijgt alleenstaande-ouderkop en eigen drempelinkomen', () => {
  const inkomen = p2026.drempelinkomenAlleenstaande + 10000;
  const r = berekenKgb({ leeftijden: [8], toetsingsinkomen: inkomen, heeftToeslagpartner: false, toetsingsinkomenPartner: 50000 }, p2026);
  assert.equal(r.toetsingsinkomen, inkomen, 'partnerinkomen telt niet mee zonder toeslagpartner');
  assert.equal(r.maximaalBedrag, p2026.bedragPerKind + p2026.alleenstaandeOuderkop);
  assert.ok(Math.abs(r.afbouw - 10000 * 0.076) < 1e-9);
  assert.ok(Math.abs(r.perJaar - (r.maximaalBedrag - 760)) < 1e-9);
});

test('partnerinkomen wordt opgeteld bij gezamenlijk toetsingsinkomen', () => {
  const r = berekenKgb({ leeftijden: [1], toetsingsinkomen: 30000, heeftToeslagpartner: true, toetsingsinkomenPartner: 19141 }, p2026);
  assert.equal(r.toetsingsinkomen, 49141);
  assert.ok(Math.abs(r.afbouw - 10000 * 0.076) < 1e-9);
});

test('kgb wordt nooit negatief', () => {
  const r = berekenKgb({ leeftijden: [1], toetsingsinkomen: 500000, heeftToeslagpartner: false }, p2026);
  assert.equal(r.perJaar, 0);
  assert.equal(r.perMaand, 0);
});

test('vanaf 2027 geldt boven de inkomensgrens een verhoogd afbouwpercentage', () => {
  const grens = p2027.inkomensgrensVerhoogdAfbouwpercentage;
  const drempel = p2027.drempelinkomenToeslagpartner;
  const afbouw = berekenAfbouw(grens + 1000, drempel, p2027);
  const verwacht = (grens - drempel) * (p2027.afbouwpercentage / 100) + 1000 * (p2027.verhoogdAfbouwpercentage / 100);
  assert.ok(Math.abs(afbouw - verwacht) < 1e-9);
  // Onder de grens geldt alleen het normale afbouwpercentage.
  assert.ok(Math.abs(berekenAfbouw(drempel + 1000, drempel, p2027) - 1000 * (p2027.afbouwpercentage / 100)) < 1e-9);
});

test('zonder inkomensgrens (2026) geldt alleen het gewone afbouwpercentage', () => {
  assert.ok(Math.abs(berekenAfbouw(100000, 39141, p2026) - (100000 - 39141) * 0.076) < 1e-9);
});

test('zonder rechtgevende kinderen is er geen kgb', () => {
  const r = berekenKgb({ leeftijden: [18, 20], toetsingsinkomen: 0, heeftToeslagpartner: false }, p2026);
  assert.equal(r.perJaar, 0);
  assert.equal(r.alleenstaandeOuderkop, 0);
});

test('bedragen worden afgerond op hele euro\'s', () => {
  assert.equal(rondAfOpHeleEuro(1234.49), 1234);
  assert.equal(rondAfOpHeleEuro(1234.5), 1235);
  assert.equal(rondAfOpHeleEuro(-0.4), 0);
  assert.ok(Object.is(rondAfOpHeleEuro(-0.4), 0), 'geen -0');
  assert.equal(rondAfOpHeleEuro('abc'), 0);
});

test('formatEuro toont hele euro\'s zonder centen', () => {
  const normaliseer = (tekst) => tekst.replace(/\s/g, ' ');
  assert.equal(normaliseer(formatEuro(1234.56)), '€ 1.235');
  assert.equal(normaliseer(formatEuro(0)), '€ 0');
  assert.equal(normaliseer(formatEuro(-0.2)), '€ 0');
  assert.equal(normaliseer(formatEuro(39141)), '€ 39.141');
  const r = berekenKgb({ leeftijden: [8], toetsingsinkomen: 30000, heeftToeslagpartner: false }, p2026);
  assert.doesNotMatch(formatEuro(r.perMaand), /,/);
});
