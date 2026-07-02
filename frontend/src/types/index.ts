export type Role = "SUPER_ADMIN" | "PROPRIETAIRE" | "GERANT" | "CAISSIER" | "MAGASINIER" | "COMPTABLE" | "LIVREUR";

export interface Company {
  id: string;
  name: string;
  logo?: string | null;
  currency: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  company: Company | null;
}

export interface Store {
  id: string;
  name: string;
  type: "MAGASIN_PRINCIPAL" | "DEPOT_PRINCIPAL" | "DEPOT_SECONDAIRE";
  address?: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  subCategories?: SubCategory[];
}

export interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
  category?: Category;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  discount: number;
  balance: number;
}

export interface Product {
  id: string;
  name: string;
  reference?: string | null;
  sku: string;
  barcode?: string | null;
  qrCode?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  subCategoryId?: string | null;
  subCategory?: SubCategory | null;
  brandId?: string | null;
  brand?: Brand | null;
  supplierId?: string | null;
  supplier?: Supplier | null;
  description?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number | null;
  resellerPrice?: number | null;
  promoPrice?: number | null;
  vatRate: number;
  minStock: number;
  maxStock?: number | null;
  hasSerial: boolean;
  isActive: boolean;
  photoUrl?: string | null;
  totalStock?: number;
  stocks?: { id: string; storeId: string; quantity: number; reserved: number; damaged: number; store?: Store }[];
  images?: { id: string; url: string; isPrimary: boolean }[];
}

export interface SaleItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  number: string;
  type: "VENTE" | "DEVIS" | "BON_LIVRAISON";
  status: "VALIDEE" | "ANNULEE" | "RETOURNEE";
  storeId: string;
  store?: Store;
  customerId?: string | null;
  customer?: Customer | null;
  user?: { name: string };
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  items: SaleItem[];
  createdAt: string;
}

export interface Purchase {
  id: string;
  number: string;
  supplierId: string;
  supplier?: Supplier;
  store?: Store;
  totalAmount: number;
  paidAmount: number;
  items: { id: string; productId: string; product?: Product; quantity: number; unitPrice: number; total: number }[];
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  label: string;
  amount: number;
  note?: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  phone?: string | null;
  position?: string | null;
  role: Role;
  status: "ACTIF" | "SUSPENDU" | "PARTI";
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface StockRow {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  reserved: number;
  damaged: number;
  product: { id: string; name: string; sku: string; minStock: number; unit: string; photoUrl?: string | null };
  store: Store;
}

export interface DashboardData {
  revenueMonth: number;
  salesCountMonth: number;
  revenueToday: number;
  salesCountToday: number;
  purchasesMonth: number;
  expensesMonth: number;
  profitMonth: number;
  customersDebt: number;
  suppliersDebt: number;
  lowStockCount: number;
  lowStockProducts: { id: string; name: string; sku: string; totalStock: number; minStock: number }[];
  topProducts: { product?: { id: string; name: string; sku: string }; quantity: number; total: number }[];
  recentSales: Sale[];
  salesChart: { date: string; total: number }[];
}
