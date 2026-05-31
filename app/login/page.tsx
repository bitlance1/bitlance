'use client'

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/organisms/Header';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const uid = credential.user.uid;

      const allUsersSnap = await getDoc(doc(firebaseDb, 'all_users', uid));
      let role = allUsersSnap.exists() ? allUsersSnap.data().role : undefined;

      if (!role) {
        const freelancerSnap = await getDoc(doc(firebaseDb, 'freelancers', uid));
        if (freelancerSnap.exists()) role = 'freelancer';
      }

      if (!role) {
        const clientSnap = await getDoc(doc(firebaseDb, 'clients', uid));
        if (clientSnap.exists()) role = 'client';
      }

      if (role === 'admin') {
        router.push('/admin/dashboard');
        return;
      }
      if (role === 'client') {
        router.push('/client/dashboard');
        return;
      }
      if (role === 'freelancer') {
        router.push('/freelancer/dashboard');
        return;
      }

      setErrorMessage('Account role not found. Please contact support.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .font-sora { font-family: 'Sora', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>

      <Header />

      <div className="font-inter bg-gradient-to-br from-[#FCF9F7] to-[#f5ede5] min-h-screen flex items-center justify-center px-4 py-8 pt-24">
        <div className="w-full max-w-[480px]">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-sora text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3">
              Welcome Back
            </h1>
            <p className="text-[#666] text-sm sm:text-base">
              Log in to your Bitlance account and<br className="hidden sm:block" />
              continue earning sats.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 border border-[#f0ebe3]">
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="text-[#999] text-xs font-bold tracking-wider uppercase mb-2 block">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="satoshi@p2pfoundation.org"
                  className="w-full bg-[#f5f0e8] rounded-2xl px-4 py-3 text-[#1a1a1a] placeholder-[#ccc] border border-transparent focus:outline-none focus:border-[#F7931A] transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-[#999] text-xs font-bold tracking-wider uppercase mb-2 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#f5f0e8] rounded-2xl px-4 py-3 text-[#1a1a1a] placeholder-[#ccc] border border-transparent focus:outline-none focus:border-[#F7931A] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#666]"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1 4.24 4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#F7931A] cursor-pointer"
                  />
                  <span className="text-[#666] text-xs font-medium">
                    Remember me
                  </span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[#F7931A] text-xs font-bold hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#8C4F00] to-[#F7931A] text-[#1a1a1a] font-bold py-3 px-6 rounded-full mt-8 hover:from-[#7a4500] hover:to-[#e68815] transition-all shadow-md hover:shadow-lg font-sora text-sm sm:text-base disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing In...' : 'Log In →'}
              </button>
              {errorMessage ? (
                <p className="text-sm text-red-600">{errorMessage}</p>
              ) : null}
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e5ddd0]" />
              <span className="text-[#999] text-xs">OR</span>
              <div className="flex-1 h-px bg-[#e5ddd0]" />
            </div>

            {/* Signup Link */}
            <div className="text-center">
              <p className="text-[#666] text-sm">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="text-[#F7931A] font-bold hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>

          {/* Footer
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-[#999] text-xs">
            <Link href="#" className="hover:text-[#666]">
              NETWORK STATUS
            </Link>
            <div className="hidden sm:block w-px h-3 bg-[#e5ddd0]" />
            <Link href="#" className="hover:text-[#666]">
              PRIVACY POLICY
            </Link>
            <div className="hidden sm:block w-px h-3 bg-[#e5ddd0]" />
            <Link href="#" className="hover:text-[#666]">
              SAFE-FLOW GUIDE
            </Link>
          </div>
          <p className="text-center text-[#ccc] text-[10px] mt-4">
            © 2025 BITLANCE. BUILT FOR THE CIRCULAR BITCOIN ECONOMY.
          </p> */}
        </div>
      </div>
    </>
  );
}
