import { db } from '@/prisma/db';
import { formatCurrencyCents } from './admin-dashboard';

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  totalOrders: number;
  paidOrders: number;
  lifetimeValueCents: number;
  activeOrders: number;
  lastOrderDate?: string | null;
  createdAt: string;
}

export interface PaginatedCustomersResult {
  items: CustomerListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetches paginated customer records and computes operational metrics (LTV, active orders, last order date).
 *
 * SCALE NOTE:
 * Current in-memory aggregation is appropriate for the present demo dataset; larger deployments should use database-side aggregation and pagination.
 */
export async function fetchAdminCustomers(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedCustomersResult> {
  const q = (params.q || '').trim().toLowerCase();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(params.pageSize) || 10));

  // Query customers and orders concurrently
  const [customers, orders] = await Promise.all([
    db.orm.public.Customer.all(),
    db.orm.public.Order.all(),
  ]);

  // Group orders by customerId
  const ordersByCustomer = new Map<string, typeof orders>();
  for (const o of orders) {
    const list = ordersByCustomer.get(o.customerId) || [];
    list.push(o);
    ordersByCustomer.set(o.customerId, list);
  }

  // Calculate customer metrics
  const customerItems: CustomerListItem[] = customers.map((c) => {
    const custOrders = ordersByCustomer.get(c.id) || [];

    const totalOrders = custOrders.length;
    const paidOrdersList = custOrders.filter((o) => o.paymentStatus === 'PAID');
    const paidOrders = paidOrdersList.length;

    // Lifetime Value: sum totalCents for legitimately PAID orders only
    const lifetimeValueCents = paidOrdersList.reduce((sum, o) => sum + o.totalCents, 0);

    // Active Orders: non-terminal statuses (PENDING, PROCESSING, ON_HOLD, SHIPPED)
    const activeOrders = custOrders.filter((o) =>
      ['PENDING', 'PROCESSING', 'ON_HOLD', 'SHIPPED'].includes(o.status)
    ).length;

    // Sort customer orders newest first to find last order date
    const sortedCustOrders = [...custOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastOrderDate = sortedCustOrders[0]?.createdAt || null;

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      totalOrders,
      paidOrders,
      lifetimeValueCents,
      activeOrders,
      lastOrderDate,
      createdAt: c.createdAt,
    };
  });

  // Apply search query filter
  const filtered = customerItems.filter((c) => {
    if (q.length > 0) {
      const matchName = c.name.toLowerCase().includes(q);
      const matchEmail = c.email.toLowerCase().includes(q);
      return matchName || matchEmail;
    }
    return true;
  });

  // Deterministic sorting: Highest LTV first, then newest customer
  filtered.sort((a, b) => {
    if (b.lifetimeValueCents !== a.lifetimeValueCents) {
      return b.lifetimeValueCents - a.lifetimeValueCents;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    totalCount,
    page: currentPage,
    pageSize,
    totalPages,
  };
}

export { formatCurrencyCents };
