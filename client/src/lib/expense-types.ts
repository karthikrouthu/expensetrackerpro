import { 
  Utensils, 
  Car, 
  ShoppingBag, 
  Receipt, 
  Film, 
  MoreHorizontal, 
  Home, 
  GraduationCap, 
  Pill, 
  Plane 
} from "lucide-react";

export type ExpenseType = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
};

export const expenseTypes: ExpenseType[] = [
  {
    id: "food",
    label: "Food",
    icon: Utensils,
    color: "bg-primary"
  },
  {
    id: "transport",
    label: "Transport",
    icon: Car,
    color: "bg-primary"
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: ShoppingBag,
    color: "bg-secondary"
  },
  {
    id: "bills",
    label: "Bills",
    icon: Receipt,
    color: "bg-destructive"
  },
  {
    id: "entertainment",
    label: "Entertainment",
    icon: Film,
    color: "bg-[hsl(124,50%,58%)]"
  },
  {
    id: "housing",
    label: "Housing",
    icon: Home,
    color: "bg-[hsl(28,85%,64%)]"
  },
  {
    id: "education",
    label: "Education",
    icon: GraduationCap,
    color: "bg-[hsl(262,83%,58%)]"
  },
  {
    id: "healthcare",
    label: "Healthcare",
    icon: Pill,
    color: "bg-[hsl(187,75%,64%)]"
  },
  {
    id: "travel",
    label: "Travel",
    icon: Plane,
    color: "bg-[hsl(340,82%,52%)]"
  },
  {
    id: "other",
    label: "Other",
    icon: MoreHorizontal,
    color: "bg-muted-foreground"
  }
];

export function getExpenseTypeById(id: string): ExpenseType {
  return expenseTypes.find(type => type.id === id) || expenseTypes[expenseTypes.length - 1];
}

export function getExpenseTypeIcon(id: string): React.ElementType {
  return getExpenseTypeById(id).icon;
}

export function getExpenseTypeColor(id: string): string {
  return getExpenseTypeById(id).color;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(date: Date): string {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}
