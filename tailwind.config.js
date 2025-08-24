/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Inter', 'Segoe UI', 'Roboto']
      },
      boxShadow: {
        soft: "0 10px 30px -10px rgba(0,0,0,0.2)"
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
}