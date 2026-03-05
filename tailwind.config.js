/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#D4AF37',
          dark: '#AA8C2C',
          light: '#F3E5AB'
        },
        surface: '#121212',
        surface100: '#1E1E1E',
        surface200: '#2C2C2C'
      },
      boxShadow: {
        glow: '0 16px 48px rgba(212, 175, 55, 0.16)'
      }
    }
  },
  plugins: []
}
