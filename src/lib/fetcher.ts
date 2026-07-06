import { mutate } from 'swr';

export const GOOGLE_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycbzZPSpu15sbrfuWVwzYEcSKYhTCXG6jPJlgqvKuBBCQaZTR8gT9n7YX3AXnaLZs_vThOA/exec';

// Track global offline status using a simple custom event
let isOffline = false;

export function getOfflineStatus(): boolean {
  return isOffline;
}

export function setOfflineStatus(status: boolean) {
  if (isOffline !== status) {
    isOffline = status;
    // Dispatch a custom event so App.tsx and other components can listen
    window.dispatchEvent(new CustomEvent('sheets-offline-change', { detail: status }));
  }
}

export async function sheetsFetcher(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();
    
    // Successfully fetched, so mark server as ONLINE
    setOfflineStatus(false);

    if (json.success) {
      // Handle double wrap: { success: true, data: { success: true, data: [...] } }
      if (json.data && typeof json.data === 'object' && json.data.success && Array.isArray(json.data.data)) {
        return json.data.data;
      }
      // Handle single wrap: { success: true, data: [...] }
      if (Array.isArray(json.data)) {
        return json.data;
      }
      // Handle dict/misc success structures
      if (json.data) {
        return json.data;
      }
    }
    
    // If the success is false, or structure is weird
    throw new Error(json.error || 'Invalid API response structure');
  } catch (err: any) {
    console.error('SWR Fetcher error:', err);
    // Mark server as OFFLINE
    setOfflineStatus(true);
    throw err;
  }
}
