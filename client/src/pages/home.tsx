import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MonthYearSelector from "@/components/month-year-selector";
import ExpenseForm from "@/components/expense-form";
import ExpenseHistory from "@/components/expense-history";
import GoogleSheetsConnect from "@/components/google-sheets-connect";
import { Bell, Settings, Plus, TableProperties } from "lucide-react";
import { Expense } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [sheetsDialogOpen, setSheetsDialogOpen] = useState<boolean>(false);

  // Query to get expenses
  const { data: expenses, isLoading, refetch } = useQuery<Expense[]>({
    queryKey: [`/api/expenses/filter?month=${selectedMonth}&year=${selectedYear}`],
  });

  // Query to check Google Sheets connection status
  const { data: sheetsStatus } = useQuery<{ connected: boolean; spreadsheetId: string | null; }>({
    queryKey: ['/api/google-sheets/status'],
  });

  const handlePeriodChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };
  
  const handleExpenseAdded = () => {
    refetch();
  };

  const handleSheetsConnected = () => {
    toast({
      title: "Google Sheets Connected",
      description: "Your expenses will now be synced to Google Sheets",
      variant: "default",
      className: "bg-[hsl(124,50%,58%)] text-white border-none"
    });
    refetch();
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-bold text-3xl text-center relative">
            <span className="text-primary">Expense</span> Manager
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex space-x-3">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full ${sheetsStatus?.connected ? 'bg-[hsl(124,50%,95%)] border-[hsl(124,50%,58%)]' : 'bg-card'} hover:bg-accent relative`}
                onClick={() => setSheetsDialogOpen(true)}
              >
                <TableProperties className={`w-5 h-5 ${sheetsStatus?.connected ? 'text-[hsl(124,50%,58%)]' : 'text-muted-foreground'}`} />
                {sheetsStatus?.connected && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[hsl(124,50%,58%)] rounded-full border-2 border-background"></span>
                )}
              </Button>
              <Button variant="outline" size="icon" className="rounded-full bg-card hover:bg-accent">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full bg-card hover:bg-accent">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </h1>
        </header>

        {/* Month/Year Selector */}
        <div className="mb-6">
          <MonthYearSelector 
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPeriodChange={handlePeriodChange}
          />
        </div>

        {/* Expense Form */}
        <div className="mb-8">
          <ExpenseForm 
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onExpenseAdded={handleExpenseAdded}
          />
        </div>

        {/* Expense History */}
        <ExpenseHistory 
          expenses={expenses || []}
          isLoading={isLoading}
        />

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6">
          <Button 
            className="w-14 h-14 rounded-full shadow-lg"
            onClick={() => document.getElementById('amount')?.focus()}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        
        {/* Google Sheets Connection Dialog */}
        <GoogleSheetsConnect 
          open={sheetsDialogOpen}
          onOpenChange={setSheetsDialogOpen}
          onConnect={handleSheetsConnected}
        />
      </div>
    </div>
  );
}
