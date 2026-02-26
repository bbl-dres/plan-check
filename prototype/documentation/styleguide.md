# plan-check Style Guide

## Design System Reference

This styleguide is based on the **Swiss Federal Design System**:

| Repository | Description | Status |
|------------|-------------|--------|
| [swiss/designsystem](https://github.com/swiss/designsystem) | **Modern** design system (Nuxt/Vue, Storybook) | ✅ Use this |
| [swiss/styleguide](https://github.com/swiss/styleguide) | Legacy styleguide (Fabricator, Bootstrap-based) | ⚠️ Reference only |

> **Important:** Always refer to `swiss/designsystem` for new projects. The legacy `swiss/styleguide` is maintained for backward compatibility but new features are developed in the modern system.

**Live Documentation:**
- Modern: https://swiss.github.io/designsystem/
- Legacy: https://swiss.github.io/styleguide/en/
- Figma Library: https://www.figma.com/design/3UYgqxmcJbG0hpWuti3y8U/

---

## Design Philosophy

plan-check follows the **Swiss Federal Corporate Design** guidelines and draws from the **International Typographic Style** (Swiss Style) principles:

- **Clarity over decoration** — Every element serves a purpose
- **Grid-based layouts** — Mathematical precision and harmony
- **Sans-serif typography** — Clean, readable, objective
- **Generous whitespace** — Content breathes, focus is clear
- **Minimal color palette** — Purposeful use of color for meaning
- **Objective imagery** — Photography over illustration

> "The solution to the design problem should emerge from its content."
> — Ernst Keller, Swiss Design Pioneer

---

## Color Palette

### Official Swiss Federal Colors

These colors are **CD elements** (Corporate Design) — their use is **mandatory** and they **may not be modified**.

```css
:root {
  /* === PRIMARY COLORS (Official CD) === */
  
  /* Swiss Confederation Red - Header line, selections, hover states */
  --color-venetian-red: #DC0018;    /* $venetian-red - Primary red */
  --color-red: #F7001D;              /* $red - Lighter red accent */
  
  /* Cerulean Blue - Links, interactive elements */
  --color-cerulean: #006699;         /* $cerulean - Primary blue */
  
  /* === BACKGROUND COLORS === */
  --color-solitude: #E7EDEF;         /* $solitude - Light blue-gray */
  --color-clear-day: #F2F7F9;        /* $clear-day - Very light blue */
  --color-pattens-blue: #D8E8EF;     /* $pattens-blue - Soft blue */
  --color-malibu: #66AFE9;           /* $malibu - Focus ring blue */
  --color-mocassin: #FFFAB2;         /* $mocassin - Highlight yellow */
  
  /* === GRAYSCALE === */
  --color-black: #000000;            /* $black */
  --color-night-rider: #333333;      /* $night-rider - Body text */
  --color-coal: #454545;             /* $coal - Dark gray */
  --color-empress: #757575;          /* $empress - Medium gray */
  --color-silver: #CCCCCC;           /* $silver - Borders */
  --color-light-grey: #D5D5D5;       /* $light-grey */
  --color-gainsboro: #E5E5E5;        /* $gainsboro - Light borders */
  --color-smoke: #F5F5F5;            /* $smoke - Background */
  --color-white: #FFFFFF;            /* $white */

  /* === GRAY SCALE (Numeric) === */
  /* Standardized gray scale for component usage */
  --color-gray-50: #FAFAFA;          /* Lightest - subtle backgrounds */
  --color-gray-100: #F5F5F5;         /* Same as $smoke */
  --color-gray-200: #E5E5E5;         /* Same as $gainsboro - borders */
  --color-gray-300: #D5D5D5;         /* Same as $light-grey */
  --color-gray-400: #CCCCCC;         /* Same as $silver */
  --color-gray-500: #757575;         /* Same as $empress - medium */
  --color-gray-600: #666666;         /* Secondary text */
  --color-gray-700: #454545;         /* Same as $coal */
  --color-gray-800: #333333;         /* Same as $night-rider */
  --color-gray-900: #1A1A1A;         /* Near black - high contrast */
}
```

### Color Usage Guide

| Color | Variable | Hex | Usage |
|-------|----------|-----|-------|
| 🟥 Venetian Red | `$venetian-red` | `#DC0018` | Header red line, selected nav items, link hover |
| 🔴 Red | `$red` | `#F7001D` | Lighter red accent |
| 🔵 Cerulean | `$cerulean` | `#006699` | Links, primary buttons, active states |
| 🔵 Malibu | `$malibu` | `#66AFE9` | Focus rings, input focus |
| ⬜ Clear Day | `$clear-day` | `#F2F7F9` | Page background |
| 🟨 Mocassin | `$mocassin` | `#FFFAB2` | Highlight/warning backgrounds |
| ⬛ Night Rider | `$night-rider` | `#333333` | Body text, headings |
| ⚫ Empress | `$empress` | `#757575` | Secondary text |
| ⬜ Smoke | `$smoke` | `#F5F5F5` | Background gray |

### Simplified Variables (for plan-check)

```css
:root {
  /* Primary */
  --color-primary: var(--color-cerulean);        /* #006699 */
  --color-primary-hover: #004D73;
  --color-primary-light: var(--color-clear-day); /* #F2F7F9 */
  
  /* Swiss Red (CD mandated) */
  --color-swiss-red: var(--color-venetian-red);  /* #DC0018 */
  
  /* Text */
  --color-text-primary: var(--color-night-rider);  /* #333333 */
  --color-text-secondary: var(--color-empress);    /* #757575 */
  --color-text-muted: var(--color-silver);         /* #CCCCCC */
  --color-text-inverse: var(--color-white);        /* #FFFFFF */
  
  /* Backgrounds */
  --color-bg-primary: var(--color-white);          /* #FFFFFF */
  --color-bg-secondary: var(--color-smoke);        /* #F5F5F5 */
  --color-bg-page: var(--color-clear-day);         /* #F2F7F9 */
  
  /* Borders */
  --color-border: var(--color-silver);             /* #CCCCCC */
  --color-border-light: var(--color-gainsboro);    /* #E5E5E5 */
  
  /* Focus */
  --color-focus: var(--color-malibu);              /* #66AFE9 - Swiss Federal standard */
  --color-focus-ring: var(--color-malibu);         /* Alias for focus ring color */
}
```

### Semantic Colors (Validation Status)

These are **not official CD colors** but are standard for semantic feedback. They should be used sparingly and consistently for validation states.

```css
:root {
  /* Success - High Score (≥90%) */
  --color-success: #3C763D;           /* Green - accessible */
  --color-success-light: #DFF0D8;
  --color-success-border: #D6E9C6;
  
  /* Warning - Medium Score (60-89%) */
  --color-warning: #8A6D3B;           /* Brown/gold - accessible */
  --color-warning-light: #FCF8E3;
  --color-warning-border: #FAEBCC;
  
  /* Error - Low Score (<60%) */
  --color-error: #A94442;             /* Dark red - accessible */
  --color-error-light: #F2DEDE;
  --color-error-border: #EBCCD1;
  
  /* Info */
  --color-info: #31708F;              /* Dark blue - accessible */
  --color-info-light: #D9EDF7;
  --color-info-border: #BCE8F1;

  /* Dark variants for badges and high-contrast text */
  --color-success-dark: #2B5A2C;      /* Darker green for text on light bg */
  --color-warning-dark: #6B5625;      /* Darker gold for text on light bg */
  --color-error-dark: #843534;        /* Darker red for text on light bg */
  --color-info-dark: #245269;         /* Darker blue for text on light bg */
}
```

| Status | Text Color | Background | Border | Usage |
|--------|------------|------------|--------|-------|
| ✅ Success | `#3C763D` | `#DFF0D8` | `#D6E9C6` | 90-100% validation score |
| ⚠️ Warning | `#8A6D3B` | `#FCF8E3` | `#FAEBCC` | 60-89% validation score |
| ❌ Error | `#A94442` | `#F2DEDE` | `#EBCCD1` | <60% validation score |
| ℹ️ Info | `#31708F` | `#D9EDF7` | `#BCE8F1` | Informational messages |

> **Note:** These semantic colors are derived from Bootstrap's accessible alert colors and meet WCAG AA contrast requirements.

### Floor Plan Viewer Colors

```css
:root {
  /* Room polygons */
  --color-room-fill: rgba(144, 238, 144, 0.5);      /* Light green, 50% opacity */
  --color-room-stroke: #228B22;                       /* Forest green */
  --color-room-selected: rgba(0, 191, 255, 0.6);    /* Cyan highlight */
  
  /* Architecture layer */
  --color-architecture: #333333;
  
  /* Error markers */
  --color-error-marker: #DC3545;
  --color-warning-marker: #D4A017;
  
  /* Grid and guides */
  --color-grid: #E0E0E0;
}
```

---

## Typography

### Font Stack (Official Swiss Federal)

The Swiss Federal Corporate Design mandates **Frutiger** as the primary typeface. Due to licensing restrictions, the font files cannot be distributed publicly.

```css
:root {
  /* Official Swiss Federal font stack */
  --font-family-primary: 
    'Frutiger Neue LT W1G',      /* Modern Frutiger */
    'Frutiger LT W01',           /* Legacy Frutiger */
    'Frutiger',
    -apple-system,               /* macOS/iOS fallback */
    BlinkMacSystemFont,          /* Chrome on macOS */
    'Segoe UI',                  /* Windows */
    'Roboto',                    /* Android */
    'Helvetica Neue',            /* Classic Swiss fallback */
    'Arial',
    sans-serif;
  
  /* Monospace (code, technical data) */
  --font-family-mono:
    'SF Mono',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    monospace;
}
```

> **⚠️ Font Licensing:** Frutiger font files must be obtained from the Federal Chancellery intranet or requested via email: **webforum@bk.admin.ch**. Each project must ensure only allowed domains have access to the font files (check REFERER header).

> **Fallback Strategy:** For prototypes and development, the system font stack provides excellent fallbacks. Helvetica Neue and Arial are acceptable Swiss Style alternatives.

### Type Scale

Based on a 1.25 ratio (Major Third):

```css
:root {
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.25rem;    /* 20px */
  --font-size-xl: 1.5rem;     /* 24px */
  --font-size-2xl: 2rem;      /* 32px */
  --font-size-3xl: 2.5rem;    /* 40px */
  --font-size-4xl: 3rem;      /* 48px */
}
```

### Font Weights

```css
:root {
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### Line Heights

```css
:root {
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}
```

### Typography Usage

| Element | Size | Weight | Line Height | Color |
|---------|------|--------|-------------|-------|
| H1 (Page Title) | 2.5rem (40px) | 700 | 1.25 | `--color-text-primary` |
| H2 (Section Title) | 2rem (32px) | 600 | 1.25 | `--color-text-primary` |
| H3 (Subsection) | 1.5rem (24px) | 600 | 1.25 | `--color-text-primary` |
| H4 (Card Title) | 1.25rem (20px) | 600 | 1.25 | `--color-text-primary` |
| Body | 1rem (16px) | 400 | 1.5 | `--color-text-primary` |
| Body Small | 0.875rem (14px) | 400 | 1.5 | `--color-text-secondary` |
| Caption | 0.75rem (12px) | 400 | 1.5 | `--color-text-muted` |
| Label | 0.875rem (14px) | 500 | 1.25 | `--color-text-secondary` |
| Button | 1rem (16px) | 600 | 1.25 | varies |

### Text Styles (CSS Classes)

```css
/* Headings */
.text-h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
  margin-bottom: 1.5rem;
}

.text-h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
  margin-bottom: 1rem;
}

