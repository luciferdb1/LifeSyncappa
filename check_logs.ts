import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function checkLogs() {
  const snapshot = await db.collection('webhookLogs').orderBy('timestamp', 'desc').limit(5).get();
  if (snapshot.empty) {
    console.log('No logs found.');
    return;
  }

  snapshot.forEach(doc => {
    console.log('--- LOG ---');
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

checkLogs().catch(console.error);
