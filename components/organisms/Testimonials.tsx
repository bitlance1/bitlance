'use client';

import React from 'react';

const TESTIMONIALS = [
  {
    quote: '"Bitlance makes it easy to find great talent and pay in Bitcoin. Exactly what we needed!"',
    name: 'Alex M.',
    title: 'CEO, Zap Labs',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120&h=120',
  },
  {
    quote: '"I\'ve earned more in Bitcoin here than on any other platform. Fast payments, low fees."',
    name: 'Victoria L.',
    title: 'Freelance Developer',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120&h=120',
  },
  {
    quote: '"Finally a platform that understands the Bitcoin economy."',
    name: 'James P.',
    title: 'Nostr Tools',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120&h=120',
  },
  {
    quote: '"Simple, secure, and Bitcoin-first. Love using Bitlance."',
    name: 'Samantha K.',
    title: 'Content Writer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120&h=120',
  },
];

export default function Testimonials() {
  return (
    <section className="bg-[#FCF9F7] py-16 border-b border-[#F0EDE8]">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="mb-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a1a1a] tracking-tight">
            Loved by Bitcoiners
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {TESTIMONIALS.map((t, index) => (
            <div 
              key={index}
              className="rounded-[20px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col justify-between min-h-[200px]"
            >
              {/* Quote text */}
              <p className="text-[13px] sm:text-[14px] leading-relaxed text-[#1a1a1a] font-medium mb-6">
                {t.quote}
              </p>

              {/* User profile info row */}
              <div className="flex items-center gap-3 border-t border-[#F4F1EE] pt-4">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                  <img 
                    src={t.avatar} 
                    alt={t.name} 
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-left min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-[#1a1a1a] truncate">{t.name}</h4>
                  <p className="text-[10px] sm:text-xs font-semibold text-[#6b6560] truncate mt-0.5">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
