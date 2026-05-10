'use client'
import { useState } from 'react'
import type { ScoringKeys } from '@/types'

type Slide = {
  emoji: string
  title: string
  body: React.ReactNode
}

export default function OnboardingTour({
  displayName, scoring, onClose, onFinish,
}: {
  displayName: string
  scoring: ScoringKeys
  onClose: () => void  // Sla over of kruisje
  onFinish: () => void // Op 'Aan de slag' op laatste slide
}) {
  const [step, setStep] = useState(0)

  const slides: Slide[] = [
    {
      emoji: '👋',
      title: `Hey ${displayName}, welkom in de poule!`,
      body: (
        <>
          <p>Dit is jouw kans om je voetbalkennis te bewijzen — of er gewoon op los te gokken en te hopen op het beste. Beide werkt prima.</p>
          <p>Een snelle rondleiding van een minuutje, daarna kun je los.</p>
        </>
      ),
    },
    {
      emoji: '🎯',
      title: 'Drie soorten voorspellingen',
      body: (
        <>
          <p>Punten verdien je op drie manieren:</p>
          <ul className="space-y-2 mt-2">
            <li className="flex gap-2"><span>⚽</span><span><b>Wedstrijden</b> — wat wordt de eindstand? En de ruststand? Hoeveel kaarten?</span></li>
            <li className="flex gap-2"><span>📊</span><span><b>Poulestand</b> — wie eindigt waar in de groep, en met hoeveel goals?</span></li>
            <li className="flex gap-2"><span>🏆</span><span><b>Toernooivragen</b> — wie pakt 'm? Wie wordt topscorer? Durf jij Argentinië af te schrijven?</span></li>
          </ul>
        </>
      ),
    },
    {
      emoji: '➕',
      title: 'Hoe scoring werkt',
      body: (
        <>
          <p>Hier komt het mooie: <b>elke invul telt apart</b>.</p>
          <p>
            Voorspel je 1-1 en het wordt 2-1? Het uit-team had je goed → <b>{scoring.match_ft_team} {scoring.match_ft_team === 1 ? 'punt' : 'punten'}</b> erbij.
          </p>
          <p>
            Heb je de hele eindstand exact goed? Dan krijg je daarbovenop een bonus van <b>{scoring.match_ft_exact_bonus} {scoring.match_ft_exact_bonus === 1 ? 'punt' : 'punten'}</b>.
          </p>
          <p className="text-[#888] text-xs italic">Geen "alles of niets" dus. Ook met half raden kun je punten pakken.</p>
        </>
      ),
    },
    {
      emoji: '⏰',
      title: 'Deadlines zijn keihard',
      body: (
        <>
          <p>Elke wedstrijd heeft een deadline = de aftrap. Daarna staat je voorspelling vast, geen pardon.</p>
          <p>Toernooivragen sluiten bij het allereerste fluitsignaal van het WK. Tot die tijd kun je nog twijfelen tussen Brazilië en Frankrijk.</p>
          <p className="text-[#888] text-xs italic">Tip: je ziet aankomende deadlines op de homepage. Mis er geen.</p>
        </>
      ),
    },
    {
      emoji: '📈',
      title: 'Volg de stand op de voet',
      body: (
        <>
          <p>De tussenstand laat zien wie er voorstaat. Pijltjes ▲ ▼ tonen wie er na de laatste uitslag is gestegen of gezakt — dat blijft spannend.</p>
          <p>Op de homepage zie je per wedstrijd een feed: had iemand een perfect score? Of had niemand de uitslag goed (gebeurt vaker dan je denkt 😅)? Reageer met een emoji.</p>
        </>
      ),
    },
    {
      emoji: '🚀',
      title: 'Klaar voor de aftrap?',
      body: (
        <>
          <p>Vragen later? Klik op <b>❓ Help</b> in de zijbalk (desktop) of via de knop op je profielpagina om deze rondleiding opnieuw te zien.</p>
          <p>Tijd om je eerste voorspellingen te doen. We hebben een paar toernooivragen voor je klaarstaan — wie wordt wereldkampioen en zo.</p>
          <p className="text-xs text-[#888]">Veel succes, en hou de feed in de gaten 😎</p>
        </>
      ),
    },
  ]

  const current = slides[step]
  const isLast = step === slides.length - 1

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1a5c38] px-6 py-5 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            aria-label="Sluiten"
          >
            ✕
          </button>
          <div className="text-3xl mb-1">{current.emoji}</div>
          <h2 className="heading text-xl font-extrabold text-white pr-6">{current.title}</h2>
          {/* Progress — klikbaar om snel te springen */}
          <div className="flex gap-1 mt-3">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Naar slide ${i + 1}`}
                className={`h-1 flex-1 rounded-full transition-colors cursor-pointer border-0 ${i <= step ? 'bg-white' : 'bg-white/25 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-sm text-gray-700 space-y-3 overflow-y-auto">
          {current.body}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f6f4ef] flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-sm font-semibold text-[#888] hover:text-gray-900 cursor-pointer border-0 bg-transparent"
            >
              ← Vorige
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-sm font-medium text-[#aaa] hover:text-gray-700 cursor-pointer border-0 bg-transparent"
            >
              Sla over
            </button>
          )}

          <span className="text-xs text-[#aaa]">{step + 1} / {slides.length}</span>

          {isLast ? (
            <button
              onClick={onFinish}
              className="btn-primary text-sm py-2 px-4"
            >
              Aan de slag →
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="btn-primary text-sm py-2 px-4"
            >
              Volgende →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
