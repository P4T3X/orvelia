import type { SupportedCurrency } from "@orvelia/domain";
import { SUPPORTED_CURRENCIES } from "@orvelia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "@/components/products/product-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { getProductUsage, listCategories } from "@/lib/products";

export const metadata: Metadata = { title: "Agregar producto" };

export default async function NewProductPage() {
  const user = await requireUser("/app/products/new");
  const [profile, categories, usage] = await Promise.all([
    getProfile(user.id),
    listCategories(user.id),
    getProductUsage(),
  ]);

  const currency = (SUPPORTED_CURRENCIES as readonly string[]).includes(profile?.preferred_currency ?? "")
    ? (profile!.preferred_currency as SupportedCurrency)
    : "PEN";

  return (
    <>
      <PageHeader title="Agregar producto" description="Registra algo que posees. Podrás completar los datos después." />
      {usage.atLimit ? (
        <>
          <Alert tone="info" title={`Llegaste al límite de ${usage.max} productos de tu plan.`}>
            Elimina un producto para agregar otro, o pasa a Plus para tener productos ilimitados.
          </Alert>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/app/billing">Ver planes</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/products">Volver a mi colección</Link>
            </Button>
          </div>
        </>
      ) : (
        <ProductForm
          mode="create"
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          defaults={{
            name: "",
            brand: "",
            model: "",
            categoryId: "",
            description: "",
            notes: "",
            purchaseDate: "",
            purchasePrice: "",
            currency,
            seller: "",
            serialNumber: "",
            status: "active",
          }}
        />
      )}
    </>
  );
}
