import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MonthYearSelectorProps {
  selectedMonth: number;
  selectedYear: number;
  onPeriodChange: (month: number, year: number) => void;
}

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function MonthYearSelector({ 
  selectedMonth, 
  selectedYear, 
  onPeriodChange 
}: MonthYearSelectorProps) {
  const handlePreviousMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    onPeriodChange(newMonth, newYear);
  };
  
  const handleNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    
    onPeriodChange(newMonth, newYear);
  };
  
  const handleMonthChange = (value: string) => {
    onPeriodChange(parseInt(value), selectedYear);
  };
  
  const handleYearChange = (value: string) => {
    onPeriodChange(selectedMonth, parseInt(value));
  };
  
  const handleToday = () => {
    const today = new Date();
    onPeriodChange(today.getMonth() + 1, today.getFullYear());
  };

  return (
    <Card className="neu-shadow bg-card">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium">Select Period</h2>
          <Button 
            variant="ghost" 
            className="text-secondary text-sm font-medium"
            onClick={handleToday}
          >
            Today
          </Button>
        </div>
        
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-accent"
            onClick={handlePreviousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <div className="flex space-x-4">
            <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-32 bg-muted neu-shadow-inset focus:ring-primary">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-24 bg-muted neu-shadow-inset focus:ring-primary">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-accent"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
