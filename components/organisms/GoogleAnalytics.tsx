"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const [showBanner, setShowBanner] = useState(false);

  // Initialize consent state and check user preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const consent = localStorage.getItem("bitlance_cookie_consent");
      if (!consent) {
        setShowBanner(true);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    if (!gaId || !pathname) return;

    // Don't send page view on "/about" or its subpages
    if (pathname === "/about" || pathname.startsWith("/about/")) {
      return;
    }

    if (typeof (window as any).gtag === "function") {
      (window as any).gtag("config", gaId, {
        page_path: pathname,
      });
    }
  }, [pathname, gaId]);

  const handleConsent = (status: "granted" | "denied") => {
    try {
      localStorage.setItem("bitlance_cookie_consent", status);
    } catch (e) {
      console.warn("Storage access failed for cookie consent", e);
    }
    setShowBanner(false);

    if (typeof (window as any).gtag === "function") {
      (window as any).gtag("consent", "update", {
        ad_storage: status,
        ad_user_data: status,
        ad_personalization: status,
        analytics_storage: status,
      });
    }
  };

  if (!gaId) return null;

  return (
    <>
      {/* Google Consent Mode v2 Default Settings */}
      <Script id="google-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          
          let savedConsent = 'denied';
          try {
            savedConsent = localStorage.getItem('bitlance_cookie_consent') || 'denied';
          } catch(e) {}
          
          gtag('consent', 'default', {
            'ad_storage': savedConsent,
            'ad_user_data': savedConsent,
            'ad_personalization': savedConsent,
            'analytics_storage': savedConsent
          });
        `}
      </Script>

      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          
          gtag('config', '${gaId}', {
            send_page_view: false
          });
        `}
      </Script>

      {/* Slide-in Cookie Consent Banner */}
      {showBanner && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-md z-[99999] bg-[#FAF8F5] border border-[#EAE7E2] rounded-3xl p-6 shadow-2xl transition-all duration-300">
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="text-sm font-black text-[#1a1a1a] tracking-tight">Cookie Consent</h4>
              <p className="mt-1 text-xs text-[#6b6762] leading-relaxed">
                We use cookies to analyze web traffic and customize your experience. For compliance with EEA regulations, please confirm if you consent to cookies for analytics and ads personalization.
              </p>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => handleConsent("denied")}
                className="px-4 py-2 text-xs font-bold text-[#6b6762] hover:text-[#1a1a1a] transition-colors rounded-xl border border-[#EAE7E2] bg-white cursor-pointer"
              >
                Decline
              </button>
              <button
                onClick={() => handleConsent("granted")}
                className="px-4 py-2 text-xs font-black text-white bg-[#F7931A] hover:bg-[#e07f0f] transition-colors rounded-xl shadow-sm cursor-pointer"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
