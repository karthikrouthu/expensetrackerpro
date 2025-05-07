// server/index.ts
import express3 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  expenses;
  currentId;
  constructor() {
    this.expenses = /* @__PURE__ */ new Map();
    this.currentId = 1;
  }
  async getExpenses() {
    return Array.from(this.expenses.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  async getExpensesByMonthYear(month, year) {
    return Array.from(this.expenses.values()).filter((expense) => expense.month === month && expense.year === year).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  async getExpense(id) {
    return this.expenses.get(id);
  }
  async createExpense(insertExpense) {
    const id = this.currentId++;
    const now = /* @__PURE__ */ new Date();
    const expense = {
      ...insertExpense,
      id,
      date: now,
      googleSheetsSync: false
    };
    this.expenses.set(id, expense);
    return expense;
  }
  async updateExpenseGoogleSheetsSync(id, synced) {
    const expense = this.expenses.get(id);
    if (!expense) return void 0;
    const updatedExpense = {
      ...expense,
      googleSheetsSync: synced
    };
    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }
  async getExpensesToSync() {
    return Array.from(this.expenses.values()).filter((expense) => !expense.googleSheetsSync);
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  amount: doublePrecision("amount").notNull(),
  type: text("type").notNull(),
  remarks: text("remarks"),
  date: timestamp("date").notNull().defaultNow(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  googleSheetsSync: boolean("google_sheets_sync").default(false)
});
var settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertExpenseSchema = createInsertSchema(expenses).pick({
  amount: true,
  type: true,
  remarks: true,
  month: true,
  year: true
});
var insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true
});
var expenseFormSchema = insertExpenseSchema.extend({
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.string().min(1, "Please select an expense type"),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2e3).max(2100),
  remarks: z.string().optional()
});

// server/routes.ts
import { z as z2 } from "zod";

