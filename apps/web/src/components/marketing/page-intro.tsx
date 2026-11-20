export function PageIntro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 md:pt-20">
      <h1 className="max-w-3xl text-[2.4rem] font-medium leading-[1.06] tracking-[-0.035em] text-balance sm:text-5xl">
        {title}
      </h1>
      {children && (
        <div className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">{children}</div>
      )}
    </div>
  );
}
