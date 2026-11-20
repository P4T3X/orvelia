import "server-only";

import { STORAGE_BUCKET } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

/** Remove every object directly inside a folder of the private bucket. */
export async function removeFolder(folder: string) {
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 100 });
  if (files && files.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }
}

export async function downloadBytes(path: string): Promise<Uint8Array | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