// server/googleSheets.ts
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
var SPREADSHEET_ID_KEY = "google_sheets_spreadsheet_id";
var googleSheetsConfig = {
  connected: false,
  spreadsheetId: null
};
async function getJwtClient() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error("Google API credentials are missing");
    }
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      privateKey = privateKey.replace(/\\n/g, "\n");
      if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
        privateKey = "-----BEGIN PRIVATE KEY-----\n" + privateKey;
      }
      if (!privateKey.endsWith("-----END PRIVATE KEY-----")) {
        privateKey = privateKey + "\n-----END PRIVATE KEY-----";
      }
    }
    console.log("Creating JWT client with service account:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    return new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  } catch (error) {
    console.error("Error creating JWT client:", error);
    throw error;
  }
}
async function getSpreadsheetDoc(spreadsheetId) {
  try {
    const jwtClient = await getJwtClient();
    const doc = new GoogleSpreadsheet(spreadsheetId, jwtClient);
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error("Error accessing spreadsheet:", error);
    throw error;
  }
}
async function getOrCreateWorksheet(doc, month, year) {
  const sheetTitle = `${getMonthName(month)} ${year}`;
  let sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: sheetTitle,
      headerValues: ["Date", "Amount", "Type", "Remarks"]
    });
    try {
      await sheet.loadHeaderRow();
      const typeColumnIndex = sheet.headerValues.indexOf("Type");
      if (typeColumnIndex !== -1) {
        console.log(`[GoogleSheets] Type column is at index ${typeColumnIndex + 1}`);
      }
      console.log(`[GoogleSheets] Created new worksheet: ${sheetTitle}`);
    } catch (formatError) {
      console.error("[GoogleSheets] Error formatting headers:", formatError);
    }
  }
  return sheet;
}
function getMonthName(month) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return monthNames[month - 1];
}
async function appendToGoogleSheet(expense) {
  try {
    if (!googleSheetsConfig.connected || !googleSheetsConfig.spreadsheetId) {
      console.log("[GoogleSheets] Not connected to Google Sheets");
      return false;
    }
    console.log(`[GoogleSheets] Appending expense to sheet: ${JSON.stringify(expense)}`);
    const doc = await getSpreadsheetDoc(googleSheetsConfig.spreadsheetId);
    const sheet = await getOrCreateWorksheet(doc, expense.month, expense.year);
    const date = new Date(expense.date);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const expenseType = expense.type.charAt(0).toUpperCase() + expense.type.slice(1);
    await sheet.addRow({
      Date: formattedDate,
      Amount: expense.amount,
      Type: expenseType,
      Remarks: expense.remarks || ""
    });
    return true;
  } catch (error) {
    console.error("Error appending to Google Sheet:", error);
    return false;
  }
}
async function saveSpreadsheetIdToDb(spreadsheetId) {
  try {
    const neon2 = await import("@neondatabase/serverless");
    const { neonConfig: neonConfig2 } = neon2;
    const ws2 = await import("ws");
    neonConfig2.webSocketConstructor = ws2.default;
    const sql2 = neon2.default(process.env.DATABASE_URL);
    const existingSetting = await sql2`SELECT id FROM settings WHERE key = ${SPREADSHEET_ID_KEY}`;
    if (existingSetting && existingSetting.length > 0) {
      await sql2`
        UPDATE settings 
        SET value = ${spreadsheetId}, updated_at = NOW() 
        WHERE key = ${SPREADSHEET_ID_KEY}
      `;
      console.log("[GoogleSheets] Updated spreadsheet ID in database");
    } else {
      await sql2`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (${SPREADSHEET_ID_KEY}, ${spreadsheetId}, NOW())
      `;
      console.log("[GoogleSheets] Saved spreadsheet ID to database");
    }
  } catch (dbError) {
    console.error("[GoogleSheets] Error saving to database:", dbError);
  }
}
async function connectToGoogleSheet(spreadsheetId) {
  try {
    const doc = await getSpreadsheetDoc(spreadsheetId);
    googleSheetsConfig = {
      connected: true,
      spreadsheetId
    };
    await saveSpreadsheetIdToDb(spreadsheetId);
    console.log(`[GoogleSheets] Successfully connected to spreadsheet: ${doc.title}`);
    return googleSheetsConfig;
  } catch (error) {
    console.error("Error connecting to Google Sheet:", error);
    googleSheetsConfig = {
      connected: false,
      spreadsheetId: null,
      errorMessage: error instanceof Error ? error.message : "Unknown error connecting to Google Sheets"
    };
    return googleSheetsConfig;
  }
}
async function checkGoogleSheetsConnection() {
  if (googleSheetsConfig.connected && googleSheetsConfig.spreadsheetId) {
    try {
      await getSpreadsheetDoc(googleSheetsConfig.spreadsheetId);
      console.log("[GoogleSheets] Connection verified");
      return googleSheetsConfig;
    } catch (error) {
      console.error("Error verifying Google Sheets connection:", error);
      googleSheetsConfig = {
        connected: false,
        spreadsheetId: null,
        errorMessage: error instanceof Error ? error.message : "Connection verification failed"
      };
    }
  }
  return googleSheetsConfig;
}
async function loadSpreadsheetIdFromDb() {
  try {
    const neon2 = await import("@neondatabase/serverless");
    const { neonConfig: neonConfig2 } = neon2;
    const ws2 = await import("ws");
    neonConfig2.webSocketConstructor = ws2.default;
    const sql2 = neon2.default(process.env.DATABASE_URL);
    const result = await sql2`SELECT value FROM settings WHERE key = ${SPREADSHEET_ID_KEY}`;
    if (result && result.length > 0 && result[0].value) {
      console.log("[GoogleSheets] Found spreadsheet ID in database");
      return result[0].value;
    }
    return null;
  } catch (dbError) {
    console.error("[GoogleSheets] Error loading from database:", dbError);
    return null;
  }
}
async function initializeGoogleSheetsConnection() {
  try {
    const savedSpreadsheetId = await loadSpreadsheetIdFromDb();
    if (savedSpreadsheetId) {
      console.log("[GoogleSheets] Attempting to reconnect with saved spreadsheet ID");
      try {
        await getSpreadsheetDoc(savedSpreadsheetId);
        googleSheetsConfig = {
          connected: true,
          spreadsheetId: savedSpreadsheetId
        };
        console.log("[GoogleSheets] Successfully reconnected with saved spreadsheet ID");
        return true;
      } catch (reconnectError) {
        console.error("[GoogleSheets] Failed to reconnect with saved spreadsheet ID:", reconnectError);
      }
    }
    const config = await checkGoogleSheetsConnection();
    console.log("[GoogleSheets] Initialized connection check:", config.connected ? "Connected" : "Not connected");
    return config.connected;
  } catch (error) {
    console.error("Error initializing Google Sheets connection:", error);
    return false;
  }
}

