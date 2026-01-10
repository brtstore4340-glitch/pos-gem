import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { app } from "./lib/firebase";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Optional: Force account selection prompt every time
provider.setCustomParameters({
  prompt: "select_account"
});

export async function signInWithGoogle() {
  console.log(" GoogleSignIn: Initiating...");
  
  try {
    if (typeof window !== "undefined") {
      console.log(
        " Before Google sign-in. origin=",
        window.location.origin,
        "href=",
        window.location.href
      );
    }

    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    console.log(" GoogleSignIn: Success", user.displayName);
    return { success: true, data: user, error: null };
    
  } catch (error) {
    console.error("Google sign-in raw errorrror:", error);
    console.error("code:", error?.code, "message:", error?.message, "customData:", error?.customData);
    console.error(" GoogleSignIn: Error Details", {
        code: error.code,
        message: error.message,
        email: error.customData ? error.customData.email : "N/A"
    });

    // specific handling for the internal-error
    if (error.code === 'auth/internal-error') {
        console.warn(" TIP: Go to Firebase Console > Project Settings > General and ensure 'Support Email' is set.");
    }

    return { success: false, data: null, error: error.code + ': ' + error.message };
  }
}


