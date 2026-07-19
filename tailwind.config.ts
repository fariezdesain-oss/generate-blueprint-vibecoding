import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        display: ['var(--font-space-grotesk)'],
      },
      colors: {
        surface: 'var(--bg-secondary)',
        accent: {
          DEFAULT: 'var(--gemini-green)',
          light: 'var(--gemini-green)',
          dark: 'var(--gemini-green)',
        },
        gemini: {
          blue: 'var(--gemini-blue)',
          red: 'var(--gemini-red)',
          orange: 'var(--gemini-orange)',
          green: 'var(--gemini-green)',
          teal: 'var(--gemini-teal)',
          purple: 'var(--gemini-purple)',
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
        'fade-in': 'fade-in 0.25s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'bounce-dot': 'bounce-dot 1.4s infinite ease-in-out both',
        'wand-swing': 'wand-swing 1.5s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        'wand-swing': {
          '0%, 100%': { transform: 'rotate(-25deg)' },
          '50%': { transform: 'rotate(25deg)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
