import { collection, addDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { ActivityLog } from '../types';

export const logActivity = async (
  donorId: string, 
  action: 'call' | 'update' | 'delete' | 'create', 
  donorName?: string,
  details?: string
) => {
  if (!auth.currentUser) return;

  try {
    await addDoc(collection(db, 'logs'), {
      donorId,
      donorName,
      action,
      userEmail: auth.currentUser.email,
      userUid: auth.currentUser.uid,
      timestamp: new Date().toISOString(),
      details
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'logs');
  }
};

export const subscribeToDonorLogs = (donorId: string, callback: (logs: ActivityLog[]) => void) => {
  const q = query(
    collection(db, 'logs'),
    where('donorId', '==', donorId),
    orderBy('timestamp', 'desc'),
    limit(10)
  );

  return onSnapshot(q, (snapshot) => {
    const logs: ActivityLog[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as ActivityLog);
    });
    callback(logs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'logs');
  });
};
