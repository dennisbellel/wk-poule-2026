'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TOUR_STEPS } from './tour-steps'

type TourState = {
  isActive: boolean
  step: number
  totalSteps: number
  start: () => void
  close: () => void
  next: () => void
  previous: () => void
}

const TourContext = createContext<TourState | null>(null)

const STORAGE_KEY = 'wkpoule_tour_state'

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}

export function TourProvider({
  children, profileId, autostart,
}: {
  children: React.ReactNode
  profileId: string | null
  autostart: boolean   // true = onboarded_at IS NULL, start tour automatisch
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isActive, setIsActive] = useState(false)
  const [step, setStep] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate vanuit sessionStorage zodat de tour navigatie tussen pagina's overleeft
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { active: boolean; step: number }
        if (parsed.active) {
          setIsActive(true)
          setStep(Math.min(Math.max(parsed.step, 0), TOUR_STEPS.length - 1))
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Autostart bij eerste login
  useEffect(() => {
    if (!hydrated) return
    if (autostart && !isActive) {
      setIsActive(true)
      setStep(0)
    }
  }, [hydrated, autostart, isActive])

  // Persist naar sessionStorage
  useEffect(() => {
    if (!hydrated) return
    if (isActive) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ active: true, step }))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [hydrated, isActive, step])

  // Bij stap-wissel: navigeer als route anders is dan huidige pad
  useEffect(() => {
    if (!isActive) return
    const target = TOUR_STEPS[step]?.route
    if (target && target !== pathname) {
      router.push(target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isActive])

  const markOnboarded = useCallback(async () => {
    if (!profileId) return
    await supabase
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', profileId)
  }, [profileId, supabase])

  const start = useCallback(() => {
    setStep(0)
    setIsActive(true)
    if (TOUR_STEPS[0].route !== pathname) router.push(TOUR_STEPS[0].route)
  }, [pathname, router])

  const close = useCallback(() => {
    setIsActive(false)
    sessionStorage.removeItem(STORAGE_KEY)
    markOnboarded()
  }, [markOnboarded])

  const next = useCallback(() => {
    setStep(prev => {
      const newStep = prev + 1
      if (newStep >= TOUR_STEPS.length) {
        // Laatste stap: tour afronden
        setIsActive(false)
        sessionStorage.removeItem(STORAGE_KEY)
        markOnboarded()
        return prev
      }
      return newStep
    })
  }, [markOnboarded])

  const previous = useCallback(() => {
    setStep(prev => Math.max(0, prev - 1))
  }, [])

  return (
    <TourContext.Provider value={{
      isActive,
      step,
      totalSteps: TOUR_STEPS.length,
      start, close, next, previous,
    }}>
      {children}
    </TourContext.Provider>
  )
}