.text-h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
  margin-bottom: 0.75rem;
}

/* Body text */
.text-body {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
}

.text-body-small {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  color: var(--color-text-secondary);
}

/* Captions and labels */
.text-caption {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  color: var(--color-text-muted);
}

.text-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  color: var(--color-text-secondary);
  text-transform: none;
}

/* Statistics / Metrics */
.text-metric {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: 1;
  color: var(--color-text-primary);
}

.text-metric-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
}

/* Validation percentage */
.text-percentage {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.text-percentage--success { color: var(--color-success); }
.text-percentage--warning { color: var(--color-warning); }
.text-percentage--error { color: var(--color-error); }
```

---

## Spacing System

Use an 8px base unit for consistent spacing:

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-7: 2.5rem;    /* 40px */
  --space-8: 3rem;      /* 48px */
  --space-10: 4rem;     /* 64px */
  --space-12: 6rem;     /* 96px */
}
```

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight internal spacing |
| `--space-2` | 8px | Default internal spacing, small gaps |
| `--space-3` | 12px | Form field spacing |
| `--space-4` | 16px | Default padding, between elements |
| `--space-5` | 24px | Card padding, section spacing |
| `--space-6` | 32px | Large section spacing |
| `--space-7` | 40px | Between major elements |
| `--space-8` | 48px | Page section separation |
| `--space-10` | 64px | Major page sections |

---

## Grid System

### Container

```css
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding-left: var(--space-4);
  padding-right: var(--space-4);
}

.container--narrow {
  max-width: 800px;
}

.container--wide {
  max-width: 1400px;
}
```

### Grid Layout

12-column grid with responsive breakpoints:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-5);
}

