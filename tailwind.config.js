/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'dutch-blue': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        'weather': {
          sky:    '#0ea5e9',
          cloud:  '#94a3b8',
          rain:   '#3b82f6',
          storm:  '#1e3a8a',
          clear:  '#fbbf24',
        },
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      screens: {
        xs: '390px',
      },
    }
  },
  plugins: []
}
