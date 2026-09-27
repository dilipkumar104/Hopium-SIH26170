import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  History, Bot, User, Cpu, Search, ChevronRight,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

type ActorFilter = 'ALL' | 'SYSTEM' | 'AI' | 'SCIENTIST';

export default function AuditTrail() {
  const { state } = useLot();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState('');
  const [actorFilter, setActorFilter] = useState<ActorFilter>('ALL');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    let entries = [...state.auditTrail].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (searchId) {
      entries = entries.filter(
        (e) =>
          e.componentId.toLowerCase().includes(searchId.toLowerCase()) ||
          e.action.toLowerCase().includes(searchId.toLowerCase()) ||
          e.detail.toLowerCase().includes(searchId.toLowerCase())
      );
    }

    if (actorFilter !== 'ALL') {
      entries = entries.filter((e) => e.actor === actorFilter);
    }

    return entries;
  }, [state.auditTrail, searchId, actorFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const actorIcon = (actor: string) => {
    switch (actor) {
      case 'SYSTEM':
        return <Cpu className="w-3.5 h-3.5 text-gray-500" />;
      case 'AI':
        return <Bot className="w-3.5 h-3.5 text-blue-500" />;
      case 'SCIENTIST':
        return <User className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const actorBadge = (actor: string) => {
    switch (actor) {
      case 'SYSTEM':
        return <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600">System</Badge>;
      case 'AI':
        return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600">AI</Badge>;
      case 'SCIENTIST':
        return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600">Scientist</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-600" />
          Audit Trail
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete chronological record of all system and user actions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search by component, action, or detail..."
                value={searchId}
                onChange={(e) => { setSearchId(e.target.value); setPage(0); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={actorFilter} onValueChange={(v) => { setActorFilter(v as ActorFilter); setPage(0); }}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Filter actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actors</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="AI">AI</SelectItem>
                <SelectItem value="SCIENTIST">Scientist</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {filtered.length} entries
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Audit Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Event Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {paged.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No audit entries match the current filters.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {paged.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group"
                >
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center pt-0.5">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      {actorIcon(entry.actor)}
                    </div>
                    {idx < paged.length - 1 && (
                      <div className="w-px h-full bg-gray-200 mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-gray-400 font-mono">
                        {formatDate(entry.timestamp)}
                      </span>
                      {actorBadge(entry.actor)}
                      {entry.componentId !== 'LOT' && (
                        <button
                          className="text-[10px] font-mono text-blue-600 hover:underline"
                          onClick={() => navigate(`/component/${entry.componentId}`)}
                        >
                          {entry.componentId}
                        </button>
                      )}
                      {entry.componentId === 'LOT' && (
                        <Badge variant="outline" className="text-[10px]">LOT</Badge>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-800">{entry.action}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>
                  </div>

                  {/* Navigate arrow */}
                  {entry.componentId !== 'LOT' && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      onClick={() => navigate(`/component/${entry.componentId}`)}
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Page {page + 1} of {pageCount} ({filtered.length} entries)
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
