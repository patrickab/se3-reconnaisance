export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#0a0e13',
          border: '#243042',
          text: '#cfd8e3',
          secondary: '#9fb0c3',
          accent: '#7fd1ff',
          danger: '#ff2e2e',
          success: '#1fb866',
          warning: '#ffe14d',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
