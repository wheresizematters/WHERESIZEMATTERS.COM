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

function fetchWithTimeout(url: string, opts: RequestInit, ms: number = 30000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); reject(new Error('Upload timed out')); }, ms);
    fetch(url, { ...opts, signal: ctrl.signal })
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

export async function uploadMedia(
  userId: string,
  postId: string,
  localUri: string,
  mimeType: string,
): Promise<string | null> {
  if (!SUPABASE_READY) return null;

  try {
    const ext = mimeType.includes('video') ? 'mp4' : 'jpg';
    const path = `media/${userId}/${postId}.${ext}`;
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Step 1: Get presigned URL from API
    const urlRes = await fetchWithTimeout(`${API}/api/v1/storage/upload-url`, {
      method: 'POST', headers,
      body: JSON.stringify({ bucket: 'media', path, contentType: mimeType }),
    }, 15000);

    if (!urlRes.ok) {
      console.error("Upload URL failed:", urlRes.status, await urlRes.text().catch(() => ''));
      return null;
    }
    const { uploadUrl, publicUrl } = await urlRes.json();

    // Step 2: Get the file blob
    let blob: Blob;
    if (localUri.startsWith('blob:') || localUri.startsWith('http')) {
      const response = await fetchWithTimeout(localUri, {}, 10000);
      blob = await response.blob();
    } else if (localUri.startsWith('data:')) {
      // data URI — convert to blob
      const res = await fetch(localUri);
      blob = await res.blob();
    } else {
      // file:// URI (native) — fetch as normal
      const response = await fetch(localUri);
      blob = await response.blob();
    }

    if (!blob || blob.size === 0) {
      console.error("Empty blob from", localUri.substring(0, 50));
      return null;
    }

    // Step 3: Upload to S3 via presigned URL
    const uploadRes = await fetchWithTimeout(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': mimeType },
    }, 60000); // 60s for large files

    if (!uploadRes.ok) {
      console.error("S3 upload failed:", uploadRes.status);
      return null;
    }

    return publicUrl;
  } catch (err: any) {
    console.error("Upload error:", err?.message ?? err);
    return null;
  }
}
