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
    openInstellingen: document.getElementById('open-instellingen'),
    instellingen: document.getElementById('instellingen'),
    instellingenRijen: document.getElementById('instellingen-rijen'),
    herstelStandaard: document.getElementById('herstel-standaard'),
    schuiven: Array.from(document.querySelectorAll('input.schuif')),
  };

  let leeftijden = [0];
  let parameters = laadParameters();

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
