import { Badge } from "@/components/ui/badge";
import { RiskLevel } from "@/data/types";
import { Shield, ShieldAlert, ShieldX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function RiskBadge({ level, size = 'md', showIcon = true }: RiskBadgeProps) {
  const config = {
    LOW: {
      icon: Shield,
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
    },
    MEDIUM: {
      icon: ShieldAlert,
      classes: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
    },
    HIGH: {
      icon: AlertTriangle,
      classes: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
    },
    CRITICAL: {
      icon: ShieldX,
      classes: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
    }
  };

  const { icon: Icon, classes } = config[level] || config.LOW;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };
  
  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20
  };

  return (
    <Badge variant="outline" className={cn("font-medium", classes, sizeClasses[size])}>
      {showIcon && <Icon className="mr-1.5" size={iconSizes[size]} />}
      {level}
    </Badge>
  );
}
