# calculatorKGB
bereken het kindgebonden budget

Rekenhulp (frontend) die het kindgebonden budget voor **2026** en **2027** berekent, per jaar en per maand.

## Gebruik

Open `index.html` in de browser (of serveer de map, bijvoorbeeld met `python3 -m http.server`).

Invoer (standaard: 2 kinderen van 0 jaar, uw toetsingsinkomen € 50.000 en een toeslagpartner met
€ 30.000):
- aantal kinderen en de leeftijd per kind (op 1 januari 2026; voor 2027 wordt 1 jaar ouder gerekend)
- uw toetsingsinkomen
- wel / geen toeslagpartner en het toetsingsinkomen van de toeslagpartner

De inkomens kunnen worden ingetypt of met een schuifregelaar (€ 0 – € 200.000) worden ingesteld; de
−/+ knoppen en de pijltjestoetsen verspringen per € 1.000. Alle uitkomsten worden afgerond op hele euro's
getoond.

De grafiek onder de uitkomsten toont het maandelijkse kindgebonden budget bij gezamenlijke inkomens van
€ 0 tot € 200.000, uitgaande van twee personen en de ingevulde kindgegevens. Beweeg met de muis over de
grafiek (of tik erop) om de bedragen per jaar bij een inkomen te zien; met het toetsenbord kan dat via de
pijltjestoetsen (per € 1.000), Page Up/Page Down (per € 10.000) en Home/End.

Via de knop **Rekenvariabelen** kunt u per jaar de gebruikte waarden inzien en aanpassen
(opgeslagen in de browser, met een knop om de standaardwaarden te herstellen):
- drempelinkomen alleenstaande ouder / met toeslagpartner
- maximaal bedrag per kind en de verhogingen voor kinderen van 12 t/m 15 en 16 of 17 jaar
- alleenstaande-ouderkop
- afbouwpercentage
- inkomensgrens verhoogd afbouwpercentage en verhoogd afbouwpercentage (vanaf 2027)

De standaardwaarden voor 2027 zijn voorlopig; controleer de actuele bedragen bij de Belastingdienst.

## Berekening

Maximaal bedrag = som van (bedrag per kind + eventuele leeftijdsverhoging) voor kinderen tot 18 jaar,
plus de alleenstaande-ouderkop als er geen toeslagpartner is. Hierop gaat het afbouwpercentage af over
het (gezamenlijke) toetsingsinkomen boven het drempelinkomen; boven de inkomensgrens geldt het verhoogde
afbouwpercentage. Het bedrag per maand is het jaarbedrag gedeeld door 12.

## Tests

```
npm test
```
