import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  variant = 'default',
  onClick,
  className
}: KPICardProps) {
  const variantConfig = {
    default: {
      value: "text-gray-900",
      icon: "text-gray-400 bg-gray-100",
      border: "hover:border-gray-300",
    },
    success: {
      value: "text-emerald-600",
      icon: "text-emerald-500 bg-emerald-50",
      border: "hover:border-emerald-300",
    },
    warning: {
      value: "text-amber-600",
      icon: "text-amber-500 bg-amber-50",
      border: "hover:border-amber-300",
    },
    danger: {
      value: "text-red-600",
      icon: "text-red-500 bg-red-50",
      border: "hover:border-red-300",
    }
  };

  const config = variantConfig[variant];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-all duration-200 border-gray-200/80",
        onClick && "cursor-pointer hover:shadow-md",
        config.border,
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{title}</p>
            <p className={cn("text-2xl font-bold font-mono kpi-value", config.value)}>{value}</p>
            {description && (
              <p className="text-[10px] text-gray-400 mt-1">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.icon)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
