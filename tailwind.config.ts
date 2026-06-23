import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Newsreader', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Public Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Public Sans', 'system-ui', 'sans-serif'], // aliased to Public Sans (frame 30)
      },
      colors: {
        forest: { DEFAULT: '#1F4D2B', light: '#2D6B3C', dark: '#163820' },
        ochre:  { DEFAULT: '#C07A1E', light: '#D4922A', dark: '#9A6018' },
        water:    '#235E86',
        paper:    '#F7F2E9',
        card:     '#FBF6EC',
        ink:    { DEFAULT: '#20190F', muted: '#5C5040', faint: '#8C7A62' },
        hairline: '#E2D8C4',
      },
      borderRadius: {
        sm: '6px', md: '10px', lg: '14px', xl: '20px', '2xl': '28px',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(32,25,15,0.08),0 1px 2px rgba(32,25,15,0.06)',
        panel: '0 4px 16px rgba(32,25,15,0.12)',
        float: '0 8px 32px rgba(32,25,15,0.16)',
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'fade-up':   'fadeUp 0.2s ease-out',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
