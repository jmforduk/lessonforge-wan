/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde6ff',
          200: '#c0d0ff',
          300: '#93afff',
          400: '#6088ff',
          500: '#3b5fff',
          600: '#1f3ef5',
          700: '#172ce0',
          800: '#1925b5',
          900: '#1a248f',
        },
        amd: {
          red: '#ED1C24',
          dark: '#1a1a2e',
        }
      }
    },
  },
  plugins: [],
}
