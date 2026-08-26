import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-gray-50 font-sans">
      <main className="flex flex-col items-center justify-center p-8 max-w-2xl text-center bg-white rounded-2xl shadow-sm border border-gray-100 my-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
          AI E-commerce Automation Hub
        </h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          Welcome to the e-commerce foundation powered by Next.js App Router, PostgreSQL on Neon, and Prisma 8.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
        >
          View Product Catalog →
        </Link>
      </main>
    </div>
  );
}
