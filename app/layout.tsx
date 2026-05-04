import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dé WK Poule 2026',
  description: 'De officiële WK Poule voor FIFA World Cup 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-cream font-sans antialiased">{children}</body>
    </html>
  )
}
