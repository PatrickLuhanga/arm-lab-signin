/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--app-bg)',
        surface: 'var(--surface)',
        'surface-subtle': 'var(--surface-subtle)',
        border: 'var(--border-color)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        success: 'var(--success)',
        'success-fill': 'var(--success-fill)',
        warning: 'var(--warning)',
        'warning-fill': 'var(--warning-fill)',
        danger: 'var(--danger)',
        'danger-fill': 'var(--danger-fill)',
        'role-member': 'var(--role-member)',
        'role-intern': 'var(--role-intern)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: 'none',
        institutional: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
}
