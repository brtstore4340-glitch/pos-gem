/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans Thai', 'sans-serif'],
      },
      colors: {
        boots: {
          base: '#184290',      // Default Primary Blue
          hover: '#12326b',
          light: '#eef4ff',
          text: '#202124',
          subtext: '#5f6368',
        },
        dark: {
            bg: '#1a1b1e',      // Main background
            panel: '#25262b',   // Panel background
            border: '#2c2e33',  // Borders
            text: '#c1c2c5',    // Primary text
            subtext: '#909296', // Secondary text
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