/* Column spans */
.col-1 { grid-column: span 1; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.col-4 { grid-column: span 4; }
.col-5 { grid-column: span 5; }
.col-6 { grid-column: span 6; }
.col-7 { grid-column: span 7; }
.col-8 { grid-column: span 8; }
.col-9 { grid-column: span 9; }
.col-10 { grid-column: span 10; }
.col-11 { grid-column: span 11; }
.col-12 { grid-column: span 12; }
```

### Breakpoints

```css
:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
  --breakpoint-2xl: 1400px;
}

/* Responsive grid example */
@media (max-width: 768px) {
  .grid { gap: var(--space-4); }
  .col-md-12 { grid-column: span 12; }
}
```

---

## Components

### Header (Swiss Federal)

```html
<header class="header">
  <div class="header__bar"></div>
  <div class="header__content">
    <div class="header__brand">
      <img src="/assets/swiss-coat-of-arms.svg" alt="" class="header__logo">
      <div class="header__titles">
        <span class="header__org">Bundesamt für Bauten und Logistik BBL</span>
        <span class="header__app">Prüfplatform Flächenmanagement</span>
      </div>
    </div>
    <nav class="header__nav">
      <a href="#" class="header__link">BBL CAD Standards</a>
      <button class="header__user" aria-label="User menu">
        <svg><!-- User icon --></svg>
      </button>
    </nav>
  </div>
