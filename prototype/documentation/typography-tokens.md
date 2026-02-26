# Typography Tokens

Complete reference for the typography token system in plan-check.

## Font Size Scale

### Base Scale (T-shirt Sizing)

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--font-size-xs` | 0.75rem | 12px | Captions, footnotes, hints |
| `--font-size-sm` | 0.875rem | 14px | Small text, labels, metadata |
| `--font-size-base` | 1rem | 16px | Body text (default) |
| `--font-size-lg` | 1.25rem | 20px | Large body text, H4 |
| `--font-size-xl` | 1.5rem | 24px | H3 headings |
| `--font-size-2xl` | 2rem | 32px | H2 headings |
| `--font-size-3xl` | 2.5rem | 40px | H1 headings |
| `--font-size-4xl` | 3rem | 48px | Display text |

### Semantic Tokens (Component-Specific)

These tokens map to the base scale but provide semantic meaning:

| Token | Maps to | Value | Usage |
|-------|---------|-------|-------|
| `--font-size-caption` | `--font-size-xs` | 12px | Captions, hints, help text |
| `--font-size-label` | `--font-size-sm` | 14px | Form labels, metadata |
| `--font-size-body` | `--font-size-base` | 16px | Primary body text |
| `--font-size-body-large` | `--font-size-lg` | 20px | Large body text |
| `--font-size-button` | `--font-size-base` | 16px | Button text |
| `--font-size-button-small` | `--font-size-sm` | 14px | Small button text |
| `--font-size-heading-4` | `--font-size-lg` | 20px | Card titles (H4) |
| `--font-size-heading-3` | `--font-size-xl` | 24px | Section headings (H3) |
| `--font-size-heading-2` | `--font-size-2xl` | 32px | Page sections (H2) |
| `--font-size-heading-1` | `--font-size-3xl` | 40px | Page titles (H1) |
| `--font-size-display` | `--font-size-4xl` | 48px | Hero text |

## Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-weight-light` | 300 | Light emphasis |
| `--font-weight-regular` | 400 | Body text (default) |
| `--font-weight-medium` | 500 | Labels, emphasis |
| `--font-weight-semibold` | 600 | Headings, strong emphasis |
| `--font-weight-bold` | 700 | Heavy emphasis, titles |

## Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--line-height-tight` | 1.25 | Headings, compact UI |
| `--line-height-normal` | 1.5 | Body text (default) |
| `--line-height-relaxed` | 1.75 | Long-form content |

## CSS Utility Classes

### Heading Classes

```css
.text-h1  /* 40px, bold, tight */
.text-h2  /* 32px, semibold, tight */
.text-h3  /* 24px, semibold, tight */
.text-h4  /* 20px, semibold, tight */
```

### Body Text Classes

```css
.text-body        /* 16px, normal line-height */
.text-body-large  /* 20px, normal line-height */
.text-label       /* 14px, medium weight, tight */
.text-caption     /* 12px, normal line-height, secondary color */
```

### Font Size Utilities

```css
.text-xs    /* 12px */
.text-sm    /* 14px */
.text-base  /* 16px */
.text-lg    /* 20px */
.text-xl    /* 24px */
.text-2xl   /* 32px */
.text-3xl   /* 40px */
.text-4xl   /* 48px */
```

### Font Weight Utilities

```css
.font-light      /* 300 */
.font-regular    /* 400 */
.font-medium     /* 500 */
.font-semibold   /* 600 */
.font-bold       /* 700 */
```

### Line Height Utilities

```css
.leading-tight    /* 1.25 */
.leading-normal   /* 1.5 */
.leading-relaxed  /* 1.75 */
```

### Text Alignment

```css
.text-left
.text-center
.text-right
```

### Text Color Utilities

```css
.text-primary    /* Night Rider #333333 */
.text-secondary  /* Empress #757575 */
.text-muted      /* Silver #CCCCCC */
.text-inverse    /* White #FFFFFF */
```

## Usage Examples

### In CSS

```css
/* Using base tokens */
.my-component {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-normal);
}

/* Using semantic tokens */
.card-title {
    font-size: var(--font-size-heading-4);
    font-weight: var(--font-weight-semibold);
}

.form-label {
    font-size: var(--font-size-label);
    font-weight: var(--font-weight-medium);
}
```

### In HTML

```html
<!-- Using utility classes -->
<h1 class="text-h1">Page Title</h1>
<h2 class="text-h2">Section Heading</h2>
<p class="text-body">Body text content</p>
<span class="text-caption">Caption text</span>

<!-- Combining utilities -->
<div class="text-lg font-semibold text-primary">
    Large, bold, primary text
</div>
```

## Best Practices

### ✅ DO

- **Use semantic tokens** when the component has a clear semantic meaning (e.g., `--font-size-button` for buttons)
- **Use base tokens** when you need flexibility or are creating custom components
- **Use utility classes** in HTML for quick prototyping and one-off styling
- **Stay consistent** with the scale - avoid hardcoded pixel values

### ❌ DON'T

- **Don't hardcode font sizes** in px or rem - always use tokens
- **Don't create new font sizes** outside the scale without updating the token system
- **Don't use semantic tokens incorrectly** (e.g., `--font-size-button` for headings)
- **Don't override tokens** locally - extend the system instead

## Component Font Size Reference

| Component | Token | Size |
|-----------|-------|------|
| Page Title (H1) | `--font-size-heading-1` | 40px |
| Section Heading (H2) | `--font-size-heading-2` | 32px |
| Subsection (H3) | `--font-size-heading-3` | 24px |
| Card Title (H4) | `--font-size-heading-4` | 20px |
| Body Text | `--font-size-body` | 16px |
| Button | `--font-size-button` | 16px |
| Small Button | `--font-size-button-small` | 14px |
| Form Label | `--font-size-label` | 14px |
| Table Header | `--font-size-label` | 14px |
| Table Cell | `--font-size-body` | 16px |
| Caption | `--font-size-caption` | 12px |
| Breadcrumb | `--font-size-label` | 14px |
| Badge | `--font-size-caption` | 12px |
| Toast | `--font-size-body` | 16px |

## Accessibility Notes

- **Minimum size**: Never use font sizes smaller than `--font-size-xs` (12px) for body text
- **Contrast**: Ensure text color tokens meet WCAG 2.1 AA contrast requirements
- **Scalability**: All sizes use `rem` units, allowing users to scale text via browser settings
- **Line height**: Body text uses `--line-height-normal` (1.5) for readability

## Migration Guide

If you have hardcoded font sizes, replace them:

```css
/* Before */
.my-class {
    font-size: 16px;
}

/* After - using base token */
.my-class {
    font-size: var(--font-size-base);
}

/* After - using semantic token (better) */
.my-class {
    font-size: var(--font-size-body);
}
```

## References

- [Swiss Federal Design System](https://github.com/swiss/designsystem)
- [documentation/styleguide.md](styleguide.md)
- [Type Scale Calculator](https://typescale.com/) - 1.25 ratio (Major Third)
