import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExpenseFormData, expenseFormSchema } from "@shared/schema";
import ExpenseTypeSelector from "@/components/expense-type-selector";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface ExpenseFormProps {
  selectedMonth: number;
  selectedYear: number;
  onExpenseAdded: () => void;
}

export default function ExpenseForm({ 
  selectedMonth, 
  selectedYear,
  onExpenseAdded 
}: ExpenseFormProps) {
  const { toast } = useToast();
  
  // Query to check Google Sheets connection status
  const { data: sheetsStatus } = useQuery<{ connected: boolean; spreadsheetId: string | null; }>({
    queryKey: ['/api/google-sheets/status'],
  });
  
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: 0,
      type: "",
      remarks: "",
      month: selectedMonth,
      year: selectedYear
    }
  });

  // Update form values when month/year changes
  useEffect(() => {
    form.setValue("month", selectedMonth);
    form.setValue("year", selectedYear);
  }, [selectedMonth, selectedYear, form]);
  
  const mutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: (data) => {
      // Different success message depending on Google Sheets sync state
      let successMessage = "Expense added successfully!";
      
      if (data.googleSheetsSync) {
        successMessage = "Expense saved to Google Sheets!";
      } else if (sheetsStatus?.connected) {
        successMessage = "Expense added, but couldn't sync to Google Sheets.";
      }
      
      toast({
        title: "Success",
        description: successMessage,
        variant: "default",
        className: "bg-[hsl(124,50%,58%)] text-white border-none"
      });
      
      // Reset form
      form.reset({
        amount: 0,
        type: "",
        remarks: "",
        month: selectedMonth,
        year: selectedYear
      });
      
      // Invalidate expenses query
      queryClient.invalidateQueries({
        queryKey: [`/api/expenses/filter?month=${selectedMonth}&year=${selectedYear}`]
      });
      
      onExpenseAdded();
    },
    onError: (error: any) => {
      // Create a custom error message
      let errorMessage = "Failed to save expense";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response) {
        try {
          const errorData = error.response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error("Error parsing response:", e);
        }
      }
      
      // Show toast with a connection button if it's a connection error
      if (errorMessage.includes("connect to Google Sheets")) {
        toast({
          title: "Google Sheets Connection Required",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (data: ExpenseFormData) => {
    // Ensure month and year are correct
    data.month = selectedMonth;
    data.year = selectedYear;
    
    // Continue with submitting the expense data
    mutation.mutate(data);
  };

  return (
    <Card className="neu-shadow bg-card">
      <CardContent className="p-5">
        <h2 className="font-medium text-xl mb-6">Add New Expense</h2>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Expense Type</FormLabel>
                  <FormControl>
                    <ExpenseTypeSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="relative">
                  <div className="relative">
                    <FormControl>
                      <Input
                        id="amount"
                        placeholder=" "
                        className="input-animated bg-muted neu-shadow-inset py-6 px-4 focus:ring-primary"
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value === 0 ? "" : field.value}
                      />
                    </FormControl>
                    <Label
                      htmlFor="amount"
                      className="input-label absolute left-4 top-4 text-muted-foreground pointer-events-none"
                    >
                      Amount
                    </Label>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">₹</div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      className="bg-muted neu-shadow-inset resize-none focus:ring-primary"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button 
                type="submit"
                className="flex items-center"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
