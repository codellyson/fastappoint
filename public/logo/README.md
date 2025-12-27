# FastAppoint Logo Assets

This directory contains all logo assets for FastAppoint in various formats, sizes, and color variations.

## Logo Design

The FastAppoint logo features a **calendar icon with a lightning bolt accent**, emphasizing speed and efficiency in appointment booking.

### Brand Colors
- **Primary Blue**: `#2563eb`
- **Accent Orange**: `#f59e0b`

## File Structure

```
logo/
├── svg/              # Scalable vector graphics (editable)
│   ├── logo.svg              # Main logo (200x200)
│   ├── logo-icon.svg         # Icon only (120x120)
│   ├── logo-light.svg        # Light version (for dark backgrounds)
│   ├── logo-dark.svg         # Dark version (for light backgrounds)
│   ├── logo-full.svg         # Full logo with text (400x120)
│   ├── logo-full-light.svg   # Full logo light version
│   ├── logo-full-dark.svg    # Full logo dark version
│   └── favicon.svg           # Favicon version (32x32)
└── png/              # Raster images (generated from SVG)
    ├── favicon/              # Favicon sizes
    ├── header/               # Header/navigation sizes
    └── marketing/            # Marketing/hero sizes
```

## Usage Guidelines

### SVG Files (Recommended)
- Use SVG files for web applications - they scale perfectly at any size
- Best for: Headers, navigation bars, icons, favicons
- Example: `<img src="/logo/svg/logo.svg" alt="FastAppoint" />`

### PNG Files
- Use PNG files when SVG is not supported
- Available in multiple sizes for different use cases
- Best for: Email signatures, social media, print materials

### Color Variations

1. **Default** (`logo.svg`) - Use on light backgrounds
2. **Light** (`logo-light.svg`) - Use on dark backgrounds
3. **Dark** (`logo-dark.svg`) - Use on very light/white backgrounds

### Sizes

- **Favicon**: 16x16, 32x32, 48x48, 64x64
- **Header**: 40x40, 60x60, 80x80
- **Marketing**: 200x200, 400x400, 800x800

## Generating PNG Files

To generate PNG files from SVG, you can:

1. **Use the provided script** (requires sharp):
   ```bash
   npm install sharp --save-dev
   node scripts/generate-png-logos.js
   ```

2. **Use online converters**:
   - Upload SVG files to https://cloudconvert.com/svg-to-png
   - Or use https://convertio.co/svg-png/

3. **Use command-line tools** (if installed):
   ```bash
   # Using Inkscape
   inkscape logo.svg --export-filename=logo.png --export-width=200

   # Using ImageMagick
   convert -background none logo.svg logo.png
   ```

## Integration Examples

### HTML
```html
<!-- Header Logo -->
<img src="/logo/svg/logo-icon.svg" alt="FastAppoint" class="h-10 w-10" />

<!-- Full Logo -->
<img src="/logo/svg/logo-full.svg" alt="FastAppoint" class="h-12" />
```

### CSS Background
```css
.logo {
  background-image: url('/logo/svg/logo.svg');
  background-size: contain;
  background-repeat: no-repeat;
}
```

### Favicon
```html
<link rel="icon" type="image/svg+xml" href="/logo/svg/favicon.svg" />
```

## License

These logo assets are proprietary to FastAppoint and should not be used without permission.

