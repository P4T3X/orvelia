import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES, type SupportedCurrency, type SupportedLanguage } from "@orvelia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "@/components/app/profile-form";
import { NotificationPrefsForm } from "@/components/calendar/notification-prefs-form";
import { CategoriesManager } from "@/components/products/categories-manager";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { listCategories } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

function Section({ id, title, description, children }: { id?: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 grid gap-6 border-t border-border py-8 first:border-t-0 first:pt-0 lg:grid-cols-[18rem_1fr] lg:gap-12">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser("/app/settings");
  const supabase = await createClient();
  const [profile, categories, { data: prefs }] = await Promise.all([
    getProfile(user.id),
    listCategories(user.id),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(profile?.preferred_language ?? "")
    ? (profile!.preferred_language as SupportedLanguage)
    : "es";
  const currency = (SUPPORTED_CURRENCIES as readonly string[]).includes(profile?.preferred_currency ?? "")
    ? (profile!.preferred_currency as SupportedCurrency)
    : "PEN";

  return (
    <>
      <PageHeader title="Ajustes" description="Tu perfil, preferencias y seguridad de la cuenta." />

      <Section title="Perfil" description="Cómo te mostramos la información en ORVELIA.">
        <ProfileForm
          defaults={{
            fullName: profile?.full_name ?? "",
            preferredLanguage: lang,
            preferredCurrency: currency,
            timezone: profile?.timezone ?? "America/Lima",
          }}
        />
      </Section>

      <Section id="avisos" title="Avisos" description="Cuándo y cómo te recordamos garantías, devoluciones y documentos.">
        <NotificationPrefsForm
          emailConfigured={isEmailConfigured()}
          initial={{
            emailEnabled: prefs?.email_enabled ?? true,
            warrantyLeadDays: prefs?.warranty_lead_days ?? [30, 7],
            returnLeadDays: prefs?.return_lead_days ?? [3, 1],
            documentLeadDays: prefs?.document_lead_days ?? [30, 7],
          }}
        />
      </Section>

      <Section title="Categorías" description="Organiza tu colección con categorías propias.">
        <CategoriesManager
          own={categories.filter((c) => c.own).map((c) => ({ id: c.id, name: c.name }))}
          systemCount={categories.filter((c) => !c.own).length}
        />
      </Section>

      <Section title="Apariencia" description="Elige el tema claro, oscuro o el de tu sistema.">
        <ThemeToggle />
      </Section>

      <Section title="Cuenta" description="Acceso y seguridad.">
        <dl className="grid gap-1">
          <dt className="text-sm text-muted-foreground">Correo electrónico</dt>
          <dd className="font-medium">{user.email}</dd>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/forgot-password">Cambiar contraseña</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </Section>
    </>
  );
}
