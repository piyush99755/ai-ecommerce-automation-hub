import { db } from '@/prisma/db';
import { formatCurrencyCents } from './admin-dashboard';

export { formatCurrencyCents };

export interface OrderFilterParams {
  q?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOrderListItem {
  id: string;
  shortId: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

export interface PaginatedOrdersResult {
  items: AdminOrderListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchAdminOrders(params: OrderFilterParams): Promise<PaginatedOrdersResult> {
  const q = (params.q || '').trim().toLowerCase();
  const statusFilter = (params.status || 'ALL').toUpperCase();
  const paymentFilter = (params.paymentStatus || 'ALL').toUpperCase();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(params.pageSize) || 10));

  // Query database in parallel
  const [orders, customers] = await Promise.all([
    db.orm.public.Order.all(),
    db.orm.public.Customer.all(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Sort orders newest first
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Apply filters
  const filtered = sorted.filter((o) => {
    // Status Filter
    if (statusFilter !== 'ALL' && o.status !== statusFilter) {
      return false;
    }

    // Payment Status Filter
    if (paymentFilter !== 'ALL' && o.paymentStatus !== paymentFilter) {
      return false;
    }

    // Search Query Filter (Order ID, Customer Name, or Customer Email)
    if (q.length > 0) {
      const cust = customerMap.get(o.customerId);
      const matchId = o.id.toLowerCase().includes(q);
      const matchName = cust?.name ? cust.name.toLowerCase().includes(q) : false;
      const matchEmail = cust?.email ? cust.email.toLowerCase().includes(q) : false;

      if (!matchId && !matchName && !matchEmail) {
        return false;
      }
    }

    return true;
  });

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSlice = filtered.slice(startIndex, startIndex + pageSize);

  const items: AdminOrderListItem[] = paginatedSlice.map((o) => {
    const cust = customerMap.get(o.customerId);
    return {
      id: o.id,
      shortId: o.id.length > 12 ? `${o.id.substring(0, 8)}...` : o.id,
      customerName: cust?.name || 'Unknown Customer',
      customerEmail: cust?.email || 'N/A',
      totalCents: o.totalCents,
      paymentStatus: o.paymentStatus,
      status: o.status,
      createdAt: o.createdAt,
    };
  });

  return {
    items,
    totalCount,
    page: currentPage,
    pageSize,
    totalPages,
  };
}
