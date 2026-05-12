export type TourStep = {
  route: string
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/',
    title: 'Welkom in de poule! 👋',
    body: 'Een korte rondleiding door de app — minder dan een minuutje. Je ziet hieronder een banner met uitleg, en links/rechts navigeer je tussen stappen.',
  },
  {
    route: '/',
    title: 'Jouw status in één oogopslag',
    body: 'Bovenaan zie je drie cards: je positie in de stand, het totaal aantal punten dat je hebt verdiend, en welk percentage je tot nu toe goed had.',
  },
  {
    route: '/',
    title: 'Tikkende deadline',
    body: 'Boven de cards staat een live countdown naar de eerstvolgende wedstrijd of bonusvraag. Hij wordt amber als je nog minder dan 2 uur hebt, en rood vanaf 30 minuten.',
  },
  {
    route: '/',
    title: 'Deadlines + Tussenstand',
    body: 'Links zie je welke voorspellingen je nog moet doen, rechts de actuele tussenstand. Klik door om snel naar de juiste plek te springen.',
  },
  {
    route: '/',
    title: 'In jouw vizier 🎯',
    body: 'Op de homepage staat ook een rivaliteit-card: de speler één plek boven jou (of onder je als je #1 bent), met het puntverschil. Houd hem in de gaten.',
  },
  {
    route: '/predict',
    title: 'Voorspellingen invullen',
    body: 'Per wedstrijd vul je eindstand, ruststand en kaarten in. Elke goede invul levert punten op — geen alles-of-niets. Bij een volledig exacte eindstand krijg je een extra bonus.',
  },
  {
    route: '/stand',
    title: 'Stand met dynamiek',
    body: 'Pijltjes ▲▼ laten zien wie er gestegen of gezakt is sinds de vorige publicatie. Onder je naam staat het percentage dat je tot nu toe goed had.',
  },
  {
    route: '/stats',
    title: 'De interessante cijfers',
    body: 'Een lijngrafiek van jouw positie over tijd, plus panelen voor trefzekerheid, topscoorders per wedstrijd, en de grootste klimmers en dalers. Veel succes! 🚀',
  },
]
