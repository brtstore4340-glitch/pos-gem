import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const createUserProfile = async (uid, profileData) => {
  const userRef = doc(db, 'users', uid);
  
  await setDoc(userRef, {
    uid,
    email: profileData.email,
    username: profileData.username,
    role: profileData.role,
    allowedMenus: profileData.allowedMenus || [],
    createdByUid: profileData.createdByUid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const getUserProfile = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return null;
  }
  
  return userSnap.data();
};

export const updateUserProfile = async (uid, updates) => {
  const userRef = doc(db, 'users', uid);
  
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const createUsernameMapping = async (usernameLower, uid, email) => {
  const usernameRef = doc(db, 'usernames', usernameLower);
  
  await setDoc(usernameRef, {
    uid,
    email,
    createdAt: serverTimestamp()
  });
};

export const getUserByUsername = async (usernameLower) => {
  const usernameRef = doc(db, 'usernames', usernameLower);
  const usernameSnap = await getDoc(usernameRef);
  
  if (!usernameSnap.exists()) {
    return null;
  }
  
  return usernameSnap.data();
};

export const getAllUsers = async () => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  
  return snapshot.docs.map(doc => doc.data());
};

export const getUsersCreatedBy = async (creatorUid) => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('createdByUid', '==', creatorUid));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
};

export const deleteUser = async (uid, username) => {
  const userRef = doc(db, 'users', uid);
  const usernameRef = doc(db, 'usernames', username.toLowerCase());
  
  await deleteDoc(userRef);
  await deleteDoc(usernameRef);
};