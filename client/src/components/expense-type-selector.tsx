import { expenseTypes } from "@/lib/expense-types";
import { Check } from "lucide-react";

interface ExpenseTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ExpenseTypeSelector({ value, onChange }: ExpenseTypeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {expenseTypes.map(type => {
        const Icon = type.icon;
        
        return (
          <div key={type.id} className="relative">
            <input
              type="radio"
              name="expenseType"
              id={`type-${type.id}`}
              value={type.id}
              checked={value === type.id}
              onChange={() => onChange(type.id)}
              className="expense-type-option sr-only"
            />
            <label
              htmlFor={`type-${type.id}`}
              className="flex flex-col items-center justify-center p-3 bg-muted rounded-lg cursor-pointer transition-all hover:bg-muted/80"
            >
              <Icon className="mb-1 h-6 w-6" />
              <span className="text-sm">{type.label}</span>
              <span className="check-icon text-white absolute top-1 right-1 opacity-0 text-sm">
                <Check className="h-3 w-3" />
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
