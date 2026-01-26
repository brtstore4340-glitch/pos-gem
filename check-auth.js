// Run this in browser console to check your auth token
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  user.getIdTokenResult().then((idTokenResult) => {
    console.log('🔐 User ID:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('🎭 Role:', idTokenResult.claims.role);
    console.log('🔑 All Claims:', idTokenResult.claims);
    
    if (!idTokenResult.claims.role) {
      console.warn('⚠️ No role claim found!');
      console.log('User needs admin or SM-SGM role');
    }
  });
} else {
  console.error('❌ No user logged in');
}
