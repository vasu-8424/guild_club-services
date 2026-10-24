import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRight } from "lucide-react";

interface EventItem {
  id: number;
  eventType: string;
  actorRole: string;
  actorName: string;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

interface CaseTimelineProps {
  events: EventItem[];
}

export function CaseTimeline({ events }: CaseTimelineProps) {
  const formatEventType = (type: string) => {
    return type
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-600" />
          <CardTitle className="text-base">Audit Trail & Event Log</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Immutable event ledger recorded inside database transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {events.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">
            No events recorded yet.
          </p>
        ) : (
          <div className="space-y-4 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((ev) => (
              <div key={ev.id} className="relative text-xs space-y-1">
                {/* Node circle */}
                <div className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600 shadow-xs" />

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    {formatEventType(ev.eventType)}
                  </span>
                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                    by {ev.actorName} ({ev.actorRole.replace("_", " ")})
                  </Badge>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {new Date(ev.occurredAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                {/* Status change pill */}
                {ev.fromStatus && ev.toStatus && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    <span className="font-medium capitalize">{ev.fromStatus}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="font-semibold text-emerald-800 capitalize">
                      {ev.toStatus}
                    </span>
                  </div>
                )}

                {/* Extra metadata description */}
                {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    {Object.entries(ev.metadata)
                      .filter(([_, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                      .join(" • ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
