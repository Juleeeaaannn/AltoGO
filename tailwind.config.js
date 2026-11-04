/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B1511', 800: '#111E18', 700: '#17281F', 600: '#22392C' },
        cream: { DEFAULT: '#F4F5F7', dark: '#E9EBEE' },
        lime: { DEFAULT: '#CDF564', 300: '#E2FB9E', 400: '#D8F97F', 500: '#CDF564', 600: '#A9D93F' },
        moss: '#5F6B62'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 18px 45px -24px rgba(11,21,17,.35)',
        card: '0 18px 40px -26px rgba(11,21,17,.45)'
      }
    }
  },
  plugins: []
};
