export type TourSlide = {
  emoji: string
  title: string
  body: string[]   // elke string = paragraaf
}

// Geen route-navigatie meer; tour is een modal met slides. Eén of meer slides per
// menu-item, gegroepeerd zodat een nieuwe gebruiker alles tegenkomt wat de app
// kan zonder over te rennen.
export const TOUR_SLIDES: TourSlide[] = [
  {
    emoji: '👋',
    title: 'Welkom in de poule!',
    body: [
      'Een korte rondleiding van een minuutje. Je leert de hele app kennen: home, voorspellingen, tussenstand, statistieken en je profiel.',
      'Klik door de slides — overslaan kan ook, je kunt altijd terug via de Help-knop.',
    ],
  },
  {
    emoji: '⚡',
    title: 'Home — jouw status',
    body: [
      'Bovenaan zie je een live countdown naar de eerstvolgende deadline. Hij wordt amber bij minder dan 2 uur en rood vanaf 30 minuten.',
      'Daaronder drie cards: je positie in de stand, totaal aantal punten, en welk percentage van je voorspellingen je tot nu toe goed had.',
    ],
  },
  {
    emoji: '🎯',
    title: 'Home — deadlines, stand & rivaliteit',
    body: [
      'Twee blokken naast elkaar: links wat je nog moet voorspellen, rechts hoe iedereen er nu voor staat.',
      'Onderaan een rivaliteit-card die de speler één plek boven je (of #2 als je zelf eerste bent) laat zien, plus een feed met bijzondere scores per gespeelde wedstrijd. Reageer met een emoji als je iets gaaf vindt.',
    ],
  },
  {
    emoji: '✏️',
    title: 'Voorspellingen — hoe scoring werkt',
    body: [
      'Geen alles-of-niets. Elke goede invul levert punten op — thuis-eindstand goed, uit-eindstand goed, ruststand, kaarten, het telt allemaal apart.',
      'Heb je de héle eindstand exact goed? Dan krijg je daarbovenop een bonus. De exacte puntenwaardes staan in de admin scoring config en kunnen veranderen.',
    ],
  },
  {
    emoji: '⚽',
    title: 'Voorspellingen — Groepsfase',
    body: [
      'Onder de tab Groepsfase staan drie sub-tabs:',
      '⚽ Wedstrijden — vul per wedstrijd eindstand, ruststand en kaarten in.',
      '📊 Poulestand — sleep teams in de juiste volgorde en vul stats in (punten, goals, kaarten) voor elke groep.',
      '🎯 Bonusvragen — vragen die specifiek bij de groepsfase horen, sluiten bij de start van het toernooi.',
    ],
  },
  {
    emoji: '🏆',
    title: 'Voorspellingen — Knockout',
    body: [
      'Alle 32 knockout-wedstrijden staan al klaar, maar de teams zijn pas bekend na de groepsfase. Tot dan zie je "Wachten op teams" met de placeholder (bv. "Winnaar A vs 2e B").',
      'Zodra de admin de teams toewijst (kan ook midden in het toernooi al per wedstrijd) wordt de kaart vanzelf voorspelbaar — deadline is de aftrap.',
    ],
  },
  {
    emoji: '⭐',
    title: 'Voorspellingen — Toernooi & Bonusvragen',
    body: [
      'Onder Toernooi staan de grote vragen: wereldkampioen, topscorer, ga zo maar door. Sluiten bij start van het WK.',
      'Onder Bonusvragen verschijnen tijdens het toernooi extra vragen met een korte deadline. Houd je profiel of de homepage in de gaten.',
    ],
  },
  {
    emoji: '🏅',
    title: 'Tussenstand',
    body: [
      'Iedereen op rij, met je eigen rij groen gemarkeerd. Pijltjes ▲▼ tonen wie er is gestegen of gezakt sinds de vorige publicatie.',
      'Onder elke naam staat hoeveel inputs je tot nu toe goed had, en het bijbehorende percentage.',
    ],
  },
  {
    emoji: '📈',
    title: 'Statistieken',
    body: [
      'Een lijngrafiek van jouw positie over tijd — leuk om je opmars (of val) te volgen.',
      'Daaronder Trefzekerheid (% wedstrijden met exact goede eindstand), Topscoorder per wedstrijd, en de grootste Klimmers + Dalers. Lekker materiaal voor in de groepsapp.',
    ],
  },
  {
    emoji: '🚀',
    title: 'Klaar voor de aftrap!',
    body: [
      'Op je Profiel staan je accountgegevens en kun je uitloggen.',
      'Vragen later? Op desktop staat een ❓ Help-knop rechtsboven, op mobile vind je een knop op je profielpagina om deze rondleiding opnieuw te bekijken.',
      'Veel succes — en hou de feed in de gaten 😎',
    ],
  },
]
