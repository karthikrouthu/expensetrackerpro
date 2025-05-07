import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, ArrowRight, ReceiptText } from "lucide-react";
import { Expense } from "@shared/schema";
import { 
  getExpenseTypeById, 
  formatCurrency, 
  formatDate 
} from "@/lib/expense-types";

interface ExpenseHistoryProps {
  expenses: Expense[];
  isLoading: boolean;
}

export default function ExpenseHistory({ expenses, isLoading }: ExpenseHistoryProps) {
  return (
    <Card className="neu-shadow bg-card">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-medium text-xl">Recent Expenses</h2>
          <Button variant="outline" size="sm" className="bg-muted hover:bg-accent text-muted-foreground">
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
        </div>
        
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center p-3 mb-3 bg-muted rounded-lg overflow-hidden relative">
                <Skeleton className="w-10 h-10 rounded-full mr-3" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        )}
        
        {/* Expense History List */}
        {!isLoading && expenses.length > 0 && (
          <div className="space-y-3">
            {expenses.map(expense => {
              const expenseType = getExpenseTypeById(expense.type);
              const Icon = expenseType.icon;
              
              return (
                <div key={expense.id} className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full ${expenseType.color} flex items-center justify-center mr-3`}>
                      <Icon className="text-white h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">{expenseType.label}</h3>
                      <p className="text-muted-foreground text-sm">{expense.remarks || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(expense.amount)}</p>
                    <p className="text-muted-foreground text-xs">{formatDate(new Date(expense.date))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && expenses.length === 0 && (
          <div className="text-center py-8">
            <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <h3 className="text-lg font-medium mb-1">No expenses yet</h3>
            <p className="text-muted-foreground text-sm">Add your first expense to get started</p>
          </div>
        )}
        
        {/* View All Button */}
        {expenses.length > 0 && (
          <div className="mt-6 text-center">
            <Button variant="ghost" className="text-primary hover:text-primary/80 font-medium">
              View All Expenses
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
