import { db } from '@/prisma/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PayOrderButton } from '@/components/orders/PayOrderButton';

export const revalidate = 0;

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}

interface OrderConfirmationPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { id } = await params;

  const order = await db.orm.public.Order.where({ id }).first();

  if (!order) {
    notFound();
  }

  const customer = await db.orm.public.Customer.where({ id: order.customerId }).first();
  const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();

  const allProducts = await db.orm.public.Product.all();
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  const isPaymentPending = order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold ${
              order.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {order.paymentStatus === 'PAID' ? '✓' : '!'}
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {order.paymentStatus === 'PAID' ? 'Order Confirmed' : 'Order Placed (Payment Pending)'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {order.paymentStatus === 'PAID'
                ? 'Thank you! Your payment has been verified by Stripe.'
                : 'Your order is recorded in PostgreSQL. Complete payment below to begin fulfillment.'}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-mono text-gray-700">
              <span>Order ID:</span>
              <span className="font-bold text-gray-900">{order.id}</span>
            </div>
          </div>

          {/* Payment Action Banner for Pending Orders */}
          {isPaymentPending && (
            <div className="my-6 p-6 bg-amber-50 border border-amber-200 rx-12 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-amber-900">Payment Required for Fulfillment</h3>
                  <p className="text-xs text-amber-700 mt-1">
                    Fulfillment and inventory allocation start after Stripe confirms payment.
                  </p>
                </div>
                <div className="w-full sm:w-auto min-w-[220px]">
                  <PayOrderButton orderId={order.id} />
                </div>
              </div>
            </div>
          )}

          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-4 py-6 border-b border-gray-100 text-center">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1">
                Order Status
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {order.status}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1">
                Payment Status
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                order.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {order.paymentStatus}
              </span>
            </div>
          </div>

          {/* Customer Details */}
          {customer && (
            <div className="py-6 border-b border-gray-100">
              <h2 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-3">
                Customer Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-800">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">Name</span>
                  <span className="font-medium">{customer.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">Email</span>
                  <span className="font-medium">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">Phone</span>
                    <span className="font-medium">{customer.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="py-6 border-b border-gray-100">
            <h2 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-4">
              Ordered Items
            </h2>
            <div className="space-y-3">
              {orderItems.map((item) => {
                const product = productMap.get(item.productId);
                return (
                  <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50">
                    <div>
                      <span className="font-bold text-gray-900 block">
                        {product ? product.name : `Product (${item.productId})`}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        Qty: {item.quantity} × {formatPrice(item.unitPriceCents)}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatPrice(item.unitPriceCents * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Summary */}
          <div className="pt-6 flex justify-between items-baseline">
            <span className="text-base font-bold text-gray-900">Total Order Amount</span>
            <span className="text-2xl font-extrabold text-indigo-600">
              {formatPrice(order.totalCents)}
            </span>
          </div>

          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <Link
              href="/products"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Continue Shopping →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
