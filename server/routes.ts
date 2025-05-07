import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExpenseSchema } from "@shared/schema";
import { z } from "zod";
import { 
  appendToGoogleSheet, 
  initializeGoogleSheetsConnection, 
  checkGoogleSheetsConnection, 
  connectToGoogleSheet,
  GoogleSheetsConfig
} from "./googleSheets";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Google Sheets connection
  await initializeGoogleSheetsConnection();

  // API routes
  const apiRouter = express.Router();

  // Get all expenses
  apiRouter.get("/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      return res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      return res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Get expenses for a specific month and year
  apiRouter.get("/expenses/filter", async (req, res) => {
    try {
      const schema = z.object({
        month: z.coerce.number().min(1).max(12),
        year: z.coerce.number().min(2000).max(2100)
      });

      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const { month, year } = result.data;
      const expenses = await storage.getExpensesByMonthYear(month, year);
      return res.json(expenses);
    } catch (error) {
      console.error("Error fetching filtered expenses:", error);
      return res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Create a new expense
  apiRouter.post("/expenses", async (req, res) => {
    try {
      const result = insertExpenseSchema.safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Check Google Sheets connection first
      const sheetsStatus = await checkGoogleSheetsConnection();
      
      if (!sheetsStatus.connected) {
        // Return error if Google Sheets is not connected
        return res.status(400).json({ 
          message: `Please connect to Google Sheets first for month ${result.data.month}/${result.data.year} expenses.`
        });
      }

      // Create the new expense in local storage
      const newExpense = await storage.createExpense(result.data);
      
      // Attempt to sync with Google Sheets
      try {
        const syncSuccess = await appendToGoogleSheet(newExpense);
        
        if (syncSuccess) {
          // Update the sync status if successful
          await storage.updateExpenseGoogleSheetsSync(newExpense.id, true);
          newExpense.googleSheetsSync = true;
        } else {
          // Google Sheets sync failed
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

  // Google Sheets connection routes
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
      const schema = z.object({
        spreadsheetId: z.string().min(1)
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

  // Register API routes with /api prefix
  app.use("/api", apiRouter);

  const httpServer = createServer(app);

  return httpServer;
}
