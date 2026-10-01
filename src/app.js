(function () {
  'use strict';

  const JAREN = [2026, 2027];
  const OPSLAG_SLEUTEL = 'kgb-rekenvariabelen';
  const MAX_KINDEREN = 20;

  const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

  const el = {
    aantalKinderen: document.getElementById('aantal-kinderen'),
    kinderen: document.getElementById('kinderen'),
    toetsingsinkomen: document.getElementById('toetsingsinkomen'),
    heeftToeslagpartner: document.getElementById('heeft-toeslagpartner'),
    partnerLabel: document.getElementById('partner-inkomen-label'),
    toetsingsinkomenPartner: document.getElementById('toetsingsinkomen-partner'),
    openInstellingen: document.getElementById('open-instellingen'),
    instellingen: document.getElementById('instellingen'),
    instellingenRijen: document.getElementById('instellingen-rijen'),
    herstelStandaard: document.getElementById('herstel-standaard'),
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
      const label = document.createElement('label');
      label.textContent = `Leeftijd kind ${index + 1}`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '30';
      input.step = '1';
      input.value = String(leeftijd);
      input.addEventListener('input', () => {
        leeftijden[index] = input.value === '' ? '' : Number(input.value);
        bereken();
      });
      label.appendChild(input);
      el.kinderen.appendChild(label);
    });
  }

  function leeftijdenVoorJaar(jaar) {
    const verschil = jaar - JAREN[0];
    return leeftijden.map((l) => (l === '' ? '' : Number(l) + verschil));
  }

  function bereken() {
    const heeftPartner = el.heeftToeslagpartner.checked;
    el.partnerLabel.hidden = !heeftPartner;

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
        cel.textContent = euro.format(uitkomst[cel.dataset.veld]);
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
  [el.toetsingsinkomen, el.toetsingsinkomenPartner, el.heeftToeslagpartner].forEach((input) =>
    input.addEventListener('input', bereken)
  );
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
