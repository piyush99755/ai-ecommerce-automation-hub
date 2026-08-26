import { db } from './db';

const products = [
  {
    name: 'Wireless Mechanical Keyboard',
    slug: 'wireless-mechanical-keyboard',
    description: 'Tactile wireless mechanical keyboard with customizable RGB backlighting and hot-swappable switches.',
    priceCents: 12999,
    stock: 15,
    category: 'Workspace',
    imageUrl: '/images/products/keyboard.jpg',
  },
  {
    name: 'Ergonomic Wireless Mouse',
    slug: 'ergonomic-wireless-mouse',
    description: 'Precision ergonomic mouse designed for all-day comfort and multi-device connectivity.',
    priceCents: 5999,
    stock: 2,
    category: 'Workspace',
    imageUrl: '/images/products/mouse.jpg',
  },
  {
    name: 'USB-C Charging Hub',
    slug: 'usbc-charging-hub',
    description: '7-in-1 multi-port USB-C hub with 4K HDMI, 100W Power Delivery, and high-speed SD card reader.',
    priceCents: 4999,
    stock: 25,
    category: 'Accessories',
    imageUrl: '/images/products/hub.jpg',
  },
  {
    name: 'Noise-Cancelling Headphones',
    slug: 'noise-cancelling-headphones',
    description: 'Premium over-ear wireless headphones with active noise cancellation and 30-hour battery life.',
    priceCents: 24999,
    stock: 8,
    category: 'Audio',
    imageUrl: '/images/products/headphones.jpg',
  },
  {
    name: 'Smart Desk Lamp',
    slug: 'smart-desk-lamp',
    description: 'LED desk lamp with adjustable color temperature, auto-dimming sensor, and wireless phone charger.',
    priceCents: 3999,
    stock: 1,
    category: 'Workspace',
    imageUrl: '/images/products/lamp.jpg',
  },
  {
    name: 'Aluminum Laptop Stand',
    slug: 'aluminum-laptop-stand',
    description: 'Ergonomic foldable aluminum stand suitable for laptops and tablets up to 17 inches.',
    priceCents: 3499,
    stock: 12,
    category: 'Accessories',
    imageUrl: '/images/products/stand.jpg',
  },
  {
    name: 'Portable SSD 1TB',
    slug: 'portable-ssd-1tb',
    description: 'Ultra-fast 1TB NVMe portable solid state drive with rugged shock-resistant aluminum casing.',
    priceCents: 8999,
    stock: 30,
    category: 'Storage',
    imageUrl: '/images/products/ssd.jpg',
  },
  {
    name: 'Minimalist Tech Backpack',
    slug: 'minimalist-tech-backpack',
    description: 'Water-resistant daily commuter backpack with dedicated padded 16-inch laptop compartment.',
    priceCents: 7999,
    stock: 6,
    category: 'Lifestyle',
    imageUrl: '/images/products/backpack.jpg',
  },
  {
    name: 'Wireless Charging Pad',
    slug: 'wireless-charging-pad',
    description: 'Fast 15W Qi-certified wireless charging pad with non-slip fabric surface and LED indicator.',
    priceCents: 2999,
    stock: 20,
    category: 'Accessories',
    imageUrl: '/images/products/charger.jpg',
  },
  {
    name: 'Smart Water Bottle',
    slug: 'smart-water-bottle',
    description: 'Insulated stainless steel water bottle with UV sterilization and hydration reminder display.',
    priceCents: 4499,
    stock: 10,
    category: 'Lifestyle',
    imageUrl: '/images/products/bottle.jpg',
  },
];

async function seed() {
  console.log('Seeding 10 demo products into Neon PostgreSQL database...');

  for (const product of products) {
    const existing = await db.orm.public.Product.where({ slug: product.slug }).first();
    if (existing) {
      await db.orm.public.Product.where({ slug: product.slug }).update({
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        stock: product.stock,
        category: product.category,
        imageUrl: product.imageUrl,
      });
      console.log(`Updated existing product: ${product.name}`);
    } else {
      await db.orm.public.Product.create(product);
      console.log(`Created new product: ${product.name}`);
    }
  }

  const allProducts = await db.orm.public.Product.all();
  console.log(`Seed complete! Total products in database: ${allProducts.length}`);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
