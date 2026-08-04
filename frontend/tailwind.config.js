import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * ComplianceCore design tokens.
 *
 * The application was written against Tailwind's stock palette — 2,900-odd
 * `slate-*`, `blue-*`, `indigo-*` utilities across 102 files. Rather than
 * rewrite every call site (which would touch logic for a purely visual gain),
 * the scales themselves are redefined here. Every existing utility keeps its
 * name and picks up the considered colour.
 *
 * That also silently fixes an identity split: the shell branded on `blue-600`
 * while most list pages branded on `indigo-600`, so "primary" was two different
 * colours depending on the screen. Both now alias the same brand ramp, as do
 * `red`/`rose` for destructive and `green`/`emerald` for success.
 */

// Brand — a deep cobalt. Reads as instrumentation rather than startup indigo,
// and 600 clears 4.5:1 against white (6.6:1) so it is safe for text, not just
// for buttons.
const brand = {
  50: '#ECF4FF',
  100: '#D6E7FF',
  200: '#B0D0FF',
  300: '#7FB2FF',
  400: '#4A8FFA',
  500: '#2470E8',
  600: '#0F56C9',
  700: '#0C45A3',
  800: '#0E3B85',
  900: '#11336E',
  950: '#0A1F45',
};

// Neutrals carry a faint blue cast so they read as related to the brand rather
// than as an unconsidered mid-grey. 50 is pulled further from white than
// Tailwind's slate so that white cards sit *on* the canvas instead of dissolving
// into it, and 200 is a touch stronger so hairline borders survive on a laptop
// screen at 100% brightness.
const neutral = {
  50: '#F4F6FA',
  100: '#E9EDF4',
  200: '#DBE1EB',
  300: '#C2CAD8',
  400: '#97A1B4',
  500: '#667085',
  600: '#4B5568',
  700: '#38414F',
  800: '#232B38',
  900: '#151C27',
  950: '#0B111B',
};

// Semantic status. Deliberately separate from the brand hue: on a compliance
// screen, colour is data — "this control is failing" — and must never be
// confused with "this is clickable".
const success = {
  50: '#E9F9F1',
  100: '#CCF0E0',
  200: '#9BE2C6',
  300: '#5FCDA4',
  400: '#2FB484',
  500: '#129C6D',
  600: '#0A7D58',
  700: '#0A6348',
  800: '#0B4E3A',
  900: '#0A4031',
  950: '#04241C',
};

const warning = {
  50: '#FFF7E8',
  100: '#FDECC8',
  200: '#FAD693',
  300: '#F5B95A',
  400: '#EE9E2E',
  500: '#D9820A',
  600: '#B36405',
  700: '#8E4B09',
  800: '#743C0E',
  900: '#61320F',
  950: '#381A05',
};

const danger = {
  50: '#FEF1F2',
  100: '#FCE0E3',
  200: '#F9C5CB',
  300: '#F49BA6',
  400: '#EC6577',
  500: '#DE3A50',
  600: '#C8203A',
  700: '#A81830',
  800: '#8B182D',
  900: '#77182B',
  950: '#420812',
};

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Token-driven aliases, for new components.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          subtle: 'hsl(var(--surface-subtle))',
          raised: 'hsl(var(--surface-raised))',
        },

        // Redefined stock scales. Every existing utility in the app resolves
        // through these.
        brand,
        slate: neutral,
        gray: neutral,
        zinc: neutral,
        neutral,
        stone: neutral,
        blue: brand,
        indigo: brand,
        sky: brand,
        violet: brand,
        purple: brand,
        green: success,
        emerald: success,
        teal: success,
        lime: success,
        amber: warning,
        yellow: warning,
        orange: warning,
        red: danger,
        rose: danger,
        pink: danger,
      },

      // Softer than Tailwind's defaults at the small end so chips and inputs
      // read as precise, with a distinct large step for cards.
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },

      fontFamily: {
        sans: [
          // Must match the family @fontsource-variable/inter declares, spaces
          // and all — a near-miss here fails silently back to system-ui.
          'Inter Variable',
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        // System monospace only — a second webfont download is not worth it for
        // the handful of screens (API keys, control refs) that use it.
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Cascadia Mono',
          'Consolas',
          'monospace',
        ],
      },

      // A tuned scale rather than the stock one. `xs` moves 12px → 13px because
      // it carries the sidebar, table meta and badges — at 12px the app read as
      // cramped rather than dense. Display sizes get negative tracking, which is
      // what stops large Inter from looking loose.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.9375rem', letterSpacing: '0.01em' }],
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.014em' }],
        '2xl': ['1.5rem', { lineHeight: '1.9375rem', letterSpacing: '-0.019em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.022em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.026em' }],
        '5xl': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },

      // Layered and low-opacity. A single heavy drop shadow is the fastest way
      // to make an enterprise UI look like a template.
      boxShadow: {
        xs: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.05), 0 1px 3px 0 rgb(16 24 40 / 0.04)',
        DEFAULT: '0 1px 2px 0 rgb(16 24 40 / 0.05), 0 1px 3px 0 rgb(16 24 40 / 0.04)',
        md: '0 2px 4px -2px rgb(16 24 40 / 0.06), 0 4px 8px -2px rgb(16 24 40 / 0.08)',
        lg: '0 4px 6px -2px rgb(16 24 40 / 0.04), 0 12px 16px -4px rgb(16 24 40 / 0.08)',
        xl: '0 8px 8px -4px rgb(16 24 40 / 0.04), 0 20px 24px -4px rgb(16 24 40 / 0.10)',
        '2xl': '0 24px 48px -12px rgb(16 24 40 / 0.18)',
        ring: '0 0 0 1px rgb(16 24 40 / 0.06)',
      },

      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'draw-in': { from: { strokeDashoffset: 'var(--dash)' }, to: { strokeDashoffset: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'fade-in': 'fade-in 0.18s ease-out both',
        'fade-up': 'fade-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slide-in-left 0.24s cubic-bezier(0.16, 1, 0.3, 1) both',
        'draw-in': 'draw-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
      },

      transitionTimingFunction: {
        // A gentle overshoot-free ease that feels responsive without bouncing —
        // the house curve for anything that moves.
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
