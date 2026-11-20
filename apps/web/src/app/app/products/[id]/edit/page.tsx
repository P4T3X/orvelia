import type { SupportedCurrency } from "@orvelia/domain";
import { SUPPORTED_CURRENCIES } from "@orvelia/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "@/components/products/product-form";
import { getProfile, requireUser } from "@/lib/auth";
import { getProduct, listCategories } from "@/lib/products";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/app/products/${id}/edit`);
  const [product, categories, profile] = await Promise.all([
    getProduct(user.id, id),
    listCategories(user.id),
    getProfile(user.id),
  ]);
  if (!product) notFound();

  const fallbackCurrency = (SUPPORTED_CURRENCIES as readonly string[]).includes(profile?.preferred_currency ?? "")
    ? (profile!.preferred_currency as SupportedCurrency)
    : "PEN";
  const currency = (SUPPORTED_CURRENCIES as readonly string[]).includes(product.currency ?? "")
    ? (product.currency as SupportedCurrency)
    : fallbackCurrency;

  return (
    <>
      <PageHeader title="Editar producto" description={product.name} />
      <ProductForm
        mode="edit"
        productId={product.id}
        currentImageUrl={product.imageUrl}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaults={{
          name: product.name,
          brand: product.brand ?? "",
          model: product.model ?? "",
          categoryId: product.categoryId ?? "",
          description: product.description ?? "",
          notes: product.notes ?? "",
          purchaseDate: product.purchaseDate?.slice(0, 10) ?? "",
          purchasePrice: product.purchasePrice === null ? "" : product.purchasePrice.toFixed(2),
          currency,
          seller: product.seller ?? "",
          serialNumber: product.serialNumber ?? "",
          status: product.status,
        }}
      />
    </>
  );
}
