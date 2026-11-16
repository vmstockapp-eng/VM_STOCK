/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'navy-DEFAULT': '#102C42',
        'teal-DEFAULT': '#0D827D',
        navy: {
          DEFAULT: '#102C42',
          DEFAULT_COLOR: '#102C42',
          50: '#E8EEF3',
          100: '#C5D3DD',
          500: '#1A4A6B',
          600: '#133758',
          700: '#0E2840',
          800: '#0A1E32',
          900: '#060F1A'
        },
        teal: {
          DEFAULT: '#0D827D',
          50: '#E7F3F1',
          100: '#C3E2DF',
          500: '#0D827D',
          600: '#0A6E6A',
          700: '#085A57',
          800: '#064644',
          900: '#043231'
        },
        brand: {
          bg: '#F4F7FA',
          card: '#FFFFFF',
          tableHeader: '#E7F3F1',
          textPrimary: '#20384A',
          textSecondary: '#72869A',
          border: '#DCE5EB',
          success: '#16845B',
          warning: '#D97706',
          error: '#DC4C4C'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,44,66,0.08), 0 1px 2px rgba(16,44,66,0.04)',
        'card-hover': '0 4px 12px rgba(16,44,66,0.12), 0 2px 4px rgba(16,44,66,0.06)'
      }
    },
  },
  plugins: [],
}
