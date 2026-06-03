// 'use client';

// import { useState, useEffect } from 'react';
// import Logo from '../atoms/Logo';
// import NavMenu from '../molecules/NavMenu';
// import Button from '../atoms/Button';
// import NavLink from '../atoms/NavLink';

// const NAV_ITEMS = [
//   { label: 'Home', href: '/' },
//   { label: 'Category', href: '/category' },
//   { label: 'How It Works', href: '/how-it-works' },
//   { label: 'About', href: '/about' },
// ];

// export default function Header() {
//   const [isMenuOpen, setIsMenuOpen] = useState(false);

//   // Close menu on resize to prevent layout issues if switching from mobile to desktop
//   useEffect(() => {
//     const handleResize = () => {
//       if (window.innerWidth >= 768) setIsMenuOpen(false);
//     };
//     window.addEventListener('resize', handleResize);
//     return () => window.removeEventListener('resize', handleResize);
//   }, []);

//   // Prevent scrolling when menu is open
//   useEffect(() => {
//     if (isMenuOpen) {
//       document.body.style.overflow = 'hidden';
//     } else {
//       document.body.style.overflow = 'unset';
//     }
//   }, [isMenuOpen]);

//   return (
//     <>
//       <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
//         <div className="flex items-center justify-center w-full max-w-7xl h-16 px-8 bg-[#E5E2E0] backdrop-blur-md rounded-full border border-zinc-200/50 shadow-[0_4px_12px_rgb(0_0_0_/_0.05)]">
//           <div className="flex items-center justify-between w-[95%]">
//             {/* Left: Logo */}
//             <div className="flex-shrink-0">
//               <Logo />
//             </div>

//             {/* Center: Desktop Navigation (Hidden on Mobile) */}
//             <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
//               <NavMenu />
//             </div>

//             {/* Right: Actions (Hamburger + Auth) */}
//             <div className="flex items-center gap-2 sm:gap-4">
//               {/* Mobile Menu Toggle (Before Login) */}
//               <button
//                 onClick={() => setIsMenuOpen(true)}
//                 className="flex md:hidden items-center justify-center w-9 h-9 rounded-full bg-zinc-200/50 text-zinc-600 hover:text-[#F7931A] transition-colors"
//                 aria-label="Open menu"
//               >
//                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                   <line x1="3" y1="12" x2="21" y2="12" />
//                   <line x1="3" y1="6" x2="21" y2="6" />
//                   <line x1="3" y1="18" x2="21" y2="18" />
//                 </svg>
//               </button>

//               <Button
//                 variant="ghost"
//                 className="text-sm font-medium hover:bg-transparent hover:text-[#F7931A]"
//                 href="/login"
//               >
//                 Login
//               </Button>
//               <Button
//                 variant="ghost"
//                 className="rounded-full bg-[#F7931A] hover:bg-[#F7931A] px-6 py-2 w-[80px] shadow-sm font-medium text-white"
//                 href="/register"
//               >
//                 Sign Up
//               </Button>
//             </div>
//           </div>
//         </div>
//       </header>


//     </>
//   );
// }



'use client';

