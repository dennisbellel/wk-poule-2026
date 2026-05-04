import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: '#1a5c38',
          light: '#eaf4ef',
          50: '#f0fdf4',
          100: '#eaf4ef',
          600: '#1a5c38',
          700: '#154a2d',
        },
        cream: '#f6f4ef',
        border: '#e5e1d8',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        heading: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
