/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        'dutch-orange': '#FF9B00',
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
        'sea-mist': {
          50: '#f4f8fb',
          100: '#e8f0f5',
          200: '#d4e1ea',
          300: '#aec4d3',
          400: '#7f9faf',
          500: '#617f90',
          600: '#4c6676',
          700: '#3e5361',
          800: '#31414c',
          900: '#243039',
        },
        horizon: {
          50: '#f6fbff',
          100: '#edf6ff',
          200: '#d9ebfb',
          300: '#b7d8f0',
          400: '#8fc0e1',
          500: '#669fc4',
          600: '#4e7ea1',
          700: '#406481',
          800: '#365169',
          900: '#2d4357',
        },
        'storm-water': {
          50: '#edf3f7',
          100: '#d7e4ec',
          200: '#b1cad8',
          300: '#7fa7bb',
          400: '#58839b',
          500: '#40657c',
          600: '#315165',
          700: '#294252',
          800: '#223443',
          900: '#1b2a36',
        },
        'deep-current': '#14232d',
        'dune-foam': '#f6f1e7',
        'sun-glow': '#d8a55a',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      letterSpacing: {
        widget: '0.24em',
      },
      screens: {
        xs: '390px',
      },
    }
  },
  plugins: []
}
