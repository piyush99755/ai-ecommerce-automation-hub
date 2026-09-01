'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

interface AddToCartButtonProps {
  product: {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    stock: number;
  };
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceCents: product.priceCents,
    });

    setAdded(true);
    router.push('/cart');
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={isOutOfStock}
      className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-sm transition-all duration-200 ${
        isOutOfStock
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : added
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
      }`}
    >
      {isOutOfStock ? 'Out of Stock' : added ? 'Added to Cart ✓' : 'Add to Cart'}
    </button>
  );
}
