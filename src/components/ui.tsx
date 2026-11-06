import type { ReactNode } from "react";

export function Card({ title, children, className = "", aside }: { title?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`rounded-lg border border-line bg-panel p-4 ${className}`}>
      {(title || aside) && <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="font-semibold">{title}</h2>{aside}</div>}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="num text-2xl font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function AsOf({ d }: { d: string }) {
  return <span className="text-xs text-muted whitespace-nowrap">au {d}</span>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto -mx-1 px-1">{children}</div>;
}
