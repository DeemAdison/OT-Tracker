/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#b31b27',
          hover: '#951620',
          light: '#fdf2f2',
          border: '#f5c2c7'
        },
        secondary: {
          DEFAULT: '#5e6266',
          hover: '#494c4f',
          light: '#f1f3f5'
        }
      },
      fontFamily: {
        thai: ['"IBM Plex Sans Thai"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
