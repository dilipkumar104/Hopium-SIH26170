import { Info } from "lucide-react";

export function Disclaimer() {
  return (
    <div className="flex items-center justify-center space-x-2 py-4 px-6 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
      <Info className="h-4 w-4 shrink-0" />
      <p>
        Prototype / Decision Support System — AI outputs are intended to support engineering review and do not independently determine final component disposition.
      </p>
    </div>
  );
}