// server/routes.ts
import { fromZodError } from "zod-validation-error";
async function registerRoutes(app2) {
  await initializeGoogleSheetsConnection();
  const apiRouter = express.Router();
  apiRouter.get("/expenses", async (req, res) => {
    try {
      const expenses2 = await storage.getExpenses();
      return res.json(expenses2);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      return res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });
  apiRouter.get("/expenses/filter", async (req, res) => {
    try {
      const schema = z2.object({
        month: z2.coerce.number().min(1).max(12),
        year: z2.coerce.number().min(2e3).max(2100)
      });
      const result = schema.safeParse(req.query);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const { month, year } = result.data;
      const expenses2 = await storage.getExpensesByMonthYear(month, year);
      return res.json(expenses2);
    } catch (error) {
      console.error("Error fetching filtered expenses:", error);
      return res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });
  apiRouter.post("/expenses", async (req, res) => {
    try {
      const result = insertExpenseSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const sheetsStatus = await checkGoogleSheetsConnection();
      if (!sheetsStatus.connected) {
        return res.status(400).json({
          message: `Please connect to Google Sheets first for month ${result.data.month}/${result.data.year} expenses.`
        });
      }
      const newExpense = await storage.createExpense(result.data);
      try {
        const syncSuccess = await appendToGoogleSheet(newExpense);
        if (syncSuccess) {
          await storage.updateExpenseGoogleSheetsSync(newExpense.id, true);
          newExpense.googleSheetsSync = true;
        } else {
          console.error("Failed to add expense to Google Sheets for month:", newExpense.month, "year:", newExpense.year);
          return res.status(400).json({
            message: `Failed to add expense to Google Sheets for month ${newExpense.month}/${newExpense.year}. Please try again.`
          });
        }
      } catch (syncError) {
        console.error("Error during Google Sheets sync:", syncError);
        return res.status(400).json({
          message: "Failed to sync with Google Sheets. Please check your connection."
        });
      }
      return res.status(201).json(newExpense);
    } catch (error) {
      console.error("Error creating expense:", error);
      return res.status(500).json({ message: "Failed to create expense" });
    }
  });
  apiRouter.get("/google-sheets/status", async (req, res) => {
    try {
      const status = await checkGoogleSheetsConnection();
      return res.json(status);
    } catch (error) {
      console.error("Error checking Google Sheets status:", error);
      return res.status(500).json({
        connected: false,
        spreadsheetId: null,
        errorMessage: "Failed to check Google Sheets connection"
      });
    }
  });
  apiRouter.post("/google-sheets/connect", async (req, res) => {
    try {
      const schema = z2.object({
        spreadsheetId: z2.string().min(1)
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const { spreadsheetId } = result.data;
      const connectionStatus = await connectToGoogleSheet(spreadsheetId);
      return res.json(connectionStatus);
    } catch (error) {
      console.error("Error connecting to Google Sheets:", error);
      return res.status(500).json({
        connected: false,
        spreadsheetId: null,
        errorMessage: "Failed to connect to Google Sheets"
      });
    }
  });
  app2.use("/api", apiRouter);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/db.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
var sql = neon(process.env.DATABASE_URL);
var db = drizzle(sql);
async function setupDatabase() {
  try {
    console.log("[Database] Setting up database...");
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        amount DOUBLE PRECISION NOT NULL,
        type TEXT NOT NULL,
        remarks TEXT,
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        google_sheets_sync BOOLEAN DEFAULT FALSE
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log("[Database] Setup completed successfully");
  } catch (error) {
    console.error("[Database] Setup error:", error);
    throw error;
  }
}

// server/index.ts
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  try {
    await setupDatabase();
    log("Database setup completed");
  } catch (dbError) {
    log("Database setup error: " + (dbError instanceof Error ? dbError.message : String(dbError)));
  }
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
