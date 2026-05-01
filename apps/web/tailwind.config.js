/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      colors: {
        poker: {
          bg: '#0F172A',
          card: '#1E3A5F',
          hover: '#2563EB',
        },
      },
    },
  },
  plugins: [],
};
