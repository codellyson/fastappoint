/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './resources/**/*.edge',
    './resources/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Primary Color - Vibrant Blue
        primary: {
          DEFAULT: '#0066ff',
          light: '#3385ff',
          dark: '#0052cc',
          50: '#e6f2ff',
          100: '#b3d9ff',
          200: '#80c0ff',
          300: '#4da7ff',
          400: '#1a8eff',
          500: '#0066ff',
          600: '#0052cc',
          700: '#003d99',
          800: '#002966',
          900: '#001433',
        },

        // Semantic Colors
        success: {
          DEFAULT: '#00c853',
          light: '#69f0ae',
          dark: '#00a844',
          bg: '#e8f5e9',
        },
        warning: {
          DEFAULT: '#ff9500',
          light: '#ffb84d',
          dark: '#cc7700',
          bg: '#fff3e0',
        },
        error: {
          DEFAULT: '#ff3b30',
          light: '#ff6b62',
          dark: '#cc2f26',
          bg: '#ffebee',
        },
        info: {
          DEFAULT: '#00b8d4',
          light: '#4dd0e1',
          dark: '#0093a8',
          bg: '#e0f7fa',
        },

        // Accent Colors
        purple: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          dark: '#7c3aed',
        },
        pink: {
          DEFAULT: '#ec4899',
          light: '#f472b6',
          dark: '#db2777',
        },
        teal: {
          DEFAULT: '#14b8a6',
          light: '#2dd4bf',
          dark: '#0f766e',
        },
        amber: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
        },
      },

      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'primary': '0 4px 14px 0 rgba(0, 102, 255, 0.2)',
        'success': '0 4px 14px 0 rgba(0, 200, 83, 0.2)',
        'warning': '0 4px 14px 0 rgba(255, 149, 0, 0.2)',
        'error': '0 4px 14px 0 rgba(255, 59, 48, 0.2)',
      },

      borderRadius: {
        'sm': '0.5rem',   // 8px
        'DEFAULT': '0.75rem', // 12px
        'md': '0.75rem',  // 12px
        'lg': '1rem',     // 16px
        'xl': '1.5rem',   // 24px
        '2xl': '2rem',    // 32px
      },

      animation: {
        'scale-in': 'scaleIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },

      keyframes: {
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
