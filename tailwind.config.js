/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "Noto Sans", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f5f7fa',
          alt: '#fcfcfd'
        },
        brand: {
          50: '#eef6ff',
          100: '#daeefe',
          200: '#b5dcfd',
          300: '#88c8fb',
          400: '#52adf7',
          500: '#2b91ee',
          600: '#1771d0',
          700: '#1156a3',
          800: '#124a84',
          900: '#133f6d'
        }
      },
      boxShadow: {
        'soft': '0 2px 4px -2px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.06)',
        'elevated': '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 15px -3px rgba(0,0,0,0.08)',
        'glow': '0 0 0 1px rgba(255,255,255,0.6), 0 2px 8px rgba(34,139,230,0.25)'
      },
      borderRadius: {
        'xl': '1rem'
      },
      backdropBlur: {
        xs: '2px'
      },
      animation: {
        'fade-in': 'fadeIn .4s ease'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}