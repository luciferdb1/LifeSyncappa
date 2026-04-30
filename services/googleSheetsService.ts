import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function syncDonorToGoogleSheet(action: 'add' | 'delete' | 'update' | 'soft_delete', donorData: any) {
  try {
    const configSnap = await getDoc(doc(db, 'settings', 'googleSheetsConfig'));
    if (!configSnap.exists()) return;

    const { webhookUrl } = configSnap.data();
    if (!webhookUrl) return;

    // Send the request to the Google Apps Script Webhook
    await fetch('/api/sheets-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, donorData, webhookUrl })
    });
  } catch (error) {
    console.error("Error syncing to Google Sheets:", error);
  }
}
