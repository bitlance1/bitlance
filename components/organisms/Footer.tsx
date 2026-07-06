'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseDb } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Footer() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      triggerToast('Please enter a valid email address.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(firebaseDb, 'newsletter_subscribers'), {
        email: email.trim().toLowerCase(),
        createdAt: serverTimestamp(),
      });
      setIsSubscribed(true);
      setEmail('');
      triggerToast('Successfully subscribed to the newsletter!', 'success');
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
      triggerToast('Failed to subscribe. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#FCF9F7] py-16 border-t border-[#F0EDE8] text-[#1a1a1a] relative z-10">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        
        {/* Main Footer Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start mb-12">
          
          {/* Column 1: Brand details & Social links */}
          <div className="lg:col-span-3">
            <div 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 mb-4 cursor-pointer"
            >
              <div className="h-7 w-7 rounded-lg bg-[#F7931A] flex items-center justify-center font-black text-white text-sm shadow-sm">
                B
              </div>
              <span className="text-lg font-extrabold text-[#1a1a1a] tracking-tight">Bitlance</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-[#6b6560] mb-6">
              The simplest freelance platform for the Bitcoin economy.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-4 text-[#9e9690]">
              {/* Twitter / X */}
              <a href="https://x.com/bitlancework" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="hover:text-[#F7931A] transition-colors">
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com/bitlance1" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-[#F7931A] transition-colors">
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                </svg>
              </a>
              {/* Telegram */}
              <a href="https://t.me/+ITw8yz1xJIhjNWE0" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="hover:text-[#F7931A] transition-colors">
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.52 3.64-.52.36-.99.53-1.4.52-.46-.01-1.34-.26-2-.47-.8-.26-1.43-.4-1.38-.85.03-.24.36-.48.99-.72 3.87-1.68 6.46-2.79 7.77-3.32 3.69-1.5 4.46-1.76 4.96-1.77.11 0 .36.03.52.16.14.12.18.28.19.4z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Platform Links */}
          <div className="lg:col-span-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#1a1a1a] mb-4 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-xs sm:text-sm font-semibold text-[#6b6560]">
              <li><a onClick={() => router.push('/freelancer/dashboard/job-feed')} className="hover:text-[#F7931A] transition-colors cursor-pointer">Find Work</a></li>
              <li><a onClick={() => router.push('/find-freelancers')} className="hover:text-[#F7931A] transition-colors cursor-pointer">Find Freelancers</a></li>
              <li><a onClick={() => router.push('/signup?type=hire')} className="hover:text-[#F7931A] transition-colors cursor-pointer">Post a Job</a></li>
            </ul>
          </div>

          {/* Column 3: Resources Links */}
          <div className="lg:col-span-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#1a1a1a] mb-4 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2 text-xs sm:text-sm font-semibold text-[#6b6560]">
              <li><a onClick={() => router.push('/help')} className="hover:text-[#F7931A] transition-colors cursor-pointer">Help Center</a></li>
              {/* 
              <li><a href="#" className="hover:text-[#F7931A] transition-colors cursor-pointer">Blog</a></li>
              <li><a href="#" className="hover:text-[#F7931A] transition-colors cursor-pointer">Guides</a></li>
              <li><a href="#" className="hover:text-[#F7931A] transition-colors cursor-pointer">Community</a></li>
              <li><a href="#" className="hover:text-[#F7931A] transition-colors cursor-pointer">Developers</a></li>
              */}
            </ul>
          </div>

          {/* Column 4: Company Links */}
          <div className="lg:col-span-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#1a1a1a] mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-xs sm:text-sm font-semibold text-[#6b6560]">
              <li><a onClick={() => router.push('/about')} className="hover:text-[#F7931A] transition-colors cursor-pointer">About Us</a></li>
              <li><a href="#" className="hover:text-[#F7931A] transition-colors cursor-pointer">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#F7931A] transition-colors cursor-pointer">Terms of Service</a></li>
            </ul>
          </div>

          {/* Column 5: Newsletter Card */}
          <div className="rounded-[20px] bg-[#FAF8F5] p-5 border border-[#EAE7E2] shadow-[0_8px_30px_rgb(0,0,0,0.01)] lg:col-span-3 w-full">
            <h4 className="text-sm font-bold text-[#1a1a1a] mb-1.5">Subscribe to our newsletter</h4>
            <p className="text-[11px] leading-relaxed text-[#6b6560] mb-4">
              Get the latest updates and Bitcoin job opportunities.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2 w-full">
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || isSubscribed}
                className="flex-1 min-w-0 bg-white rounded-xl border border-[#EAE7E2] px-3.5 py-2 text-xs focus:outline-none focus:border-[#F7931A] text-[#1a1a1a] font-medium disabled:opacity-60" 
                required
              />
              <button 
                type="submit"
                disabled={isSubmitting || isSubscribed}
                className="bg-[#F7931A] hover:bg-[#e07f0f] text-white px-3.5 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm shrink-0 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubscribed ? 'Subscribed!' : isSubmitting ? 'Sending...' : 'Subscribe'}
              </button>
            </form>
          </div>

        </div>

        {/* Bottom copyright & attribution row */}
        <div className="border-t border-[#F0EDE8] pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-[#9e9690] font-semibold gap-3">
          <span>© 2026 Bitlance. All rights reserved.</span>
          <span>Made with ❤️ for the Bitcoin community.</span>
        </div>

        {/* Floating Toast Notification */}
        {toast.show && (
          <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3 rounded-2xl border border-[#EAE7E2] bg-[#1B1C1B] px-5 py-3.5 shadow-2xl animate-fade-in duration-300">
            <div className="flex-shrink-0">
              {toast.type === 'success' ? (
                <div className="h-5 w-5 rounded-full bg-[#F7931A] flex items-center justify-center text-white text-[10px] font-black">
                  ✔
                </div>
              ) : (
                <div className="h-5 w-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-black">
                  ✖
                </div>
              )}
            </div>
            <span className="text-xs font-bold text-white tracking-wide">{toast.message}</span>
          </div>
        )}

      </div>
    </footer>
  );
}