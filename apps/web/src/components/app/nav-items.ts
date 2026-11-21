import {
  Bot,
  CalendarDays,
  ChartColumn,
  CreditCard,
  FileText,
  House,
  Package,
  ScanLine,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export const primaryNav: NavItem[] = [
  { href: "/app", label: "Inicio", icon: House, exact: true },
  { href: "/app/products", label: "Mi colección", icon: Package },
  { href: "/app/scanner", label: "Escáner", icon: ScanLine },
  { href: "/app/documents", label: "Documentos", icon: FileText },
  { href: "/app/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/app/analytics", label: "Análisis", icon: ChartColumn },
  { href: "/app/family", label: "Familia", icon: Users },
  { href: "/app/assistant", label: "ORVELIA AI", icon: Bot },
];

export const secondaryNav: NavItem[] = [
  { href: "/app/billing", label: "Plan", icon: CreditCard },
  { href: "/app/settings", label: "Ajustes", icon: Settings },
];
