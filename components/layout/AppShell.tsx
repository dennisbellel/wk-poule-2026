'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile, BonusQuestion, ScoringKeys } from '@/types'
import WizardModal from '@/components/predict/WizardModal'
import BonusQuestionItem from '@/components/predict/BonusQuestionItem'
import OnboardingTour from '@/components/onboarding/OnboardingTour'
import { createClient } from '@/lib/supabase/client'
import { formatDateTimeNL } from '@/lib/format'

const NAV_ITEMS = [
  { href: '/', icon: '⚡', label: 'Home', mobileLabel: 'Home' },
  { href: '/predict', icon: '✏️', label: 'Voorspellingen', mobileLabel: 'Voorspel' },
  { href: '/stand', icon: '🏆', label: 'Tussenstand', mobileLabel: 'Stand' },
  { href: '/stats', icon: '📈', label: 'Statistieken', mobileLabel: 'Stats' },
  { href: '/profile', icon: '👤', label: 'Profiel', mobileLabel: 'Profiel' },
]

export default function AppShell({
  profile, scoring, children,
}: {
  profile: Profile | null
  scoring: ScoringKeys
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const supabase = createClient()

  const [showWizard, setShowWizard] = useState(false)
  const [wizardSkipIntro, setWizardSkipIntro] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [tourStartsWizard, setTourStartsWizard] = useState(false)
  const [liveQuestion, setLiveQuestion] = useState<BonusQuestion | null>(null)
  const [liveAnswer, setLiveAnswer] = useState('')
  const [liveSaving, setLiveSaving] = useState(false)
  const [liveSaved, setLiveSaved] = useState(false)

  useEffect(() => {
    async function checkNotifications() {
      if (!profile) return

      // Eerst de onboarding tour als die nog nooit is afgerond
      const onboardedAt = (profile as Profile & { onboarded_at?: string | null }).onboarded_at
      if (!onboardedAt) {
        // Aan einde van de tour starten we de wizard automatisch (eerste keer)
        setTourStartsWizard(true)
        setShowTour(true)
        return
      }

      const { count } = await supabase
        .from('bonus_answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      if (count === 0) {
        setShowWizard(true)
        return
      }

      const now = new Date().toISOString()
      const { data: liveQuestions } = await supabase
        .from('bonus_questions')
        .select('*')
        .eq('active', true)
        .eq('phase', 'live')
        .gt('deadline_at', now)
        .order('created_at', { ascending: false })

      if (!liveQuestions || liveQuestions.length === 0) return

      const ids = liveQuestions.map((q: BonusQuestion) => q.id)
      const { data: answers } = await supabase
        .from('bonus_answers')
        .select('question_id')
        .eq('user_id', profile.id)
        .in('question_id', ids)

      const answeredIds = new Set((answers ?? []).map((a: { question_id: string }) => a.question_id))
      const unanswered = liveQuestions.filter((q: BonusQuestion) => !answeredIds.has(q.id))

      if (unanswered.length > 0) setLiveQuestion(unanswered[0])
    }

    checkNotifications()
  }, [profile])

  // Luister naar custom 'open-help' event vanuit andere pagina's (bijv. profile)
  useEffect(() => {
    const handler = () => {
      setTourStartsWizard(false)
      setShowTour(true)
    }
    window.addEventListener('open-help', handler)
    return () => window.removeEventListener('open-help', handler)
  }, [])

  async function markOnboarded() {
    if (!profile) return
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', profile.id)
  }

  async function handleTourClose() {
    // Sla over of kruisje — markeer als onboarded zodat 'ie niet weer komt
    await markOnboarded()
    setShowTour(false)
    setTourStartsWizard(false)
  }

  async function handleTourFinish() {
    // 'Aan de slag' → markeer onboarded en start wizard (alleen first-time)
    await markOnboarded()
    setShowTour(false)
    if (tourStartsWizard) {
      setWizardSkipIntro(true)  // tour was net de welkom, sla wizard-intro over
      setShowWizard(true)
    }
    setTourStartsWizard(false)
  }

  function openHelp() {
    setTourStartsWizard(false)  // bij handmatig openen geen wizard erna
    setShowTour(true)
  }

  async function submitLiveAnswer() {
    if (!profile || !liveQuestion || !liveAnswer) return
    setLiveSaving(true)

    await supabase.from('bonus_answers').upsert({
      user_id: profile.id,
      question_id: liveQuestion.id,
      answer: liveAnswer,
    }, { onConflict: 'user_id,question_id' })

    setLiveSaving(false)
    setLiveSaved(true)
    setTimeout(() => {
      setLiveQuestion(null)
      setLiveAnswer('')
      setLiveSaved(false)
    }, 1500)
  }

  return (
    <div className="flex min-h-screen bg-[#f6f4ef]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-[#e5e1d8] sticky top-0 h-screen flex-shrink-0">
        <div className="px-6 py-6 border-b border-[#e5e1d8]">
          <span className="heading block text-lg font-extrabold text-[#1a5c38]">Dé WK Poule</span>
          <span className="text-xs text-[#aaa]">FIFA World Cup 2026</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-[#eaf4ef] text-[#1a5c38] font-semibold' : 'text-gray-500 hover:bg-[#f6f4ef]'
                }`}>
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        {profile && (
          <div className="p-4 border-t border-[#e5e1d8] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
              <span className="heading text-xs font-bold text-white">{profile.display_name[0]}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold truncate">{profile.display_name}</span>
              <span className="block text-xs text-[#aaa] truncate">{profile.email}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Hoofd content — headers over volle breedte, content gecentreerd */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Help-knop rechtsboven, altijd bereikbaar */}
        <button
          onClick={openHelp}
          className="absolute top-3 right-3 lg:top-5 lg:right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 lg:bg-white border border-[#e5e1d8] text-xs font-semibold text-gray-700 hover:bg-[#f6f4ef] shadow-sm transition-colors cursor-pointer backdrop-blur-sm"
        >
          <span className="text-sm">❓</span>
          Help
        </button>
        <main className="flex-1 pb-20 lg:pb-0 w-full">
          {children}
        </main>
      </div>

      {/* Mobiele navigatie */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#e5e1d8] flex z-50 pb-safe">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center pt-2.5 pb-1 gap-0.5">
              <span className="text-[18px]">{item.icon}</span>
              <span className={`text-[9px] ${active ? 'font-semibold text-[#1a5c38]' : 'font-normal text-[#ccc]'}`}>
                {item.mobileLabel}
              </span>
              {active && <div className="w-1 h-1 rounded-full bg-[#1a5c38]" />}
            </Link>
          )
        })}
      </nav>

      {/* Onboarding tour */}
      {showTour && profile && (
        <OnboardingTour
          displayName={profile.display_name}
          scoring={scoring}
          onClose={handleTourClose}
          onFinish={handleTourFinish}
        />
      )}

      {/* Wizard modal */}
      {showWizard && (
        <WizardModal
          skipIntro={wizardSkipIntro}
          onClose={() => { setShowWizard(false); setWizardSkipIntro(false) }}
        />
      )}

      {/* Live bonusvraag pop-up */}
      {liveQuestion && !showWizard && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-[#1a5c38] px-6 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  🔴 Live vraag
                </span>
              </div>
              <p className="text-white/80 text-xs mt-1">
                Beantwoord snel — deadline {formatDateTimeNL(liveQuestion.deadline_at)}
              </p>
            </div>
            <div className="px-6 py-5">
              <BonusQuestionItem
                question={liveQuestion}
                value={liveAnswer}
                teams={[]}
                players={[]}
                onSave={setLiveAnswer}
              />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={submitLiveAnswer}
                disabled={!liveAnswer || liveSaving}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  liveSaved ? 'bg-green-500 text-white' : 'bg-[#1a5c38] text-white hover:bg-[#164d2f]'
                } disabled:opacity-40`}
              >
                {liveSaving ? 'Opslaan...' : liveSaved ? '✓ Opgeslagen!' : 'Antwoord insturen'}
              </button>
              <button
                onClick={() => { setLiveQuestion(null); setLiveAnswer('') }}
                className="px-4 py-3 rounded-xl text-sm font-semibold bg-[#f6f4ef] text-gray-500 hover:bg-[#ede9e0] transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
