'use client';

import React from 'react';

export default function WhyBitlance() {
  return (
    <section className="bg-[#FAF8F5] py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Dark Container Card */}
        <div className="relative overflow-hidden rounded-[24px] bg-[#1B1C1B] py-8 px-6 sm:py-10 sm:px-10 lg:py-12 lg:px-12 shadow-lg border border-[#2c2d2c]">
          
          {/* Rotated Large Bitcoin Watermark on Right */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.04] text-[#F7931A] pointer-events-none hidden lg:block transform rotate-[15deg]">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.5 8.5h3.5a2.5 2.5 0 0 1 0 5H9.5z" />
              <path d="M9.5 13.5h4.5a2.5 2.5 0 0 1 0 5H9.5z" />
              <path d="M11.5 6v2.5M13.5 6v2.5M11.5 18.5V21M13.5 18.5V21" strokeLinecap="round" />
            </svg>
          </div>

          {/* Header (Left Aligned) */}
          <div className="mb-8 text-left relative z-10">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Built for the Bitcoin Native
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-[#9e9a96]">
              Everything you need to work and get paid in Bitcoin.
            </p>
          </div>

          {/* 6-Features Grid */}
          <div className="grid gap-y-6 gap-x-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 relative z-10 items-start">
            
            {/* Feature 1 */}
            <div className="flex items-start gap-3.5 lg:border-r lg:border-[#2c2d2c] lg:pr-8 py-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5 text-orange-500 flex-shrink-0 mt-0.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">Lightning Payments</h3>
                <p className="mt-1 text-xs text-[#9e9a96] leading-relaxed">
                  Fast and low-fee payments via Lightning Network.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-3.5 lg:border-r lg:border-[#2c2d2c] lg:px-8 py-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5 text-orange-500 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">Global Access</h3>
                <p className="mt-1 text-xs text-[#9e9a96] leading-relaxed">
                  Work with clients and talent from anywhere.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-3.5 lg:pl-8 py-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5 text-orange-500 flex-shrink-0 mt-0.5">
                <path d="M12 3a3 3 0 0 0-3 3c0 2 1.5 3 3 4s3-2 3-4a3 3 0 0 0-3-3z" />
                <path d="M8 10c-3 0-5 2-5 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3c0-4-2-6-5-6H8z" />
              </svg>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">Low Fees</h3>
                <p className="mt-1 text-xs text-[#9e9a96] leading-relaxed">
                  We keep platform fees minimal so you earn more.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start gap-3.5 lg:border-r lg:border-[#2c2d2c] lg:pr-8 py-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5 text-orange-500 flex-shrink-0 mt-0.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 11 11 13 15 9" />
              </svg>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">Escrow Protection</h3>
                <p className="mt-1 text-xs text-[#9e9a96] leading-relaxed">
                  Funds are secured until work is approved.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="flex items-start gap-3.5 lg:border-r lg:border-[#2c2d2c] lg:px-8 py-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5 text-orange-500 flex-shrink-0 mt-0.5">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M17 11V7a5 5 0 0 0-10 0v4" />
              </svg>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">Secure & Private</h3>
                <p className="mt-1 text-xs text-[#9e9a96] leading-relaxed">
                  Your data and payments are always protected.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="flex items-start gap-3.5 lg:pl-8 py-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5 text-orange-500 flex-shrink-0 mt-0.5">
                <path d="M9.5 8.5h3.5a2.5 2.5 0 0 1 0 5H9.5z" />
                <path d="M9.5 13.5h4.5a2.5 2.5 0 0 1 0 5H9.5z" />
                <path d="M12 2v2M14 2v2M12 20v2M14 20v2" />
                <path d="M17 8.5a3.5 3.5 0 0 0-3.5-3.5H8v14h5.5a3.5 3.5 0 0 0 3.5-3.5c0-1.5-.8-2.8-2-3.3 1.2-.5 2-1.8 2-3.7z" />
              </svg>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">Bitcoin Native</h3>
                <p className="mt-1 text-xs text-[#9e9a96] leading-relaxed">
                  Built for Bitcoiners, by Bitcoiners.
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
