import playwright from 'file:///C:/Users/piyus/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.js';
import path from 'path';
import fs from 'fs';

const { chromium } = playwright;

const DIAGRAMS = [
  {
    svgName: '00-portfolio-overview.svg',
    pngName: '00-portfolio-overview.png',
  },
  {
    svgName: '01-system-architecture.svg',
    pngName: '01-system-architecture.png',
  },
  {
    svgName: '02-order-inventory-automation.svg',
    pngName: '02-order-inventory-automation.png',
  },
  {
    svgName: '03-hubspot-crm-automation.svg',
    pngName: '03-hubspot-crm-automation.png',
  },
];

async function main() {
  const sourceDir = path.join(process.cwd(), 'docs', 'portfolio', 'ecommerce-automation', 'visuals');
  const targetDir = path.join(process.cwd(), 'docs', 'portfolio', 'screenshots', 'architecture');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('Launching Playwright Chromium for SVG conversion...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  for (const item of DIAGRAMS) {
    const svgPath = path.join(sourceDir, item.svgName);
    const pngPath = path.join(targetDir, item.pngName);

    if (!fs.existsSync(svgPath)) {
      console.error(`SVG source not found: ${svgPath}`);
      continue;
    }

    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const tempHtmlPath = path.join(targetDir, `temp_${item.pngName.replace('.png', '.html')}`);

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
    console.log(`Rendering ${item.svgName} -> ${item.pngName}...`);

    await page.goto(fileUrl);
    await page.waitForTimeout(500);
    await page.screenshot({ path: pngPath });

    fs.unlinkSync(tempHtmlPath);
    console.log(`✓ Saved high-resolution PNG: ${pngPath}`);
  }

  await browser.close();
  console.log('=== SVG to PNG Conversion Complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
