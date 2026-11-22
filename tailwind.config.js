/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Mona Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "Noto Sans", "sans-serif"],
        mono: ['"Courier Prime"', "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: '#fbfbf9', // warm-tinted paper, matches .lp-root --paper
          subtle: '#f2f2ef',
          alt: '#ffffff'
        },
        brand: {
          accent: '#383da6', // ≈ oklch(0.38 0.15 265) ink-indigo (locked)
          hover: '#2d338f',  // ≈ oklch(0.32 0.16 265)
          dark: '#111111',
          // Named shades used by legacy editor chrome
          50:  '#eeeef7',
          100: '#dcdcef',
          200: '#b3b4df',
          300: '#8a8cce',
          400: '#6064be',
          500: '#4a4eb2',
          600: '#383da6',
          700: '#2d338f',
          800: '#222877',
          900: '#191d5e',
        },
        // Remap Tailwind's default `purple.*` palette to ink-indigo so
        // ElementsSidebar + color pickers (which use `purple-500` etc. everywhere)
        // inherit the new brand without a line-by-line rewrite.
        purple: {
          50:  '#eeeef7',
          100: '#dcdcef',
          200: '#b3b4df',
          300: '#8a8cce',
          400: '#6064be',
          500: '#4a4eb2',
          600: '#383da6',
          700: '#2d338f',
          800: '#222877',
          900: '#191d5e',
        },
      },
      boxShadow: {
        'soft': 'none',
        'elevated': '0 1px 2px -1px rgba(20, 25, 60, 0.09), 0 12px 32px -12px rgba(20, 25, 60, 0.18)',
        'glow': '0 0 0 1px rgba(56, 61, 166, 0.35), 0 2px 8px rgba(56, 61, 166, 0.18)'
      },
      borderRadius: {
        'xl': '0.125rem', // sharp corners
        'lg': '0.125rem',
        'md': '0.125rem',
        'sm': '0px'
      },
      backdropBlur: {
        xs: '2px'
      },
      animation: {
        'fade-in': 'fadeIn .2s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}