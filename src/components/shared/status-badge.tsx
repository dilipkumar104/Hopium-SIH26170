import { Badge } from "@/components/ui/badge";
import { FinalStatus, ScientistDecision, AIRecommendation } from "@/data/types";
import { CheckCircle2, XCircle, Eye, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusType = FinalStatus | ScientistDecision | AIRecommendation;

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = {
    PASS: {
      icon: CheckCircle2,
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
    },
    REJECT: {
      icon: XCircle,
      classes: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
    },
    FAIL: {
      icon: XCircle,
      classes: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
    },
    MONITOR: {
      icon: Eye,
      classes: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
    },
    REVIEW: {
      icon: Search,
      classes: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
    },
    PENDING: {
      icon: Clock,
      classes: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
    }
  };

  // Fallback to PENDING if status is somewhat unrecognized
  const key = status as keyof typeof config;
  const { icon: Icon, classes } = config[key] || config.PENDING;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1"
  };

  const iconSizes = {
    sm: 12,
    md: 16
  };

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", classes, sizeClasses[size])}>
      <Icon className="mr-1.5" size={iconSizes[size]} />
      {status ? status.toLowerCase() : "pending"}
    </Badge>
  );
}
