/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // ← aktifkan dark mode via class
  theme: {
    extend: {},
  },
  plugins: [],
}