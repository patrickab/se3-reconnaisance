export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#071014',
          panel: '#0d171b',
          panel2: '#142127',
          border: '#243640',
          text: '#e4ece7',
          secondary: '#a9b8b2',
          muted: '#70817a',
          accent: '#d0a85c',
          danger: '#d45a4c',
          success: '#7aa67a',
          warning: '#c7a65a',
          caution: '#b88454',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Aptos', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
