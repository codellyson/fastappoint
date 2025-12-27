#!/usr/bin/env node

/**
 * Script to generate PNG versions of SVG logos
 *
 * Usage:
 *   npm install sharp --save-dev
 *   node scripts/generate-png-logos.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const logoDir = join(projectRoot, 'public', 'logo')
const svgDir = join(logoDir, 'svg')
const pngDir = join(logoDir, 'png')

// Check if sharp is available
let sharp
try {
  sharp = (await import('sharp')).default
} catch (error) {
  console.error('❌ Error: sharp is not installed.')
  console.log('\n📦 Please install sharp first:')
  console.log('   npm install sharp --save-dev\n')
  process.exit(1)
}

// Ensure PNG directories exist
const pngDirs = {
  favicon: join(pngDir, 'favicon'),
  header: join(pngDir, 'header'),
  marketing: join(pngDir, 'marketing'),
}

Object.values(pngDirs).forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
})

// Size configurations
const sizes = {
  favicon: [16, 32, 48, 64],
  header: [40, 60, 80],
  marketing: [200, 400, 800],
}

// SVG files to convert
const svgFiles = [
  { name: 'logo', sizes: ['marketing'] },
  { name: 'logo-icon', sizes: ['favicon', 'header'] },
  { name: 'logo-light', sizes: ['marketing'] },
  { name: 'logo-dark', sizes: ['marketing'] },
  { name: 'favicon', sizes: ['favicon'] },
]

async function convertSvgToPng(svgPath, outputPath, width, height) {
  try {
    const svgBuffer = readFileSync(svgPath)

    await sharp(svgBuffer)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath)

    console.log(`✅ Generated: ${outputPath} (${width}x${height})`)
  } catch (error) {
    console.error(`❌ Error converting ${svgPath}:`, error.message)
  }
}

async function generateAllPngs() {
  console.log('🎨 Generating PNG logos from SVG files...\n')

  for (const file of svgFiles) {
    const svgPath = join(svgDir, `${file.name}.svg`)

    if (!existsSync(svgPath)) {
      console.warn(`⚠️  SVG file not found: ${svgPath}`)
      continue
    }

    for (const sizeCategory of file.sizes) {
      const sizesToGenerate = sizes[sizeCategory]

      for (const size of sizesToGenerate) {
        const outputDir = pngDirs[sizeCategory]
        const outputPath = join(outputDir, `${file.name}-${size}x${size}.png`)

        await convertSvgToPng(svgPath, outputPath, size, size)
      }
    }
  }

  console.log('\n✨ PNG generation complete!')
  console.log(`📁 Files saved to: ${pngDir}`)
}

// Run the conversion
generateAllPngs().catch(console.error)

