import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { AppLayout } from "@/components/layout/AppLayout";

import LoginPage from "@/pages/LoginPage";
import RegisterCompanyPage from "@/pages/RegisterCompanyPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import CatalogPage from "@/pages/CatalogPage";
import SuppliersPage from "@/pages/SuppliersPage";
import CustomersPage from "@/pages/CustomersPage";
import SalesPosPage from "@/pages/SalesPosPage";
import SalesHistoryPage from "@/pages/SalesHistoryPage";
import PurchasesPage from "@/pages/PurchasesPage";
import OrdersPage from "@/pages/OrdersPage";
import StockPage from "@/pages/StockPage";
import StoresPage from "@/pages/StoresPage";
import TransfersPage from "@/pages/TransfersPage";
import InventoriesPage from "@/pages/InventoriesPage";
import ExpensesPage from "@/pages/ExpensesPage";
import AccountingPage from "@/pages/AccountingPage";
import EmployeesPage from "@/pages/EmployeesPage";
import UsersPage from "@/pages/UsersPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SettingsPage from "@/pages/SettingsPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import NotFoundPage from "@/pages/NotFoundPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== "SUPER_ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CompanyRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role === "SUPER_ADMIN") return <Navigate to="/super-admin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterCompanyPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />

        <Route path="/" element={<CompanyRoute><DashboardPage /></CompanyRoute>} />
        <Route path="/produits" element={<CompanyRoute><ProductsPage /></CompanyRoute>} />
        <Route path="/catalogue" element={<CompanyRoute><CatalogPage /></CompanyRoute>} />
        <Route path="/fournisseurs" element={<CompanyRoute><SuppliersPage /></CompanyRoute>} />
        <Route path="/clients" element={<CompanyRoute><CustomersPage /></CompanyRoute>} />
        <Route path="/ventes" element={<CompanyRoute><SalesPosPage /></CompanyRoute>} />
        <Route path="/ventes/historique" element={<CompanyRoute><SalesHistoryPage /></CompanyRoute>} />
        <Route path="/achats" element={<CompanyRoute><PurchasesPage /></CompanyRoute>} />
        <Route path="/commandes" element={<CompanyRoute><OrdersPage /></CompanyRoute>} />
        <Route path="/stock" element={<CompanyRoute><StockPage /></CompanyRoute>} />
        <Route path="/depots" element={<CompanyRoute><StoresPage /></CompanyRoute>} />
        <Route path="/transferts" element={<CompanyRoute><TransfersPage /></CompanyRoute>} />
        <Route path="/inventaires" element={<CompanyRoute><InventoriesPage /></CompanyRoute>} />
        <Route path="/depenses" element={<CompanyRoute><ExpensesPage /></CompanyRoute>} />
        <Route path="/comptabilite" element={<CompanyRoute><AccountingPage /></CompanyRoute>} />
        <Route path="/employes" element={<CompanyRoute><EmployeesPage /></CompanyRoute>} />
        <Route path="/utilisateurs" element={<CompanyRoute><UsersPage /></CompanyRoute>} />
        <Route path="/notifications" element={<CompanyRoute><NotificationsPage /></CompanyRoute>} />
        <Route path="/parametres" element={<CompanyRoute><SettingsPage /></CompanyRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
