/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#328E6E',
        'brand-medium': '#67AE6E',
        'brand-light': '#90C67C',
        'brand-lighter': '#E1EEBC',
      }
    },
  },
  plugins: [],
}
