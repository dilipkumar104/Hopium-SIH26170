import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Component, ScientistDecision } from "@/data/types";
import { useLot } from "@/data/lot-context";
import { toast } from "sonner";
import { RiskBadge } from "./risk-badge";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";

interface DecisionDialogProps {
  component: Component;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DecisionDialog({ component, open, onOpenChange }: DecisionDialogProps) {
  const { setDecision } = useLot();
  const [selectedDecision, setSelectedDecision] = useState<ScientistDecision | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (component && open) {
      setSelectedDecision(component.scientistDecision || null);
      setComment(component.scientistComment || "");
    }
  }, [component, open]);

  const handleSave = () => {
    if (!component) return;
    if (!selectedDecision) {
      toast.error("Please select a decision");
      return;
    }

    setDecision(component.componentId, selectedDecision, comment.trim() || undefined);

    toast.success(`Decision saved`, {
      description: `${component.componentId} marked as ${selectedDecision}`,
    });
    onOpenChange(false);
  };

  if (!component) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manual Decision</DialogTitle>
          <DialogDescription>
            Review AI recommendation and set the final decision for {component.componentId}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Component info */}
          <div className="flex justify-between items-center border-b border-gray-200 pb-3">
            <div>
              <p className="text-xs text-gray-500">Component</p>
              <p className="font-bold font-mono">{component.componentId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Risk Level</p>
              <RiskBadge level={component.risk.level} size="md" showIcon />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">AI Recommendation</p>
              <StatusBadge status={component.aiRecommendation} size="md" />
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Current Decision</p>
              <StatusBadge status={component.finalStatus} size="md" />
            </div>
          </div>

          {/* Decision selection */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Choose final action:</p>
            <div className="grid grid-cols-3 gap-2">
              {(["PASS", "MONITOR", "REJECT"] as ScientistDecision[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedDecision(option)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 border-2 rounded-md transition-all text-sm font-semibold",
                    selectedDecision === option
                      ? option === "PASS"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : option === "REJECT"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 hover:bg-gray-50 text-gray-600"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Reason / Scientist Comment:</p>
            <textarea
              className="w-full min-h-[80px] p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Add your rationale for this decision..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedDecision}>
            Save Decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
