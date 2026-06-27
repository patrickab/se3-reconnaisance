export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#080c10',
          panel: '#0c1218',
          panel2: '#101820',
          border: '#26323d',
          text: '#e2e8ee',
          secondary: '#9aa8b4',
          muted: '#65727d',
          accent: '#8ecae6',
          danger: '#ff3b30',
          success: '#66c28f',
          warning: '#d9b35f',
          caution: '#d58a3a',
        },
      },
      fontFamily: {
        sans: ['SF Pro Display', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
