import type { IconName } from "@/components/ui";
import type { UpcomingItem } from "@orvelia/api";

export const KIND: Record<UpcomingItem["kind"], { label: string; icon: IconName }> = {
  warranty: { label: "Garantía", icon: "shield" },
  return: { label: "Devolución", icon: "rotate-ccw" },
  document: { label: "Documento", icon: "file-text" },
  reminder: { label: "Recordatorio", icon: "bell" },
};

export const PLAN_NAMES = { free: "Free", plus: "Plus", ultra: "Ultra" } as const;

export function greeting(name: string | null) {
  const h = new Date().getHours();
  const g = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  return name ? `${g}, ${name.split(/\s+/)[0]}` : g;
}