</header>
```

```css
.header {
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-gray-200);
}

.header__bar {
  height: 6px;
  background: var(--color-swiss-red);
}

.header__content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  max-width: 1400px;
  margin: 0 auto;
}

.header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header__logo {
  height: 40px;
  width: auto;
}

.header__org {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.header__app {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
```

### Buttons

Based on the Swiss Federal styleguide button patterns:

```css
/* Base button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 6px 12px;
  font-family: var(--font-family-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: 0;  /* Swiss Federal: NO border-radius */
  cursor: pointer;
  transition: all 0.15s ease;
  vertical-align: middle;
}

/* Primary button (Default) */
.btn--primary,
.btn--default {
  background: var(--color-night-rider);    /* #333333 */
  color: var(--color-white);
  border-color: var(--color-night-rider);
}

.btn--primary:hover,
.btn--default:hover {
  background: var(--color-black);
  border-color: var(--color-black);
}

.btn--primary:focus,
.btn--default:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-malibu);  /* #66AFE9 */
}

/* Secondary button (Outline) */
.btn--secondary,
.btn--outline {
  background: transparent;
  color: var(--color-night-rider);
  border-color: var(--color-night-rider);
}

.btn--secondary:hover,
.btn--outline:hover {
  background: var(--color-smoke);
  color: var(--color-black);
}

/* Primary action button (Blue) */
.btn--action {
  background: var(--color-cerulean);       /* #006699 */
  color: var(--color-white);
  border-color: var(--color-cerulean);
}

.btn--action:hover {
  background: #004D73;
  border-color: #004D73;
}

/* Button sizes */
.btn--sm {
  padding: 4px 8px;
  font-size: var(--font-size-sm);
}

.btn--lg {
  padding: 10px 16px;
  font-size: var(--font-size-lg);
}

/* Button with icon */
.btn .icon {
  margin-right: 4px;
}

