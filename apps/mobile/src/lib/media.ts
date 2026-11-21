import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type PickedImage = { uri: string; width: number; height: number };

/**
 * Takes a photo or picks one from the library, then shrinks it to at most
 * `maxSide` px as JPEG — enough for a readable receipt, small enough for slow
 * mobile data. Returns null when the person cancels.
 */
export async function pickImage(source: "camera" | "library", maxSide = 2000): Promise<PickedImage | { error: string } | null> {
  if (source === "camera" && Platform.OS !== "web") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { error: "Permite el acceso a la cámara en los ajustes del teléfono." };
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const scale = Math.min(1, maxSide / Math.max(a.width || maxSide, a.height || maxSide));
  const ctx = ImageManipulator.manipulate(a.uri);
  if (scale < 1) ctx.resize(a.width >= a.height ? { width: Math.round(a.width * scale) } : { height: Math.round(a.height * scale) });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Bytes of a local (or blob/data) URI, for Storage uploads. */
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  return res.arrayBuffer();
}

/** Multipart part for a local file: React Native accepts { uri, name, type }, the web needs a Blob. */
export async function filePart(uri: string, name: string, type: string): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS === "web") return (await fetch(uri)).blob();
  return { uri, name, type };
}
