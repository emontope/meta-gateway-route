import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div role="status" aria-label="Loading records" className="space-y-3">
    {Array.from({ length: rows }, (_, i) => <div className="well flex min-h-20 items-center gap-4 p-4" key={i}>
      <Skeleton className="size-9 shrink-0" />
      <div className="flex-1 space-y-3"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-2 w-1/2" /></div>
      <Skeleton className="h-6 w-14" />
    </div>)}
    <span className="sr-only">Loading records</span>
  </div>;
}
export function UsageSkeleton() {
  return <div role="status" aria-label="Loading usage logs" className="well overflow-hidden p-4">
    <div className="grid grid-cols-6 gap-4 border-b pb-4">{Array.from({ length: 6 }, (_, i) => <Skeleton className="h-3" key={i} />)}</div>
    {Array.from({ length: 6 }, (_, i) => <div className="grid grid-cols-6 gap-4 border-b py-4 last:border-0" key={i}>{Array.from({ length: 6 }, (_, j) => <Skeleton className="h-3" key={j} />)}</div>)}
    <span className="sr-only">Loading usage logs</span>
  </div>;
}