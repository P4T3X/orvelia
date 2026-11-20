/**
 * Subscription plans — presentation metadata only.
 *
 * The enforced limits live in the `plan_limits` table and are checked on the
 * server. The numbers below mirror the initial seed so marketing pages can
 * render without a database round-trip; the database is the source of truth.
 * Prices are intentionally absent until they are defined.
 */
export const PLAN_IDS = ["free", "plus", "ultra"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanPresentation {
  id: PlanId;
  name: string;
  tagline: string;
  /** null = unlimited */
  maxProducts: number | null;
  scansPerMonth: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: readonly PlanPresentation[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Para empezar a ordenar lo esencial.",
    maxProducts: 10,
    scansPerMonth: 3,
    features: [
      "Hasta 10 productos",
      "3 escaneos de documentos al mes",
      "Panel básico",
      "Recordatorios básicos",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "Para quien quiere todo bajo control.",
    maxProducts: null,
    scansPerMonth: 30,
    features: [
      "Productos ilimitados",
      "30 escaneos al mes",
      "Organización avanzada",
      "Más almacenamiento",
    ],
    highlighted: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    tagline: "Inteligencia completa sobre tu patrimonio.",
    maxProducts: null,
    scansPerMonth: 100,
    features: [
      "100 escaneos al mes",
      "ORVELIA AI avanzada",
      "Funciones familiares cuando estén disponibles",
      "Almacenamiento ampliado",
    ],
  },
];
