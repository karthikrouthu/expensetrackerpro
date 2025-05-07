import { Expense } from "@shared/schema";
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { db } from './db';
import { settings } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Interface for configuration status
export interface GoogleSheetsConfig {
  connected: boolean;
  spreadsheetId: string | null;
  errorMessage?: string;
}

// Constants for settings keys
const SPREADSHEET_ID_KEY = 'google_sheets_spreadsheet_id';

// Global state to track Google Sheets connection
let googleSheetsConfig: GoogleSheetsConfig = {
  connected: false,
  spreadsheetId: null
};

// Get auth credentials from environment variables
export async function getJwtClient() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 
        !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error("Google API credentials are missing");
    }

    // Ensure the private key is in the correct format
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    // Check if the key needs to be processed
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // Add PEM format if missing
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
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } catch (error) {
    console.error("Error creating JWT client:", error);
    throw error;
  }
}

// Get the Google Spreadsheet document
async function getSpreadsheetDoc(spreadsheetId: string) {
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

// Worksheet type
type GoogleSpreadsheetWorksheet = any;

// Get or create a worksheet for the specified month and year
async function getOrCreateWorksheet(doc: GoogleSpreadsheet, month: number, year: number): Promise<GoogleSpreadsheetWorksheet> {
  const sheetTitle = `${getMonthName(month)} ${year}`;
  
  // Try to find existing worksheet
  let sheet = doc.sheetsByTitle[sheetTitle];
  
  if (!sheet) {
    // Create new worksheet if it doesn't exist
    sheet = await doc.addSheet({ 
      title: sheetTitle,
      headerValues: ['Date', 'Amount', 'Type', 'Remarks']
    });
    
    // Format the headers for better analytics
    try {
      // Set Type column to be a categorical column for better grouping
      await sheet.loadHeaderRow();
      const typeColumnIndex = sheet.headerValues.indexOf('Type');
      
      if (typeColumnIndex !== -1) {
        // Note: This will be useful when we apply formatting in the future
        console.log(`[GoogleSheets] Type column is at index ${typeColumnIndex + 1}`);
      }
      
      console.log(`[GoogleSheets] Created new worksheet: ${sheetTitle}`);
    } catch (formatError) {
      console.error("[GoogleSheets] Error formatting headers:", formatError);
    }
  }
  
  return sheet;
}

// Helper function to get month name
function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1];
}

// Append an expense to the Google Sheet
export async function appendToGoogleSheet(expense: Expense): Promise<boolean> {
  try {
    if (!googleSheetsConfig.connected || !googleSheetsConfig.spreadsheetId) {
      console.log("[GoogleSheets] Not connected to Google Sheets");
      return false;
    }
    
    console.log(`[GoogleSheets] Appending expense to sheet: ${JSON.stringify(expense)}`);
    
    const doc = await getSpreadsheetDoc(googleSheetsConfig.spreadsheetId);
    const sheet = await getOrCreateWorksheet(doc, expense.month, expense.year);
    
    // Format the date to show only YYYY-MM-DD format (without time)
    const date = new Date(expense.date);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Ensure the Type is properly capitalized for better grouping
    const expenseType = expense.type.charAt(0).toUpperCase() + expense.type.slice(1);
    
    // Add the expense as a new row
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

// Helper to save spreadsheet ID to database
async function saveSpreadsheetIdToDb(spreadsheetId: string): Promise<void> {
  try {
    // Use raw SQL query as a workaround for any driver issues
    const neon = await import('@neondatabase/serverless');
    const { neonConfig } = neon;
    const ws = await import('ws');
    
    // Required for Neon serverless
    neonConfig.webSocketConstructor = ws.default;
    
    // Create a direct connection
    const sql = neon.default(process.env.DATABASE_URL!);
    
    // Check if the setting already exists
    const existingSetting = await sql`SELECT id FROM settings WHERE key = ${SPREADSHEET_ID_KEY}`;
    
    if (existingSetting && existingSetting.length > 0) {
      // Update existing setting
      await sql`
        UPDATE settings 
        SET value = ${spreadsheetId}, updated_at = NOW() 
        WHERE key = ${SPREADSHEET_ID_KEY}
      `;
      console.log("[GoogleSheets] Updated spreadsheet ID in database");
    } else {
      // Insert new setting
      await sql`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (${SPREADSHEET_ID_KEY}, ${spreadsheetId}, NOW())
      `;
      console.log("[GoogleSheets] Saved spreadsheet ID to database");
    }
  } catch (dbError) {
    console.error("[GoogleSheets] Error saving to database:", dbError);
  }
}

// Initialize Google Sheets connection with a specific spreadsheet
export async function connectToGoogleSheet(spreadsheetId: string): Promise<GoogleSheetsConfig> {
  try {
    // Verify that we can access the spreadsheet
    const doc = await getSpreadsheetDoc(spreadsheetId);
    
    // Update global config
    googleSheetsConfig = {
      connected: true,
      spreadsheetId: spreadsheetId
    };
    
    // Save to database for persistence
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

// Check if Google Sheets connection is established
export async function checkGoogleSheetsConnection(): Promise<GoogleSheetsConfig> {
  if (googleSheetsConfig.connected && googleSheetsConfig.spreadsheetId) {
    try {
      // Verify that we can still access the spreadsheet
      await getSpreadsheetDoc(googleSheetsConfig.spreadsheetId);
      console.log("[GoogleSheets] Connection verified");
      return googleSheetsConfig;
    } catch (error) {
      console.error("Error verifying Google Sheets connection:", error);
      
      // Reset connection status
      googleSheetsConfig = {
        connected: false,
        spreadsheetId: null,
        errorMessage: error instanceof Error ? error.message : "Connection verification failed"
      };
    }
  }
  
  return googleSheetsConfig;
}

// Helper to load spreadsheet ID from database
async function loadSpreadsheetIdFromDb(): Promise<string | null> {
  try {
    // Use raw SQL query as a workaround for any driver issues
    const neon = await import('@neondatabase/serverless');
    const { neonConfig } = neon;
    const ws = await import('ws');
    
    // Required for Neon serverless
    neonConfig.webSocketConstructor = ws.default;
    
    // Create a direct connection
    const sql = neon.default(process.env.DATABASE_URL!);
    const result = await sql`SELECT value FROM settings WHERE key = ${SPREADSHEET_ID_KEY}`;
    
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

// Initialize Google Sheets connection - this is called at startup
export async function initializeGoogleSheetsConnection(): Promise<boolean> {
  try {
    // First try to load the spreadsheet ID from the database
    const savedSpreadsheetId = await loadSpreadsheetIdFromDb();
    
    if (savedSpreadsheetId) {
      console.log("[GoogleSheets] Attempting to reconnect with saved spreadsheet ID");
      try {
        // Attempt to connect with the saved ID
        await getSpreadsheetDoc(savedSpreadsheetId);
        
        // If successful, update the config
        googleSheetsConfig = {
          connected: true,
          spreadsheetId: savedSpreadsheetId
        };
        
        console.log("[GoogleSheets] Successfully reconnected with saved spreadsheet ID");
        return true;
      } catch (reconnectError) {
        console.error("[GoogleSheets] Failed to reconnect with saved spreadsheet ID:", reconnectError);
        // Continue with normal initialization if reconnection fails
      }
    }
    
    // If no saved ID or reconnection failed, perform normal check
    const config = await checkGoogleSheetsConnection();
    console.log("[GoogleSheets] Initialized connection check:", config.connected ? "Connected" : "Not connected");
    return config.connected;
  } catch (error) {
    console.error("Error initializing Google Sheets connection:", error);
    return false;
  }
}
