/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#C8A97E',
          dark: '#A88962',
          light: '#E6D3B6'
        },
        surface: '#1B1714',
        surface100: '#24201C',
        surface200: '#352F28'
      },
      boxShadow: {
        glow: '0 18px 48px rgba(200, 169, 126, 0.22)'
      }
    }
  },
  plugins: []
}
