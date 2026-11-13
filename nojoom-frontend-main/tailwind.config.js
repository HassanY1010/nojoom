/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        arabic: ['Inter', 'Cairo', 'sans-serif'],
        english: ['Inter', 'sans-serif'],
      },
      colors: {
        /* Unify purple shades to primary accent token */
        purple: {
          50: 'rgb(var(--primary-accent) / <alpha-value>)',
          100: 'rgb(var(--primary-accent) / <alpha-value>)',
          200: 'rgb(var(--primary-accent) / <alpha-value>)',
          300: 'rgb(var(--primary-accent) / <alpha-value>)',
          400: 'rgb(var(--primary-accent) / <alpha-value>)',
          500: 'rgb(var(--primary-accent) / <alpha-value>)',
          600: 'rgb(var(--primary-accent) / <alpha-value>)',
          700: 'rgb(var(--primary-accent) / <alpha-value>)',
          800: 'rgb(var(--primary-accent) / <alpha-value>)',
          900: 'rgb(var(--primary-accent) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