/* Disabled state */
.btn:disabled,
.btn--disabled {
  background: var(--color-gray-200);
  color: var(--color-gray-500);
  border-color: var(--color-gray-200);
  cursor: not-allowed;
  pointer-events: none;
  opacity: 0.7;
}

/* Loading state */
.btn--loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.btn--loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin-left: -8px;
  margin-top: -8px;
  border: 2px solid var(--color-gray-300);
  border-top-color: var(--color-gray-600);
  border-radius: 50%;
  animation: btn-spinner 0.6s linear infinite;
}

@keyframes btn-spinner {
  to { transform: rotate(360deg); }
}
```

> **Note:** Swiss Federal buttons have **no border-radius**. This is a deliberate design choice for a clean, professional appearance.

### Cards (Project Cards)

```html
<article class="card">
  <div class="card__image">
    <img src="/path/to/building.jpg" alt="Project thumbnail">
    <div class="card__overlay" aria-hidden="true">
      Auftrag Abgeschlossen (Wird in 30 Tagen gelöscht)
    </div>
  </div>
  <div class="card__content">
    <h3 class="card__title">Bern, Verwaltungsgebäude Liebefeld</h3>
    <dl class="card__meta">
      <dt class="sr-only">SIA Phase</dt>
      <dd>SIA Phase: 53</dd>
      <dt class="sr-only">Auftrag erstellt</dt>
      <dd>Auftrag erstellt: 14/04/2022</dd>
      <dt class="sr-only">Anzahl Dokumente</dt>
      <dd>Anzahl Dokumente: 14</dd>
    </dl>
  </div>
  <div class="card__score">
    <span class="card__percentage card__percentage--success">95%</span>
  </div>
</article>
```

```css
.card {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-gray-200);
  overflow: hidden;
  transition: box-shadow 0.15s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card__image {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: var(--color-text-inverse);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  text-align: center;
  padding: var(--space-4);
}

.card__content {
  flex: 1;
  padding: var(--space-4);
}

.card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.card__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.card__meta dd {
  margin: 0;
}

.card__score {
  padding: var(--space-4);
  text-align: right;
}

