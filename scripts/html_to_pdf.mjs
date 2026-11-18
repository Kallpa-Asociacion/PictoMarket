// Usage: node scripts/html_to_pdf.mjs <input.html> <output.pdf>
// Renders a local HTML file to an A4 PDF using the system Chrome through Playwright.
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolve(here, '../codigo/frontend/package.json'))
const { chromium } = require('@playwright/test')

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: node html_to_pdf.mjs <input.html> <output.pdf>')
  process.exit(2)
}

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(resolve(input)).href, { waitUntil: 'networkidle' })
  await page.pdf({
    path: resolve(output),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="font-size:9px;width:100%;text-align:center;color:#666;font-family:sans-serif">' +
      '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '20mm', bottom: '22mm', left: '18mm', right: '18mm' },
  })
} finally {
  await browser.close()
}
