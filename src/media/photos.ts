export async function pickLibraryPhoto(): Promise<string | null> {
  try {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  } catch {
    return null;
  }
}

export function stampUri(jobId: string): string {
  return `stamp://${jobId}/${Date.now()}`;
}