.card__percentage {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.card__percentage--success { color: var(--color-success); }
.card__percentage--warning { color: var(--color-warning); }
.card__percentage--error { color: var(--color-error); }
```

### Form Elements

```css
/* Input field */
.form-field {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-family-primary);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-gray-300);
  border-radius: 0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-input:hover {
  border-color: var(--color-gray-400);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px var(--color-focus);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

/* Input with icon */
.form-input-group {
  position: relative;
}

.form-input-group .form-input {
  padding-left: 2.75rem;
}

.form-input-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

/* File upload */
.file-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  border: 2px dashed var(--color-gray-300);
  background: var(--color-bg-secondary);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.file-upload:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.file-upload__icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.file-upload__text {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  text-align: center;
}

/* Form field states */
.form-input:disabled,
.form-input--disabled {
  background: var(--color-gray-100);
  color: var(--color-gray-500);
  border-color: var(--color-gray-200);
  cursor: not-allowed;
}

.form-input--error {
  border-color: var(--color-error);
}

.form-input--error:focus {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px var(--color-error-light);
}

.form-input--success {
  border-color: var(--color-success);
}

/* Form field loading state */
.form-field--loading {
  position: relative;
}

.form-field--loading::after {
  content: '';
  position: absolute;
  right: var(--space-3);
  top: 50%;
  width: 16px;
  height: 16px;
  margin-top: -8px;
  border: 2px solid var(--color-gray-300);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: field-spinner 0.6s linear infinite;
}

@keyframes field-spinner {
  to { transform: rotate(360deg); }
}

/* Form error/help text */
.form-error {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.form-help {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
```

### Tables

```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-gray-200);
}

.table th {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.table td {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.table tbody tr:hover {
  background: var(--color-gray-50);
}

/* Compact table (for room list) */
.table--compact th,
.table--compact td {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

/* Numeric columns */
.table td.text-right {
  text-align: right;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
}
```

### Progress Stepper (4-Step Wizard)

```html
<nav class="stepper" aria-label="Progress">
  <ol class="stepper__list">
    <li class="stepper__item stepper__item--complete">
      <span class="stepper__indicator">
        <svg><!-- Check icon --></svg>
      </span>
      <span class="stepper__label">1. DWG hochladen</span>
    </li>
    <li class="stepper__item stepper__item--current">
      <span class="stepper__indicator">
        <svg><!-- Upload icon --></svg>
      </span>
      <span class="stepper__label">2. Raumliste hochladen</span>
    </li>
    <li class="stepper__item">
      <span class="stepper__indicator">
        <svg><!-- Eye icon --></svg>
      </span>
      <span class="stepper__label">3. Ergebnisse bestätigen</span>
    </li>
    <li class="stepper__item">
      <span class="stepper__indicator">
        <svg><!-- Check circle icon --></svg>
      </span>
      <span class="stepper__label">4. Auftrag abschliessen</span>
    </li>
  </ol>
</nav>
```

```css
.stepper__list {
  display: flex;
  align-items: center;
  justify-content: center;
  list-style: none;
  padding: 0;
  margin: 0;
}

.stepper__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
}

/* Connector line */
.stepper__item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 20px;
  left: calc(50% + 24px);
  width: calc(100% - 48px);
  height: 4px;
  background: var(--color-gray-300);
}

.stepper__item--complete:not(:last-child)::after {
  background: var(--color-success);
}

.stepper__indicator {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gray-200);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
  position: relative;
  z-index: 1;
}

.stepper__item--complete .stepper__indicator {
  background: var(--color-success);
  color: var(--color-text-inverse);
}

.stepper__item--current .stepper__indicator {
  background: var(--color-success);
  color: var(--color-text-inverse);
  box-shadow: 0 0 0 4px var(--color-success-light);
}

.stepper__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

.stepper__item--current .stepper__label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
```

### Metric Cards

```html
<div class="metrics">
  <div class="metric-card">
    <span class="metric-card__value">22</span>
    <span class="metric-card__label">Räume</span>
  </div>
  <div class="metric-card">
    <span class="metric-card__value">4'500 m²</span>
    <span class="metric-card__label">SIA 416 Geschossfläche GF</span>
  </div>
  <div class="metric-card">
    <span class="metric-card__value">4'000 m²</span>
    <span class="metric-card__label">SIA 416 Nettogeschossfläche NGF</span>
  </div>
  <div class="metric-card metric-card--error">
    <span class="metric-card__value">13</span>
    <span class="metric-card__label">Fehlermeldungen</span>
  </div>
</div>
```

```css
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-4);
}

.metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-gray-200);
  text-align: center;
}

.metric-card__value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1;
  margin-bottom: var(--space-2);
}

.metric-card__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.metric-card--error .metric-card__value {
  color: var(--color-error);
}

.metric-card--success .metric-card__value {
  color: var(--color-success);
}
```

### Tabs

```css
.tabs {
  border-bottom: 1px solid var(--color-gray-200);
}

.tabs__list {
  display: flex;
  gap: var(--space-6);
  list-style: none;
  padding: 0;
  margin: 0;
}

.tabs__tab {
  padding: var(--space-3) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.tabs__tab:hover {
  color: var(--color-text-primary);
}

.tabs__tab--active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-text-primary);
}

.tabs__tab--active:hover {
  border-bottom-color: var(--color-text-primary);
}
```

### Donut Chart (Completion Percentage)

```css
.donut-chart {
  position: relative;
  width: 150px;
  height: 150px;
}

.donut-chart__svg {
  transform: rotate(-90deg);
}

.donut-chart__background {
  fill: none;
  stroke: var(--color-gray-200);
  stroke-width: 12;
}

