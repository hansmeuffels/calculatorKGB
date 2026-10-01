(function () {
  'use strict';

  const JAREN = [2026, 2027];
  const OPSLAG_SLEUTEL = 'kgb-rekenvariabelen';
  const MAX_KINDEREN = 20;

  const el = {
    invoer: document.getElementById('invoer'),
    aantalKinderen: document.getElementById('aantal-kinderen'),
    kinderen: document.getElementById('kinderen'),
    toetsingsinkomen: document.getElementById('toetsingsinkomen'),
    heeftToeslagpartner: document.getElementById('heeft-toeslagpartner'),
    partnerInkomen: document.getElementById('partner-inkomen'),
    toetsingsinkomenPartner: document.getElementById('toetsingsinkomen-partner'),
    grafiekOmslag: document.getElementById('grafiek-omslag'),
    grafiekSvg: document.getElementById('grafiek-svg'),
    grafiekTooltip: document.getElementById('grafiek-tooltip'),
    grafiekLegenda: document.getElementById('grafiek-legenda'),
    openInstellingen: document.getElementById('open-instellingen'),
    instellingen: document.getElementById('instellingen'),
    instellingenRijen: document.getElementById('instellingen-rijen'),
    herstelStandaard: document.getElementById('herstel-standaard'),
    schuiven: Array.from(document.querySelectorAll('input.schuif')),
  };

  let leeftijden = [0, 0];
  let parameters = laadParameters();
  let grafiek = null;
  let grafiekIndex = null;

  function kopieStandaard() {
    return JSON.parse(JSON.stringify(KGB.DEFAULT_PARAMETERS));
  }

  function laadParameters() {
    const standaard = kopieStandaard();
    try {
      const opgeslagen = JSON.parse(localStorage.getItem(OPSLAG_SLEUTEL) || 'null');
      if (opgeslagen && typeof opgeslagen === 'object') {
        JAREN.forEach((jaar) => {
          KGB.PARAMETER_DEFINITIONS.forEach(({ key }) => {
            const waarde = opgeslagen[jaar] && opgeslagen[jaar][key];
            if (waarde === null || typeof waarde === 'number') {
              standaard[jaar][key] = waarde;
            }
          });
        });
      }
    } catch (e) {
      // Ongeldige of ontoegankelijke opslag: gebruik standaardwaarden.
    }
    return standaard;
  }

  function bewaarParameters() {
    try {
      localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(parameters));
    } catch (e) {
      // Opslaan is niet mogelijk; de waarden blijven wel actief in deze sessie.
    }
  }

  function renderKinderen() {
    const aantal = Math.min(MAX_KINDEREN, Math.max(0, Math.floor(Number(el.aantalKinderen.value) || 0)));
    while (leeftijden.length < aantal) leeftijden.push(0);
    leeftijden.length = aantal;

    el.kinderen.replaceChildren();
    leeftijden.forEach((leeftijd, index) => {
      const naam = `Leeftijd kind ${index + 1}`;
      const id = `leeftijd-kind-${index + 1}`;
      const veld = document.createElement('div');
      veld.className = 'veld';
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = naam;
      const input = document.createElement('input');
      input.type = 'number';
      input.id = id;
      input.min = '0';
      input.max = '30';
      input.step = '1';
      input.inputMode = 'numeric';
      input.value = String(leeftijd);
      input.addEventListener('input', () => {
        leeftijden[index] = input.value === '' ? '' : Number(input.value);
        bereken();
      });
      veld.append(label, maakStepper(input, naam));
      el.kinderen.appendChild(veld);
    });
  }

  function maakStapKnop(input, naam, richting) {
    const knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'stap';
    knop.dataset.stap = String(richting);
    knop.setAttribute('aria-controls', input.id);
    knop.setAttribute('aria-label', `${naam} ${richting < 0 ? 'verlagen' : 'verhogen'}`);
    knop.textContent = richting < 0 ? '−' : '+';
    return knop;
  }

  function maakStepper(input, naam) {
    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    stepper.append(maakStapKnop(input, naam, -1), input, maakStapKnop(input, naam, 1));
    return stepper;
  }

  function stap(knop) {
    const input = document.getElementById(knop.getAttribute('aria-controls'));
    if (!input) return;
    const richting = Number(knop.dataset.stap);
    try {
      if (richting < 0) input.stepDown();
      else input.stepUp();
    } catch (e) {
      const stapgrootte = Number(input.step) || 1;
      const nieuw = Math.max(Number(input.min) || 0, (Number(input.value) || 0) + richting * stapgrootte);
      input.value = String(nieuw);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function werkSchuifBij(schuif) {
    const bron = document.getElementById(schuif.dataset.voor);
    schuif.value = bron.value === '' ? '0' : bron.value;
    const min = Number(schuif.min);
    const max = Number(schuif.max);
    const procent = ((Number(schuif.value) - min) / (max - min)) * 100;
    schuif.style.setProperty('--vulling', `${procent}%`);
    schuif.setAttribute('aria-valuetext', KGB.formatEuro(schuif.value));
  }

  function leeftijdenVoorJaar(jaar) {
    const verschil = jaar - JAREN[0];
    return leeftijden.map((l) => (l === '' ? '' : Number(l) + verschil));
  }

  function maakSvgElement(naam, attributen, tekst) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', naam);
    Object.entries(attributen).forEach(([sleutel, waarde]) => element.setAttribute(sleutel, String(waarde)));
    if (tekst !== undefined) element.textContent = tekst;
    return element;
  }

  function renderGrafiek() {
    const breedte = 720;
    const hoogte = 360;
    const marge = { boven: 24, rechts: 20, onder: 64, links: 76 };
    const plotBreedte = breedte - marge.links - marge.rechts;
    const plotHoogte = hoogte - marge.boven - marge.onder;
    const reeksen = JAREN.map((jaar, index) => ({
      jaar,
      punten: KGB.berekenKgbReeks(leeftijdenVoorJaar(jaar), parameters[jaar]),
      kleur: index === 0 ? 'var(--kleur-primair)' : 'var(--kleur-accent)',
    }));
    const puntenEersteReeks = reeksen[0].punten;
    const maximumInkomen = puntenEersteReeks[puntenEersteReeks.length - 1].inkomen;
    const maximumKgb = Math.max(...reeksen.flatMap(({ punten }) => punten.map(({ perMaand }) => perMaand)));
    const stapKgb = Math.max(50, Math.ceil(maximumKgb / 4 / 50) * 50);
    const maximumY = stapKgb * 4;
    const x = (inkomen) => marge.links + (inkomen / maximumInkomen) * plotBreedte;
    const y = (bedrag) => marge.boven + plotHoogte - (bedrag / maximumY) * plotHoogte;
    const fragment = document.createDocumentFragment();

    for (let stap = 0; stap <= 4; stap += 1) {
      const bedrag = stap * stapKgb;
      const positie = y(bedrag);
      fragment.append(
        maakSvgElement('line', {
          x1: marge.links,
          x2: breedte - marge.rechts,
          y1: positie,
          y2: positie,
          class: 'grafiek-rooster',
        }),
        maakSvgElement(
          'text',
          { x: marge.links - 10, y: positie + 4, class: 'grafiek-tik', 'text-anchor': 'end' },
          KGB.formatEuro(bedrag)
        )
      );
    }

    for (let stap = 0; stap <= 4; stap += 1) {
      const inkomen = (maximumInkomen / 4) * stap;
      const positie = x(inkomen);
      fragment.append(
        maakSvgElement('line', {
          x1: positie,
          x2: positie,
          y1: marge.boven,
          y2: hoogte - marge.onder,
          class: 'grafiek-rooster',
        }),
        maakSvgElement(
          'text',
          { x: positie, y: hoogte - marge.onder + 22, class: 'grafiek-tik', 'text-anchor': 'middle' },
          KGB.formatEuro(inkomen)
        )
      );
    }

    fragment.append(
      maakSvgElement('line', {
        x1: marge.links,
        x2: marge.links,
        y1: marge.boven,
        y2: hoogte - marge.onder,
        class: 'grafiek-as',
      }),
      maakSvgElement('line', {
        x1: marge.links,
        x2: breedte - marge.rechts,
        y1: hoogte - marge.onder,
        y2: hoogte - marge.onder,
        class: 'grafiek-as',
      }),
      maakSvgElement(
        'text',
        { x: marge.links + plotBreedte / 2, y: hoogte - 12, class: 'grafiek-aslabel', 'text-anchor': 'middle' },
        'Gezamenlijk inkomen per jaar (2 personen)'
      ),
      maakSvgElement(
        'text',
        {
          x: 18,
          y: marge.boven + plotHoogte / 2,
          class: 'grafiek-aslabel',
          'text-anchor': 'middle',
          transform: `rotate(-90 18 ${marge.boven + plotHoogte / 2})`,
        },
        'KGB per maand'
      )
    );

    reeksen.forEach(({ jaar, punten, kleur }) => {
      const pad = punten
        .map(({ inkomen, perMaand }, index) => `${index === 0 ? 'M' : 'L'} ${x(inkomen)} ${y(perMaand)}`)
        .join(' ');
      fragment.append(maakSvgElement('path', { d: pad, class: 'grafiek-lijn', stroke: kleur }));
    });

    const hover = maakSvgElement('g', { class: 'grafiek-hover', 'aria-hidden': 'true', visibility: 'hidden' });
    fragment.append(hover);

    el.grafiekSvg.replaceChildren(
      maakSvgElement('title', { id: 'grafiek-svg-titel' }, 'Kindgebonden budget per maand bij gezamenlijk inkomen'),
      maakSvgElement(
        'desc',
        { id: 'grafiek-svg-beschrijving' },
        `Maandelijks KGB bij een gezamenlijk inkomen van € 0 tot ${KGB.formatEuro(maximumInkomen)} voor twee personen.`
      ),
      fragment
    );
    el.grafiekLegenda.replaceChildren();
    reeksen.forEach(({ jaar, kleur }) => {
      const item = document.createElement('span');
      item.className = 'grafiek-legenda-item';
      const lijn = document.createElement('span');
      lijn.className = 'grafiek-legenda-lijn';
      lijn.style.setProperty('--kleur-reeks', kleur);
      lijn.setAttribute('aria-hidden', 'true');
      item.append(lijn, document.createTextNode(String(jaar)));
      el.grafiekLegenda.appendChild(item);
    });

    grafiek = { breedte, hoogte, marge, plotBreedte, maximumInkomen, reeksen, x, y, hover };
    toonGrafiekWaarde(grafiekIndex);
  }

  function toonGrafiekWaarde(index) {
    grafiekIndex = index;
    if (!grafiek) return;
    const { breedte, hoogte, marge, reeksen, x, y, hover } = grafiek;
    if (index === null) {
      hover.setAttribute('visibility', 'hidden');
      el.grafiekTooltip.hidden = true;
      return;
    }

    const inkomen = reeksen[0].punten[index].inkomen;
    const positie = x(inkomen);
    hover.replaceChildren(
      maakSvgElement('line', {
        x1: positie,
        x2: positie,
        y1: marge.boven,
        y2: hoogte - marge.onder,
        class: 'grafiek-hover-lijn',
      }),
      ...reeksen.map(({ punten, kleur }) =>
        maakSvgElement('circle', { cx: positie, cy: y(punten[index].perMaand), r: 5, fill: kleur, class: 'grafiek-hover-punt' })
      )
    );
    hover.setAttribute('visibility', 'visible');

    const kop = document.createElement('p');
    kop.className = 'grafiek-tooltip-kop';
    kop.textContent = `Inkomen ${KGB.formatEuro(inkomen)} per jaar`;
    const rijen = reeksen.map(({ jaar, punten, kleur }) => {
      const rij = document.createElement('p');
      rij.className = 'grafiek-tooltip-rij';
      const lijn = document.createElement('span');
      lijn.className = 'grafiek-legenda-lijn';
      lijn.style.setProperty('--kleur-reeks', kleur);
      lijn.setAttribute('aria-hidden', 'true');
      const bedrag = document.createElement('strong');
      bedrag.textContent = `${KGB.formatEuro(punten[index].perMaand)} per maand`;
      rij.append(lijn, document.createTextNode(`${jaar}:`), bedrag);
      return rij;
    });
    el.grafiekTooltip.replaceChildren(kop, ...rijen);
    el.grafiekTooltip.style.top = `${(marge.boven / hoogte) * 100}%`;
    el.grafiekTooltip.hidden = false;

    // Rechts van de lijn tonen, anders links ervan, en altijd binnen het zichtbare deel van de grafiek.
    const canvas = el.grafiekTooltip.parentElement.getBoundingClientRect();
    const zichtbaar = el.grafiekOmslag.getBoundingClientRect();
    const punt = canvas.left + (positie / breedte) * canvas.width;
    const tooltipBreedte = el.grafiekTooltip.offsetWidth;
    let links = punt + 12;
    if (links + tooltipBreedte > zichtbaar.right) links = punt - 12 - tooltipBreedte;
    links = Math.max(zichtbaar.left, Math.min(links, zichtbaar.right - tooltipBreedte));
    el.grafiekTooltip.style.left = `${links - canvas.left}px`;
  }

  function grafiekIndexBijPositie(clientX) {
    const rechthoek = el.grafiekSvg.getBoundingClientRect();
    if (!grafiek || rechthoek.width === 0) return null;
    const { breedte, marge, plotBreedte, maximumInkomen, reeksen } = grafiek;
    const svgX = ((clientX - rechthoek.left) / rechthoek.width) * breedte;
    if (svgX < marge.links - 10 || svgX > breedte - marge.rechts + 10) return null;
    const inkomen = ((svgX - marge.links) / plotBreedte) * maximumInkomen;
    return KGB.indexDichtstbijzijndPunt(reeksen[0].punten, inkomen);
  }

  function grafiekIndexIngevuldInkomen() {
    const partnerInkomen = el.heeftToeslagpartner.checked ? Number(el.toetsingsinkomenPartner.value) || 0 : 0;
    const inkomen = (Number(el.toetsingsinkomen.value) || 0) + partnerInkomen;
    return KGB.indexDichtstbijzijndPunt(grafiek.reeksen[0].punten, inkomen);
  }

  function houdGrafiekWaardeInBeeld(index) {
    const omslag = el.grafiekOmslag;
    if (omslag.scrollWidth <= omslag.clientWidth) return;
    const positie = (grafiek.x(grafiek.reeksen[0].punten[index].inkomen) / grafiek.breedte) * omslag.scrollWidth;
    if (positie < omslag.scrollLeft || positie > omslag.scrollLeft + omslag.clientWidth) {
      omslag.scrollLeft = positie - omslag.clientWidth / 2;
    }
  }

  function bereken() {
    const heeftPartner = el.heeftToeslagpartner.checked;
    el.partnerInkomen.hidden = !heeftPartner;

    JAREN.forEach((jaar) => {
      const uitkomst = KGB.berekenKgb(
        {
          leeftijden: leeftijdenVoorJaar(jaar),
          toetsingsinkomen: el.toetsingsinkomen.value,
          heeftToeslagpartner: heeftPartner,
          toetsingsinkomenPartner: el.toetsingsinkomenPartner.value,
        },
        parameters[jaar]
      );
      document.querySelectorAll(`#resultaat td[data-jaar="${jaar}"]`).forEach((cel) => {
        cel.textContent = KGB.formatEuro(uitkomst[cel.dataset.veld]);
      });
    });
    renderGrafiek();
  }

  function renderInstellingen() {
    el.instellingenRijen.replaceChildren();
    KGB.PARAMETER_DEFINITIONS.forEach((definitie) => {
      const rij = document.createElement('tr');
      const kop = document.createElement('th');
      kop.scope = 'row';
      kop.textContent = definitie.unit === 'procent' ? `${definitie.label} (%)` : `${definitie.label} (€)`;
      rij.appendChild(kop);

      JAREN.forEach((jaar) => {
        const cel = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = definitie.unit === 'procent' ? '0.01' : '1';
        input.setAttribute('aria-label', `${definitie.label} ${jaar}`);
        const waarde = parameters[jaar][definitie.key];
        input.value = waarde === null || waarde === undefined ? '' : String(waarde);
        if (definitie.optional) input.placeholder = 'n.v.t.';
        input.addEventListener('input', () => {
          if (input.value === '') {
            parameters[jaar][definitie.key] = definitie.optional ? null : 0;
          } else if (Number.isFinite(Number(input.value))) {
            parameters[jaar][definitie.key] = Number(input.value);
          } else {
            return;
          }
          bewaarParameters();
          bereken();
        });
        cel.appendChild(input);
        rij.appendChild(cel);
      });
      el.instellingenRijen.appendChild(rij);
    });
  }

  el.aantalKinderen.addEventListener('input', () => {
    renderKinderen();
    bereken();
  });
  el.heeftToeslagpartner.addEventListener('input', bereken);
  el.invoer.addEventListener('click', (event) => {
    const knop = event.target.closest('button.stap');
    if (knop) stap(knop);
  });
  el.schuiven.forEach((schuif) => {
    const bron = document.getElementById(schuif.dataset.voor);
    bron.addEventListener('input', () => {
      werkSchuifBij(schuif);
      bereken();
    });
    schuif.addEventListener('input', () => {
      bron.value = schuif.value;
      werkSchuifBij(schuif);
      bereken();
    });
    werkSchuifBij(schuif);
  });
  ['pointermove', 'pointerdown'].forEach((type) => {
    el.grafiekSvg.addEventListener(type, (event) => toonGrafiekWaarde(grafiekIndexBijPositie(event.clientX)));
  });
  el.grafiekSvg.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') toonGrafiekWaarde(null);
  });
  el.grafiekOmslag.addEventListener('focus', () => {
    if (grafiekIndex === null) toonGrafiekWaarde(grafiekIndexIngevuldInkomen());
  });
  el.grafiekOmslag.addEventListener('blur', () => toonGrafiekWaarde(null));
  el.grafiekOmslag.addEventListener('keydown', (event) => {
    if (!grafiek) return;
    const laatste = grafiek.reeksen[0].punten.length - 1;
    const huidig = grafiekIndex === null ? grafiekIndexIngevuldInkomen() : grafiekIndex;
    const stappen = { ArrowLeft: -1, ArrowRight: 1, PageDown: -10, PageUp: 10 };
    let nieuw;
    if (event.key in stappen) nieuw = Math.min(laatste, Math.max(0, huidig + stappen[event.key]));
    else if (event.key === 'Home') nieuw = 0;
    else if (event.key === 'End') nieuw = laatste;
    else if (event.key === 'Escape') nieuw = null;
    else return;
    event.preventDefault();
    if (nieuw !== null) houdGrafiekWaardeInBeeld(nieuw);
    toonGrafiekWaarde(nieuw);
  });
  el.openInstellingen.addEventListener('click', () => {
    renderInstellingen();
    el.instellingen.showModal();
  });
  el.herstelStandaard.addEventListener('click', () => {
    parameters = kopieStandaard();
    try {
      localStorage.removeItem(OPSLAG_SLEUTEL);
    } catch (e) {
      // Negeer fouten bij het wissen van de opslag.
    }
    renderInstellingen();
    bereken();
  });

  renderKinderen();
  bereken();
})();