import { useState, useEffect } from 'react';
import Logo from '../atoms/Logo';
import NavMenu from '../molecules/NavMenu';
import Button from '../atoms/Button';
import Image from 'next/image';
const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Find Work', href: '/findwork' },
  { label: 'Find Freelancers', href: '/find-freelancers' },
  // { label: 'About', href: '/about' },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeItem, setActiveItem] = useState('/');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMenuOpen]);

  return (
    <>
      {/* ── Desktop / Shared Header Bar ── */}
      <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
        <div className="flex items-center justify-center w-full max-w-7xl h-16 px-8 bg-[#E5E2E0] backdrop-blur-md rounded-full border border-zinc-200/50 shadow-[0_4px_12px_rgb(0_0_0_/_0.05)]">
          <div className="flex items-center justify-between w-[95%]">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Logo />
            </div>

            {/* Center: Desktop Nav */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
              <NavMenu />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Hamburger */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="flex md:hidden items-center justify-center w-9 h-9 rounded-full bg-zinc-200/50 text-zinc-600 hover:text-[#F7931A] transition-colors"
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              <Button
                variant="ghost"
                className="hidden sm:inline-flex text-sm font-medium hover:bg-transparent hover:text-[#F7931A]"
                href="/login"
              >
                Login
              </Button>
              <Button
                variant="ghost"
                className="hidden sm:inline-flex rounded-full bg-[#F7931A] px-6 py-2 shadow-sm font-medium text-white"
                href="/signup"
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Sidebar ── */}
      {mounted && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsMenuOpen(false)}
            className={`
              fixed inset-0 z-[60] md:hidden
              bg-black/50 backdrop-blur-[2px]
              transition-opacity duration-300  
              ${isMenuOpen ? 'opacity-100 pointer-events-auto  ' : 'opacity-0 pointer-events-none'}
            `}
          />

          {/* Sidebar */}
          <div
            className={`
              fixed top-0 right-0 z-[70] h-full w-[300px] md:hidden
              flex flex-col
              bg-[#F2F0EE]
              shadow-[-20px_0_60px_rgba(0,0,0,0.13)]
              transition-transform duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)]
              ${isMenuOpen ? 'translate-x-0 ' : 'translate-x-full'}
            `}
          >
            {/* ── Header ── */}
            <div className='flex justify-center h-[60px]'>
              <div className="flex items-center justify-between px-6 pt-10 pb-7  w-[95%] ">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 overflow-hidden rounded-xl bg-[#F7931A] flex items-center justify-center shadow-md shadow-orange-200/60 flex-shrink-0">
                    <Image
                      src="/assets/logo.png"
                      alt="Bitlance Logo"
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold tracking-tight text-zinc-800 leading-none">Bitlance</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-all duration-200 flex-shrink-0"
                  aria-label="Close menu"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div></div>

            {/* ── Section Label ──
            <div className="px-6 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Menu</p>
            </div> */}

            {/* ── Nav Items ── */}
            <nav className="flex flex-col px-3 pt-3 gap-1">
              {NAV_ITEMS.map((item, i) => {
                const isActive = activeItem === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => { setActiveItem(item.href); setIsMenuOpen(false); }}
                    className={`
                      group flex items-center gap-3 px-3 py-2 rounded-xl
                      transition-all duration-200 cursor-pointer
                      ${isActive
                        ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-[#F7931A]'
                        : 'text-zinc-600 hover:bg-white/80 hover:text-zinc-900 hover:shadow-[0_2px_6px_rgba(0,0,0,0.04)]'
                      }
                    `}
                    style={{
                      transform: isMenuOpen ? 'translateX(0)' : 'translateX(28px)',
                      opacity: isMenuOpen ? 1 : 0,
                      transition: `
                        transform 360ms cubic-bezier(0.32,0.72,0,1) ${i * 55 + 80}ms,
                        opacity 300ms ease ${i * 55 + 80}ms,
                        background-color 200ms,
                        color 200ms,
                        box-shadow 200ms
                      `,
                    }}
                  >
                    {/* Label */}
                    <span className="flex-1 text-[14.5px] font-medium">{item.label}</span>

                    {/* Trailing */}

                  </a>
                );
              })}
            </nav>

            {/* ── Spacer pushes footer down ── */}
            <div className="flex-1" />

            {/* Mobile Auth (max-sm) */}
            <div className="px-4 pb-6 sm:hidden">
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  className="w-full justify-center text-sm font-medium hover:bg-white hover:text-[#F7931A] border border-zinc-200"
                  href="/login"
                >
                  Login
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-center rounded-full bg-[#F7931A] hover:bg-[#F7931A] px-6 py-2 shadow-sm font-medium text-white"
                  href="/register"
                >
                  Sign Up
                </Button>
              </div>
            </div>

          </div>
        </>
      )}
    </>
  );
}
