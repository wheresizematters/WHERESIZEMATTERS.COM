import * as ImagePicker from 'expo-image-picker';
import { supabase, SUPABASE_READY } from './supabase';

export async function pickMedia(type: 'image' | 'video' | 'all' = 'all') {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: type === 'image'
      ? ImagePicker.MediaTypeOptions.Images
      : type === 'video'
      ? ImagePicker.MediaTypeOptions.Videos
      : ImagePicker.MediaTypeOptions.All,
    allowsEditing: true,
    quality: 0.8,
    videoMaxDuration: 60,
  });

  if (result.canceled) return null;
  return result.assets[0];
}

export async function uploadMedia(
  userId: string,
  postId: string,
  localUri: string,
  mimeType: string,
): Promise<string | null> {
  if (!SUPABASE_READY) return localUri; // return local URI in demo mode

  const ext = mimeType.includes('video') ? 'mp4' : 'jpg';
  const path = `${userId}/${postId}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('media')
    .upload(path, blob, { contentType: mimeType, upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}
