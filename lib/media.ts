import * as ImagePicker from 'expo-image-picker';
import { getToken, getApiUrl, SUPABASE_READY } from './supabase';

const API = getApiUrl();

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
  if (!SUPABASE_READY) return localUri;

  const ext = mimeType.includes('video') ? 'mp4' : 'jpg';
  const path = `media/${userId}/${postId}.${ext}`;
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Get presigned URL from API
  const urlRes = await fetch(`${API}/api/v1/storage/upload-url`, {
    method: 'POST', headers,
    body: JSON.stringify({ bucket: 'media', path, contentType: mimeType }),
  });
  if (!urlRes.ok) return null;
  const { uploadUrl, publicUrl } = await urlRes.json();

  // Upload to S3
  const response = await fetch(localUri);
  const blob = await response.blob();
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT', body: blob,
    headers: { 'Content-Type': mimeType },
  });
  if (!uploadRes.ok) return null;
  return publicUrl;
}
