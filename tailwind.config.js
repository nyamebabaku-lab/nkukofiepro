import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
const scale = (name) => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, `rgb(var(--${name}-${k}) / <alpha-value>)`]));

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        // Warm greys everywhere instead of cool slate, to sit well on cream.
        slate: colors.stone,
        brand: scale('brand'),
        accent: scale('accent'),
        gold: { 50: '#fdf8ec', 100: '#f9edcc', 200: '#f2d993', 300: '#ebc565', 400: '#e2b44f', 500: '#d9a441', 600: '#b9862c', 700: '#946623', 800: '#704d1e', 900: '#4f3716' },
        cream: { 50: '#fbf8f2', 100: '#f6f1e7', 200: '#ece3d0', 300: '#ddd0b4' },
        // Dark surfaces: deep forest rather than navy.
        navy: { 700: '#1d3326', 800: '#16271d', 900: '#101d16', 950: '#0a130e' },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(31,61,43,.05), 0 4px 16px rgba(31,61,43,.07)',
        lift: '0 10px 32px rgba(31,61,43,.14)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.96)' }, to: { opacity: 1, transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'pulse-soft': { '50%': { opacity: 0.6 } },
        float: { '50%': { transform: 'translateY(-8px)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'none', opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out',
        'scale-in': 'scale-in .18s ease-out',
        'slide-in': 'slide-in .22s ease-out',
        'slide-up': 'slide-up .25s cubic-bezier(.2,.8,.2,1)',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
        pop: 'pop .5s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
