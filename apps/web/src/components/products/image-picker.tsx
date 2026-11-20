"use client";

import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_TYPES } from "@orvelia/schemas";
import { ImagePlus, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { prepareImage } from "@/lib/resize-image";

export type ImageChange = { file: File | null; remove: boolean };

/**
 * Picks a photo, resizes it in the browser (strips EXIF/GPS) and previews it.
 * The parent uploads it after the product is saved.
 */
export function ImagePicker({
  currentUrl,
  value,
  onChange,
  disabled,
}: {
  currentUrl: string | null;
  value: ImageChange;
  onChange: (v: ImageChange) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const preview = React.useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  React.useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const shown = preview ?? (value.remove ? null : currentUrl);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setBusy(true);
    const prepared = await prepareImage(picked);
    setBusy(false);
    if (!prepared) {
      setError("No pudimos leer esta imagen. Usa una foto JPG, PNG o WEBP.");
      return;
    }
    if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(prepared.type)) {
      setError("Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (prepared.size > PRODUCT_IMAGE_MAX_BYTES) {
      setError("La imagen supera 5 MB.");
      return;
    }
    onChange({ file: prepared, remove: false });
  }

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        aria-label={shown ? "Cambiar foto" : "Agregar foto"}
        className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface transition-colors hover:border-foreground/40"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview / signed URL
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden strokeWidth={1.5} />
        )}
      </button>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={busy} disabled={disabled}>
            {shown ? "Cambiar foto" : "Agregar foto"}
          </Button>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange({ file: null, remove: Boolean(currentUrl) })}
            >
              <Trash2 aria-hidden />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground">JPG, PNG o WEBP. La reducimos y quitamos la ubicación antes de subirla.</p>
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={PRODUCT_IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFile}
      />
    </div>
  );
}
