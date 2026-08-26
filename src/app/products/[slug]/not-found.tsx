import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Sorry, we couldn&apos;t find the product you were looking for. It may have been removed or the URL is incorrect.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Return to Product Catalog
        </Link>
      </div>
    </div>
  );
}
