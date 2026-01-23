/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claimer Dashboard - Orange/Amber theme
        claimer: {
          DEFAULT: '#f59e0b', // Amber-500
          light: '#fbbf24',   // Amber-400
          dark: '#d97706',    // Amber-600
        },
        // Surface colors (dark theme)
        surface: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          750: '#363636',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Accent (success green)
        accent: {
          DEFAULT: '#22c55e',
          light: '#4ade80',
          dark: '#16a34a',
        },
        // Danger (red)
        danger: {
          DEFAULT: '#ef4444',
          light: '#f87171',
          dark: '#dc2626',
        },
        // Other dashboard colors for reference
        governance: {
          DEFAULT: '#8b5cf6',
          400: '#a78bfa',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        council: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
          dark: '#0891b2',
        },
      }
    },
  },
  plugins: [],
}
