export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[1.75rem] font-medium tracking-[-0.025em]">{title}</h1>
      {children && <p className="mt-2 text-muted-foreground">{children}</p>}
    </div>
  );
}
