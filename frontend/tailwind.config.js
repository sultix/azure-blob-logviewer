/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        surface: '#0b1326',
        'surface-dim': '#0b1326',
        'surface-bright': '#31394d',
        'surface-container-lowest': '#060e20',
        'surface-container-low': '#131b2e',
        'surface-container': '#171f33',
        'surface-container-high': '#222a3d',
        'surface-container-highest': '#2d3449',
        'on-surface': '#dae2fd',
        'on-surface-variant': '#bec8d2',
        primary: '#89ceff',
        'primary-container': '#0ea5e9',
        'on-primary': '#00344d',
        'on-primary-container': '#003751',
        secondary: '#b7c8e1',
        'secondary-container': '#3a4a5f',
        'on-secondary-container': '#a9bad3',
        tertiary: '#ffb86e',
        'tertiary-container': '#de8712',
        error: '#ffb4ab',
        'error-container': '#93000a',
        outline: '#88929b',
        'outline-variant': '#3e4850',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      backgroundImage: {
        'primary-gradient':
          'linear-gradient(135deg, #89ceff 0%, #0ea5e9 100%)',
      },
      boxShadow: {
        ambient: '0 20px 50px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
