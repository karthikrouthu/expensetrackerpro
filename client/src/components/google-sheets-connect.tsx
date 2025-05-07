import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Schema for validating spreadsheet ID
const spreadsheetSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
});

type SpreadsheetFormData = z.infer<typeof spreadsheetSchema>;

// Google Sheets connection status interface
interface GoogleSheetsStatus {
  connected: boolean;
  spreadsheetId: string | null;
  errorMessage?: string;
}

interface GoogleSheetsConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: () => void;
}

export default function GoogleSheetsConnect({ open, onOpenChange, onConnect }: GoogleSheetsConnectProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<GoogleSheetsStatus | null>(null);

  // Form for spreadsheet ID
  const form = useForm<SpreadsheetFormData>({
    resolver: zodResolver(spreadsheetSchema),
    defaultValues: {
      spreadsheetId: "",
    },
  });

  // Query to get current Google Sheets connection status
  const { data, isLoading: isStatusLoading } = useQuery<GoogleSheetsStatus>({
    queryKey: ['/api/google-sheets/status'],
    enabled: open,
  });

  // Update local status when data changes
  useEffect(() => {
    if (data) {
      setStatus(data);
    }
  }, [data]);

  // Mutation to connect to Google Sheets
  const connectMutation = useMutation({
    mutationFn: async (data: SpreadsheetFormData) => {
      const res = await apiRequest("POST", "/api/google-sheets/connect", data);
      return res.json();
    },
    onSuccess: (data: GoogleSheetsStatus) => {
      setStatus(data);
      
      if (data.connected) {
        toast({
          title: "Connected",
          description: "Successfully connected to Google Sheets",
          variant: "default",
          className: "bg-[hsl(124,50%,58%)] text-white border-none"
        });
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['/api/google-sheets/status'] });
        
        if (onConnect) {
          onConnect();
        }
      } else {
        toast({
          title: "Connection Failed",
          description: data.errorMessage || "Could not connect to Google Sheets",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to Google Sheets",
        variant: "destructive"
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: SpreadsheetFormData) => {
    connectMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to Google Sheets</DialogTitle>
          <DialogDescription>
            Connect your expense data to a Google Spreadsheet for better tracking and analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isStatusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Checking connection status...</p>
            </div>
          ) : status?.connected ? (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle2 className="h-6 w-6 text-[hsl(124,50%,58%)] flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-medium">Connected to Google Sheets</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your expenses will be saved to the spreadsheet automatically.
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                        ID: {status.spreadsheetId}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="ml-2"
                        onClick={() => {
                          setStatus(prev => prev ? { ...prev, connected: false, spreadsheetId: null } : null);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {status?.errorMessage && (
                <div className="mb-4 p-3 bg-destructive/10 rounded-md flex items-start">
                  <AlertTriangle className="h-5 w-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{status.errorMessage}</p>
                </div>
              )}
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="spreadsheetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Spreadsheet ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter spreadsheet ID" 
                            className="bg-muted neu-shadow-inset focus:ring-primary"
                            {...field} 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          The ID is found in your Google Sheets URL: https://docs.google.com/spreadsheets/d/<span className="font-medium">spreadsheetId</span>/edit
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="mr-2"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={connectMutation.isPending}
                    >
                      {connectMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Connect
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}