/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['DelaGothicOne', 'Arial Black', 'sans-serif'],
        'body': ['Heliopolis', 'Arial', 'sans-serif'],
      },
      fontWeight: {
        'black': '900',
        'extrabold': '800',
        'bold': '700',
        'semibold': '600',
        'medium': '500',
        'normal': '400',
      }
    },
  },
  plugins: [],
}
