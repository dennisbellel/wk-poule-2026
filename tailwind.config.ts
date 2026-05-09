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
          800: '#164d2f',
          border: '#c8e6d4',
        },
        cream: {
          DEFAULT: '#f6f4ef',
          dark: '#ede9e0',
          tint: '#f0ede6',
          divider: '#edeae3',
        },
        border: {
          DEFAULT: '#e5e1d8',
          mid: '#c8c4bc',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          mute: '#777',
          subtle: '#888',
          soft: '#999',
          dim: '#aaa',
          ghost: '#ccc',
        },
        surface: {
          hover: '#fafaf9',
        },
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
