import playwright from 'file:///C:/Users/piyus/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.js';
import path from 'path';
import fs from 'fs';

const { chromium } = playwright;

const DIAGRAMS = [
  {
    svgPath: path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', '00-upwork-cover.svg'),
    pngPath: path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', '00-upwork-cover.png'),
    name: '00-upwork-cover',
  },
  {
    svgPath: path.join(process.cwd(), 'docs', 'portfolio', 'ecommerce-automation', 'visuals', '00-portfolio-overview.svg'),
    pngPath: path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', 'architecture', '00-portfolio-overview.png'),
    name: '00-portfolio-overview',
  },
  {
    svgPath: path.join(process.cwd(), 'docs', 'portfolio', 'ecommerce-automation', 'visuals', '01-system-architecture.svg'),
    pngPath: path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', 'architecture', '01-system-architecture.png'),
    name: '01-system-architecture',
  },
  {
    svgPath: path.join(process.cwd(), 'docs', 'portfolio', 'ecommerce-automation', 'visuals', '02-order-inventory-automation.svg'),
    pngPath: path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', 'architecture', '02-order-inventory-automation.png'),
    name: '02-order-inventory-automation',
  },
  {
    svgPath: path.join(process.cwd(), 'docs', 'portfolio', 'ecommerce-automation', 'visuals', '03-hubspot-crm-automation.svg'),
    pngPath: path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', 'architecture', '03-hubspot-crm-automation.png'),
    name: '03-hubspot-crm-automation',
  },
];

async function main() {
  console.log('Launching Playwright Chromium for SVG conversion...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  for (const item of DIAGRAMS) {
    if (!fs.existsSync(item.svgPath)) {
      console.error(`SVG source not found: ${item.svgPath}`);
      continue;
    }

    const svgContent = fs.readFileSync(item.svgPath, 'utf8');
    const tempDir = path.dirname(item.pngPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempHtmlPath = path.join(tempDir, `temp_${item.name}.html`);
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0F172A; overflow: hidden; width: 1600px; height: 900px; }
    svg { display: block; width: 1600px; height: 900px; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
    console.log(`Rendering ${item.name}...`);

    await page.goto(fileUrl);
    await page.waitForTimeout(500);
    await page.screenshot({ path: item.pngPath });

    fs.unlinkSync(tempHtmlPath);
    console.log(`✓ Saved high-resolution PNG: ${item.pngPath}`);
  }

  await browser.close();
  console.log('=== All Portfolio Graphics Exported Successfully ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
