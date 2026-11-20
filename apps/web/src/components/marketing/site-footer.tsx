import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";

const groups = [
  {
    title: "Producto",
    links: [
      { href: "/features", label: "Funciones" },
      { href: "/pricing", label: "Planes" },
      { href: "/register", label: "Crear cuenta" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/about", label: "Nosotros" },
      { href: "/privacy", label: "Privacidad" },
      { href: "/terms", label: "Términos" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Todo lo que posees, en un solo espacio inteligente.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title} className="grid content-start gap-3">
            <p className="text-sm font-medium">{g.title}</p>
            <ul className="grid gap-2.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl flex-col-reverse items-start justify-between gap-4 border-t border-border px-5 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:px-8">
        <p>
          © {new Date().getFullYear()} ORVELIA. Made by: Lucioni Enterprises.
        </p>
        <ThemeToggle />
      </div>
    </footer>
  );
}
