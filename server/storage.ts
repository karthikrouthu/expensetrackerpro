import { expenses, type Expense, type InsertExpense } from "@shared/schema";

export interface IStorage {
  getExpenses(): Promise<Expense[]>;
  getExpensesByMonthYear(month: number, year: number): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpenseGoogleSheetsSync(id: number, synced: boolean): Promise<Expense | undefined>;
  getExpensesToSync(): Promise<Expense[]>;
}

export class MemStorage implements IStorage {
  private expenses: Map<number, Expense>;
  currentId: number;

  constructor() {
    this.expenses = new Map();
    this.currentId = 1;
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getExpensesByMonthYear(month: number, year: number): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter(expense => expense.month === month && expense.year === year)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = this.currentId++;
    const now = new Date();
    
    const expense: Expense = { 
      ...insertExpense, 
      id, 
      date: now,
      googleSheetsSync: false
    };
    
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpenseGoogleSheetsSync(id: number, synced: boolean): Promise<Expense | undefined> {
    const expense = this.expenses.get(id);
    if (!expense) return undefined;

    const updatedExpense: Expense = {
      ...expense,
      googleSheetsSync: synced
    };

    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }

  async getExpensesToSync(): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter(expense => !expense.googleSheetsSync);
  }
}

export const storage = new MemStorage();
