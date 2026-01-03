import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function GoogleSignIn() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    console.log('🔍 GoogleSignIn: Button clicked');
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await signInWithGoogle();
      console.log('🔍 GoogleSignIn: Result from signInWithGoogle:', result);
      
      if (!result.success) {
        setError(result.error || 'Failed to sign in');
      }
    } catch (err) {
      console.error('🔍 GoogleSignIn: Caught error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-slate-200 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Sign in</h1>
        <p className="text-slate-500 mt-2">Use your Google account to continue</p>
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="mt-6 w-full rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Signing in...</span>
            </>
          ) : (
            'Sign in with Google'
          )}
        </button>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
