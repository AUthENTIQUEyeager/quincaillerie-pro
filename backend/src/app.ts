import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes";
import { categoryRouter, subCategoryRouter, brandRouter } from "./routes/catalog.routes";
import supplierRoutes from "./routes/supplier.routes";
import customerRoutes from "./routes/customer.routes";
import storeRoutes from "./routes/store.routes";
import productRoutes from "./routes/product.routes";
import stockRoutes from "./routes/stock.routes";
import saleRoutes from "./routes/sale.routes";
import purchaseRoutes from "./routes/purchase.routes";
import expenseRoutes from "./routes/expense.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import accountingRoutes from "./routes/accounting.routes";
import employeeRoutes from "./routes/employee.routes";
import userRoutes from "./routes/user.routes";
import notificationRoutes from "./routes/notification.routes";
import orderRoutes from "./routes/order.routes";
import settingsRoutes from "./routes/settings.routes";
import superadminRoutes from "./routes/superadmin.routes";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  // Render (comme la plupart des PaaS) place l'app derrière un reverse proxy.
  // Sans ceci, express-rate-limit lève une erreur sur l'en-tête X-Forwarded-For.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
  app.use("/api", limiter);

  app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/categories", categoryRouter);
  app.use("/api/subcategories", subCategoryRouter);
  app.use("/api/brands", brandRouter);
  app.use("/api/suppliers", supplierRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/stores", storeRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/stock", stockRoutes);
  app.use("/api/sales", saleRoutes);
  app.use("/api/purchases", purchaseRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/accounting", accountingRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/superadmin", superadminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
