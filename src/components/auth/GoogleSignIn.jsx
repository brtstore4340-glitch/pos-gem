import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function GoogleSignIn() {
  const { signInWithGoogle, loginEmail, signupEmail, loginAnonymous } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState('signin'); // signin | signup

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

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!email || !password) {
        setError('กรุณากรอกอีเมลและรหัสผ่าน');
        return;
      }
      const res = mode === 'signup'
        ? await signupEmail({ email, password, displayName })
        : await loginEmail(email, password);
      if (!res?.success) setError(res?.error || 'Login failed');
    } catch (err) {
      setError(err?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await loginAnonymous();
      if (!res?.success) setError(res?.error || 'Guest login failed');
    } catch (err) {
      setError(err?.message || 'Guest login failed');
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

        <div className="mt-6 border-t pt-4 text-left space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{mode === 'signup' ? 'Create account' : 'Email sign-in'}</h2>
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
              type="button"
            >
              {mode === 'signup' ? 'ใช้บัญชีที่มีอยู่' : 'สร้างบัญชีใหม่'}
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="ชื่อที่แสดง (ไม่บังคับ)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading ? 'กำลังดำเนินการ...' : mode === 'signup' ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGuest}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-200 text-slate-700 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าแบบ Guest (ไม่ผูกบัญชี)'}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
