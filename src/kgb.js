/*
 * Rekenkern voor het kindgebonden budget (KGB).
 *
 * Werkt zowel in de browser (globale variabele `KGB`) als in Node.js
 * (via `require`), zodat de berekening los getest kan worden.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.KGB = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Standaardwaarden van de rekenvariabelen per jaar (bedragen in euro per jaar).
   * De waarden voor 2027 zijn een voorlopige inschatting en kunnen in de app
   * worden aangepast.
   */
  const DEFAULT_PARAMETERS = {
    2026: {
      drempelinkomenAlleenstaande: 29736,
      drempelinkomenToeslagpartner: 39141,
      bedragPerKind: 2587,
      verhoging12tot15: 724,
      verhoging16en17: 964,
      alleenstaandeOuderkop: 3416,
      afbouwpercentage: 7.6,
      inkomensgrensVerhoogdAfbouwpercentage: null,
      verhoogdAfbouwpercentage: null,
    },
    2027: {
      drempelinkomenAlleenstaande: 29736,
      drempelinkomenToeslagpartner: 39141,
      bedragPerKind: 2651,
      verhoging12tot15: 724,
      verhoging16en17: 964,
      alleenstaandeOuderkop: 3416,
      afbouwpercentage: 8.05,
      inkomensgrensVerhoogdAfbouwpercentage: 61917,
      verhoogdAfbouwpercentage: 9.95,
    },
  };

  /** Omschrijvingen van de rekenvariabelen, in de volgorde waarin ze getoond worden. */
  const PARAMETER_DEFINITIONS = [
    { key: 'drempelinkomenAlleenstaande', label: 'Drempelinkomen alleenstaande ouder', unit: 'euro' },
    { key: 'drempelinkomenToeslagpartner', label: 'Drempelinkomen met toeslagpartner', unit: 'euro' },
    { key: 'bedragPerKind', label: 'Maximaal bedrag per kind', unit: 'euro' },
    { key: 'verhoging12tot15', label: 'Verhoging kind 12 t/m 15 jaar', unit: 'euro' },
    { key: 'verhoging16en17', label: 'Verhoging kind 16 of 17 jaar', unit: 'euro' },
    { key: 'alleenstaandeOuderkop', label: 'Alleenstaande-ouderkop', unit: 'euro' },
    { key: 'afbouwpercentage', label: 'Afbouwpercentage', unit: 'procent' },
    {
      key: 'inkomensgrensVerhoogdAfbouwpercentage',
      label: 'Inkomensgrens verhoogd afbouwpercentage',
      unit: 'euro',
      optional: true,
    },
    { key: 'verhoogdAfbouwpercentage', label: 'Verhoogd afbouwpercentage', unit: 'procent', optional: true },
  ];

  const MAX_LEEFTIJD = 17;

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function isLeeg(value) {
    return value === null || value === undefined || value === '';
  }

  /** Maximaal bedrag voor één kind van de opgegeven leeftijd. */
  function bedragVoorKind(leeftijd, params) {
    if (isLeeg(leeftijd)) {
      return 0;
    }
    const age = Math.floor(toNumber(leeftijd));
    if (age < 0 || age > MAX_LEEFTIJD) {
      return 0;
    }
    let bedrag = toNumber(params.bedragPerKind);
    if (age >= 16) {
      bedrag += toNumber(params.verhoging16en17);
    } else if (age >= 12) {
      bedrag += toNumber(params.verhoging12tot15);
    }
    return bedrag;
  }

  /** Vermindering (afbouw) van het maximale bedrag op basis van het toetsingsinkomen. */
  function berekenAfbouw(toetsingsinkomen, drempelinkomen, params) {
    const inkomen = toNumber(toetsingsinkomen);
    const drempel = toNumber(drempelinkomen);
    const pct = toNumber(params.afbouwpercentage) / 100;
    const grens = params.inkomensgrensVerhoogdAfbouwpercentage;
    const verhoogdPct = params.verhoogdAfbouwpercentage;

    if (isLeeg(grens) || isLeeg(verhoogdPct)) {
      return Math.max(0, inkomen - drempel) * pct;
    }

    const grensBedrag = Math.max(toNumber(grens), drempel);
    const normaalDeel = Math.max(0, Math.min(inkomen, grensBedrag) - drempel);
    const verhoogdDeel = Math.max(0, inkomen - grensBedrag);
    return normaalDeel * pct + verhoogdDeel * (toNumber(verhoogdPct) / 100);
  }

  /**
   * Bereken het kindgebonden budget voor één jaar.
   *
   * @param {object} invoer
   * @param {number[]} invoer.leeftijden leeftijden van de kinderen in dat jaar
   * @param {number} invoer.toetsingsinkomen toetsingsinkomen aanvrager
   * @param {boolean} invoer.heeftToeslagpartner of er een toeslagpartner is
   * @param {number} [invoer.toetsingsinkomenPartner] toetsingsinkomen toeslagpartner
   * @param {object} params rekenvariabelen voor het jaar
   */
  function berekenKgb(invoer, params) {
    const leeftijden = Array.isArray(invoer.leeftijden) ? invoer.leeftijden : [];
    const partner = Boolean(invoer.heeftToeslagpartner);
    const toetsingsinkomen =
      toNumber(invoer.toetsingsinkomen) + (partner ? toNumber(invoer.toetsingsinkomenPartner) : 0);

    const bedragKinderen = leeftijden.reduce((som, leeftijd) => som + bedragVoorKind(leeftijd, params), 0);
    const aantalRechtgevendeKinderen = leeftijden.filter((l) => bedragVoorKind(l, params) > 0).length;
    const alleenstaandeOuderkop =
      !partner && aantalRechtgevendeKinderen > 0 ? toNumber(params.alleenstaandeOuderkop) : 0;
    const maximaalBedrag = bedragKinderen + alleenstaandeOuderkop;

    const drempelinkomen = partner ? params.drempelinkomenToeslagpartner : params.drempelinkomenAlleenstaande;
    const afbouw = aantalRechtgevendeKinderen > 0 ? berekenAfbouw(toetsingsinkomen, drempelinkomen, params) : 0;

    const perJaar = Math.max(0, maximaalBedrag - afbouw);
    return {
      toetsingsinkomen,
      aantalRechtgevendeKinderen,
      bedragKinderen,
      alleenstaandeOuderkop,
      maximaalBedrag,
      afbouw: Math.min(afbouw, maximaalBedrag),
      perJaar,
      perMaand: perJaar / 12,
    };
  }

  const euroFormaat = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  /** Rond een bedrag af op hele euro's (zonder -0). */
  function rondAfOpHeleEuro(bedrag) {
    return Math.round(toNumber(bedrag)) || 0;
  }

  /** Bedrag als tekst in hele euro's, bijvoorbeeld "€ 1.235". */
  function formatEuro(bedrag) {
    return euroFormaat.format(rondAfOpHeleEuro(bedrag));
  }

  return {
    DEFAULT_PARAMETERS,
    PARAMETER_DEFINITIONS,
    MAX_LEEFTIJD,
    bedragVoorKind,
    berekenAfbouw,
    berekenKgb,
    rondAfOpHeleEuro,
    formatEuro,
  };
});
