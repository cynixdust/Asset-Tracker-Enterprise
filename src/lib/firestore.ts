import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { db, auth, isSqliteMode } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const firestoreService = {
  async add(path: string, data: any) {
    if (isSqliteMode()) {
      try {
        const res = await fetch(`/api/db/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'local-admin-uid'
          })
        });
        if (!res.ok) throw new Error(`SQLite add failed: ${res.statusText}`);
        const result = await res.json();
        return result.id;
      } catch (error) {
        console.error("SQLite Add Document Error:", error);
        throw error;
      }
    }

    try {
      const docRef = await addDoc(collection(db, path), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async update(path: string, id: string, data: any) {
    if (isSqliteMode()) {
      try {
        const res = await fetch(`/api/db/${path}/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            updatedAt: new Date().toISOString()
          })
        });
        if (!res.ok) throw new Error(`SQLite update failed: ${res.statusText}`);
        return;
      } catch (error) {
        console.error("SQLite Update Document Error:", error);
        throw error;
      }
    }

    try {
      const docRef = doc(db, path, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async set(path: string, id: string, data: any) {
    if (isSqliteMode()) {
      try {
        const res = await fetch(`/api/db/${path}/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            updatedAt: new Date().toISOString()
          })
        });
        if (!res.ok) throw new Error(`SQLite set failed: ${res.statusText}`);
        return;
      } catch (error) {
        console.error("SQLite Set Document Error:", error);
        throw error;
      }
    }

    try {
      const docRef = doc(db, path, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${id}`);
    }
  },

  async delete(path: string, id: string) {
    if (isSqliteMode()) {
      try {
        const res = await fetch(`/api/db/${path}/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error(`SQLite delete failed: ${res.statusText}`);
        return;
      } catch (error) {
        console.error("SQLite Delete Document Error:", error);
        throw error;
      }
    }

    try {
      const docRef = doc(db, path, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  },

  async get(path: string, id: string) {
    if (isSqliteMode()) {
      try {
        const res = await fetch(`/api/db/${path}/${id}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`SQLite get failed: ${res.statusText}`);
        return await res.json();
      } catch (error) {
        console.error("SQLite Get Document Error:", error);
        return null;
      }
    }

    try {
      const docRef = doc(db, path, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    }
  },

  async checkUniqueness(path: string, field: string, value: string, excludeId?: string) {
    if (isSqliteMode()) {
      try {
        const res = await fetch(`/api/db/${path}`);
        if (!res.ok) return false;
        const list = await res.json() as any[];
        if (excludeId) {
          return list.every(doc => doc[field] !== value || doc.id === excludeId);
        }
        return list.every(doc => doc[field] !== value);
      } catch (error) {
        console.error("SQLite Uniqueness Check Error:", error);
        return false;
      }
    }

    try {
      const q = query(collection(db, path), where(field, "==", value));
      const querySnapshot = await getDocs(q);
      if (excludeId) {
        return querySnapshot.docs.every(doc => doc.id === excludeId);
      }
      return querySnapshot.empty;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return false;
    }
  },

  subscribe(path: string, callback: (data: any[]) => void, queryConstraints: any[] = []) {
    if (isSqliteMode()) {
      let active = true;
      const poll = async () => {
        try {
          const res = await fetch(`/api/db/${path}`);
          if (!res.ok) return;
          const data = await res.json();
          if (active) callback(data);
        } catch (e) {
          console.error(`Poll error on collection ${path}:`, e);
        }
      };
      poll();
      const interval = setInterval(poll, 2500); // Poll every 2.5s
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const q = query(collection(db, path), ...queryConstraints);
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeDoc(path: string, id: string, callback: (data: any) => void) {
    if (isSqliteMode()) {
      let active = true;
      const poll = async () => {
        try {
          const res = await fetch(`/api/db/${path}/${id}`);
          if (res.status === 404) {
            if (active) callback(null);
            return;
          }
          if (!res.ok) return;
          const data = await res.json();
          if (active) callback(data);
        } catch (e) {
          console.error(`Poll error on doc ${path}/${id}:`, e);
        }
      };
      poll();
      const interval = setInterval(poll, 2500);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const docRef = doc(db, path, id);
    return onSnapshot(docRef, (snapshot) => {
      callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    });
  }
};