.donut-chart__progress {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.donut-chart__progress--success { stroke: var(--color-success); }
.donut-chart__progress--warning { stroke: var(--color-warning); }
.donut-chart__progress--error { stroke: var(--color-error); }

.donut-chart__value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.donut-chart__percentage {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.donut-chart__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
```

---

## Icons

Use a consistent icon set. Recommended: **Lucide Icons** (open source, MIT license)

### Icon Sizes

```css
:root {
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --icon-size-xl: 32px;
}
```

### Common Icons

| Icon | Name | Usage |
|------|------|-------|
| 📁 | `folder` | Project/Auftrag |
| 📄 | `file` | Document |
| ⬆️ | `upload` | File upload |
| ⬇️ | `download` | Download |
| ✓ | `check` | Success, complete |
| ✗ | `x` | Error, close |
| ⚠ | `alert-triangle` | Warning |
| ℹ | `info` | Information |
| 🔍 | `search` | Search |
| 👤 | `user` | User account |
| ⚙ | `settings` | Settings |
| 🔒 | `lock` | Locked/completed |
| 📊 | `bar-chart` | Statistics |
| 🗺 | `map` | Floor plan |
| 📐 | `square` | Room/area |

---

## Data Visualization

### Area Distribution Pie Chart

Use muted, professional colors for pie/donut charts:

```css
:root {
  /* SIA 416 Area Categories */
  --color-chart-hnf: #2E7D32;    /* Hauptnutzfläche - Green */
  --color-chart-nnf: #558B2F;    /* Nebennutzfläche - Light Green */
  --color-chart-vf: #7CB342;     /* Verkehrsfläche - Lime */
  --color-chart-ff: #AED581;     /* Funktionsfläche - Light Lime */
  --color-chart-kf: #C5E1A5;     /* Konstruktionsfläche - Pale Green */
}
```

### Progress Bars

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--color-gray-200);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-bar__fill--success { background: var(--color-success); }
.progress-bar__fill--warning { background: var(--color-warning); }
.progress-bar__fill--error { background: var(--color-error); }
```

---

## Floor Plan Viewer

### Styling

```css
.floorplan-viewer {
  position: relative;
  width: 100%;
  height: 500px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-gray-200);
  overflow: hidden;
}

.floorplan-viewer__canvas {
  width: 100%;
  height: 100%;
}

/* Room polygon styling */
.floorplan-room {
  fill: var(--color-room-fill);
  stroke: var(--color-room-stroke);
  stroke-width: 1;
  cursor: pointer;
  transition: fill 0.15s ease;
}

.floorplan-room:hover {
  fill: rgba(144, 238, 144, 0.7);
}

.floorplan-room--selected {
  fill: var(--color-room-selected);
  stroke: #0088CC;
  stroke-width: 2;
}

.floorplan-room--error {
  fill: rgba(220, 53, 69, 0.3);
  stroke: var(--color-error);
  stroke-width: 2;
}

/* Architecture lines */
.floorplan-architecture {
  fill: none;
  stroke: var(--color-architecture);
  stroke-width: 1;
}

/* Error markers */
.floorplan-marker {
  cursor: pointer;
}

.floorplan-marker--error {
  fill: var(--color-error);
}

.floorplan-marker--warning {
  fill: var(--color-warning);
}

/* Viewer controls */
.floorplan-controls {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.floorplan-controls__btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-gray-300);
  cursor: pointer;
  transition: background 0.15s ease;
}

.floorplan-controls__btn:hover {
  background: var(--color-gray-100);
}

/* Layer toggle panel */
.floorplan-layers {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-gray-200);
  padding: var(--space-3);
  max-height: 300px;
  overflow-y: auto;
}

.floorplan-layers__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.floorplan-layers__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--font-size-sm);
}
```

---

## Validation Status Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  border-radius: 2px;
}

.badge--success {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.badge--warning {
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
}

.badge--error {
  background: var(--color-error-light);
  color: var(--color-error-dark);
}

.badge--info {
  background: var(--color-info-light);
  color: var(--color-info-dark);
}

/* Validation result icon */
.validation-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.validation-icon--success {
  background: var(--color-success);
  color: white;
}

.validation-icon--error {
  background: var(--color-error);
  color: white;
}
```

---

## Accessibility

### Color Contrast

All text must meet WCAG 2.1 AA standards:
- Normal text: minimum 4.5:1 contrast ratio
- Large text (18px+ bold, 24px+ regular): minimum 3:1 contrast ratio

| Text Color | Background | Ratio | Status |
|------------|------------|-------|--------|
| `#333333` | `#FFFFFF` | 12.6:1 | ✅ Pass |
| `#666666` | `#FFFFFF` | 5.7:1 | ✅ Pass |
| `#999999` | `#FFFFFF` | 2.8:1 | ⚠️ Large text only |
| `#FFFFFF` | `#DC0018` | 4.5:1 | ✅ Pass |
| `#FFFFFF` | `#28A745` | 4.5:1 | ✅ Pass |

### Focus States

```css
/* Focus indicator for keyboard navigation */
:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

/* Remove default focus outline */
:focus:not(:focus-visible) {
  outline: none;
}

/* High contrast focus for buttons */
.btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(102, 175, 233, 0.3);  /* --color-malibu at 30% */
}
```

### Screen Reader Support

```css
/* Visually hidden but accessible to screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Skip link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: var(--space-2) var(--space-4);
  background: var(--color-gray-900);
  color: var(--color-text-inverse);
  z-index: 1000;
}

.skip-link:focus {
  top: 0;
}
```

### ARIA Guidelines

- Use `aria-label` for icon-only buttons
- Use `aria-current="page"` for active navigation items
- Use `aria-describedby` for form field hints/errors
- Use `role="alert"` for error messages
- Use `aria-live="polite"` for dynamic content updates

---

## Responsive Design

### Breakpoint Behavior

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 576px | Single column, stacked cards |
| Tablet | 576-991px | 2-column grid, compact tables |
| Desktop | 992-1199px | 3-column grid, full layout |
| Large | ≥ 1200px | Full layout with sidebar |

### Mobile Considerations

```css
/* Mobile-first base styles */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 576px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 992px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Responsive table */
@media (max-width: 768px) {
  .table-responsive {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}

/* Responsive stepper */
@media (max-width: 768px) {
  .stepper__list {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .stepper__item:not(:last-child)::after {
    display: none;
  }
}
```

---

## Animation & Transitions

### Duration Tokens

```css
:root {
  --duration-fast: 0.1s;
  --duration-normal: 0.15s;
  --duration-slow: 0.3s;
}
```

### Standard Transitions

```css
/* Hover effects */
.interactive-element {
  transition: 
    background-color var(--duration-normal) ease,
    border-color var(--duration-normal) ease,
    color var(--duration-normal) ease,
    box-shadow var(--duration-normal) ease;
}

/* Progress animations */
.progress-animate {
  transition: width var(--duration-slow) ease-out;
}

/* Page transitions */
.page-enter {
  opacity: 0;
  transform: translateY(10px);
}

.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: 
    opacity var(--duration-slow) ease,
    transform var(--duration-slow) ease;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## File Structure

```
/styles
├── /tokens
│   ├── _colors.css
│   ├── _typography.css
│   ├── _spacing.css
│   └── _breakpoints.css
├── /base
│   ├── _reset.css
│   ├── _typography.css
│   └── _utilities.css
├── /components
│   ├── _button.css
│   ├── _card.css
│   ├── _form.css
│   ├── _table.css
│   ├── _tabs.css
│   ├── _stepper.css
│   ├── _badge.css
│   ├── _donut-chart.css
│   └── _floorplan-viewer.css
├── /layout
│   ├── _header.css
│   ├── _footer.css
│   ├── _grid.css
│   └── _container.css
└── main.css
```

---

## References

### Swiss Federal Design System (Official)

| Resource | URL | Notes |
|----------|-----|-------|
| **Modern Design System** | https://github.com/swiss/designsystem | ✅ Use for new projects |
| Modern Storybook | https://swiss.github.io/designsystem/ | Component documentation |
| Figma Library | https://www.figma.com/design/3UYgqxmcJbG0hpWuti3y8U/ | Design assets |
| Legacy Styleguide | https://github.com/swiss/styleguide | Reference only |
| Legacy Documentation | https://swiss.github.io/styleguide/en/ | Color/component specs |

### Additional Resources

- [Swiss Confederation CD Manual (PDF)](https://www.eda.admin.ch/dam/eda/en/documents/das-eda/landeskommunikation/cd-manual-chap2-corporate-design-elements_EN.pdf)
- [International Typographic Style (Wikipedia)](https://en.wikipedia.org/wiki/International_Typographic_Style)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [Lucide Icons](https://lucide.dev/)

### Font Request

To obtain Frutiger font files for federal projects:
- **Email:** webforum@bk.admin.ch
- **Intranet:** Federal Chancellery intranet (requires access)
