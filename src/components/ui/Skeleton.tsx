export function Skeleton({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} style={{ height: "0.875rem", width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-6 space-y-3 ${className}`}>
      <Skeleton style={{ height: "0.75rem", width: "40%" }} />
      <Skeleton style={{ height: "2rem", width: "60%" }} />
      <Skeleton style={{ height: "0.75rem", width: "80%" }} />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr>
      <td><Skeleton style={{ height: "1rem", width: "4rem" }} /></td>
      <td><Skeleton style={{ height: "1rem", width: "12rem" }} /></td>
      <td><Skeleton style={{ height: "1rem", width: "3rem" }} /></td>
      <td><Skeleton style={{ height: "1rem", width: "5rem" }} /></td>
      <td><Skeleton style={{ height: "1rem", width: "6rem" }} /></td>
    </tr>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border border-border">
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>page</th>
            <th>score</th>
            <th>status</th>
            <th>timestamp</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
