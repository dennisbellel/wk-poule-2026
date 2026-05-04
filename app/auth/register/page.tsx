'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function RegisterForm() {
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.email) setEmail(data.session.user.email)
    })
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { setError('Wachtwoorden komen niet overeen'); return }
    if (password.length < 8) { setError('Wachtwoord moet minimaal 8 tekens zijn'); return }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({
      password,
      data: { display_name: displayName }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/?wiz