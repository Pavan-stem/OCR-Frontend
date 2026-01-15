export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-from-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'zoom-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--animate-duration, 0.5s) var(--animate-ease, ease-out)',
        'slide-in-from-top': 'slide-in-from-top var(--animate-duration, 0.5s) var(--animate-ease, ease-out)',
        'slide-in-from-bottom': 'slide-in-from-bottom var(--animate-duration, 0.5s) var(--animate-ease, ease-out)',
        'slide-in-from-left': 'slide-in-from-left var(--animate-duration, 0.5s) var(--animate-ease, ease-out)',
        'slide-in-from-right': 'slide-in-from-right var(--animate-duration, 0.5s) var(--animate-ease, ease-out)',
        'zoom-in': 'zoom-in var(--animate-duration, 0.5s) var(--animate-ease, ease-out)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.animate-in': {
          '--animate-duration': '0.5s',
          '--animate-ease': 'ease-out',
          'animation-fill-mode': 'both',
        },
        '.fade-in': {
          'animation-name': 'fade-in',
        },
        '.slide-in-from-top-2': {
          'animation-name': 'slide-in-from-top',
          '--slide-distance': '0.5rem',
        },
        '.slide-in-from-top-4': {
          'animation-name': 'slide-in-from-top',
          '--slide-distance': '1rem',
        },
        '.slide-in-from-bottom-4': {
          'animation-name': 'slide-in-from-bottom',
          '--slide-distance': '1rem',
        },
        '.slide-in-from-bottom-8': {
          'animation-name': 'slide-in-from-bottom',
          '--slide-distance': '2rem',
        },
        '.slide-in-from-left': {
          'animation-name': 'slide-in-from-left',
        },
        '.slide-in-from-right': {
          'animation-name': 'slide-in-from-right',
        },
        '.zoom-in': {
          'animation-name': 'zoom-in',
        },
        '.zoom-in-95': {
          'animation-name': 'zoom-in',
          '--zoom-start': '0.95',
        },
        '.duration-200': {
          '--animate-duration': '200ms',
        },
        '.duration-300': {
          '--animate-duration': '300ms',
        },
        '.duration-500': {
          '--animate-duration': '500ms',
        },
        '.duration-700': {
          '--animate-duration': '700ms',
        },
      });
    },
  ],
}
