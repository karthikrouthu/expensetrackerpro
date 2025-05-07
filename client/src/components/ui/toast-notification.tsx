import { X, CheckCircle } from "lucide-react";
import { forwardRef, ComponentPropsWithoutRef, ElementRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toastVariants = cva(
  "fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg flex items-center justify-between",
  {
    variants: {
      variant: {
        default: "bg-[hsl(124,50%,58%)] text-white",
        destructive: "bg-destructive text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ToastProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof toastVariants> {
  message: string;
  onClose?: () => void;
}

export const Toast = forwardRef<ElementRef<"div">, ToastProps>(
  ({ className, variant, message, onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          <span>{message}</span>
        </div>
        <button className="ml-3 text-white" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }
);
Toast.displayName = "Toast";
