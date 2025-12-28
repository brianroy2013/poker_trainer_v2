/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#35654d',
          dark: '#2a5040',
          light: '#407a5c'
        },
        wood: {
          DEFAULT: '#4a3728',
          dark: '#362a1e',
          light: '#5c4433'
        }
      },
      boxShadow: {
        'card': '2px 2px 8px rgba(0,0,0,0.3)',
        'chip': '0 2px 4px rgba(0,0,0,0.4)'
      }
    },
  },
  plugins: [],
}
