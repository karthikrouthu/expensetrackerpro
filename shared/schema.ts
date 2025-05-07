import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  amount: doublePrecision("amount").notNull(),
  type: text("type").notNull(),
  remarks: text("remarks"),
  date: timestamp("date").notNull().defaultNow(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  googleSheetsSync: boolean("google_sheets_sync").default(false),
});

// Settings table for storing application settings like Google Sheets connection
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  amount: true,
  type: true, 
  remarks: true,
  month: true,
  year: true,
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true,
});

// Extended schema with validation
export const expenseFormSchema = insertExpenseSchema.extend({
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.string().min(1, "Please select an expense type"),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  remarks: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseFormData = z.infer<typeof expenseFormSchema>;

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
