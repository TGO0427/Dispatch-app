/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Override standard colors to use CSS variables for theme support
        white: 'rgb(var(--color-surface) / <alpha-value>)',
        gray: {
          50:  'rgb(var(--color-surface-secondary) / <alpha-value>)',
          100: 'rgb(var(--color-surface-tertiary) / <alpha-value>)',
          200: 'rgb(var(--color-border) / <alpha-value>)',
          300: 'rgb(var(--color-border-strong) / <alpha-value>)',
          400: 'rgb(var(--color-text-muted) / <alpha-value>)',
          500: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
          600: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          700: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          800: '#1e293b',
          900: 'rgb(var(--color-text-primary) / <alpha-value>)',
        },
        // Accent subtle backgrounds that adapt to theme
        blue: {
          50: 'rgb(var(--color-blue-subtle) / <alpha-value>)',
        },
        red: {
          50: 'rgb(var(--color-red-subtle) / <alpha-value>)',
        },
        green: {
          50: 'rgb(var(--color-green-subtle) / <alpha-value>)',
        },
        yellow: {
          50: 'rgb(var(--color-yellow-subtle) / <alpha-value>)',
        },
        purple: {
          50: 'rgb(var(--color-purple-subtle) / <alpha-value>)',
        },
        amber: {
          50: 'rgb(var(--color-amber-subtle) / <alpha-value>)',
        },
        resilinc: {
          primary: '#52A547',       // Synercore brand green
          'primary-dark': '#3F8A37', // Synercore brand green (hover)
          alert: '#EF4444',
          warning: '#F97316',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'card': '8px',
      },
    },
  },
  plugins: [],
}
