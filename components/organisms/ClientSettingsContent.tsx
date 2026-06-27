"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/atoms/Button";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import LightningWalletButton from "@/components/organisms/LightningAddressModal";
import { useRouter } from "next/navigation";

export default function ClientSettingsContent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isResetSending, setIsResetSending] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToast, setShowToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({
    show: false, message: "", type: "success",
  });

  const [settings, setSettings] = useState({
    companyName: "",
    billingEmail: "",
    timezone: "UTC+0",
    emailNotifications: true,
    projectUpdates: true,
    showProfile: true,
  });

  const [lightningAddress, setLightningAddress] = useState("");
  const [lightningConnectorType, setLightningConnectorType] = useState("");
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setShowToast({ show: true, message, type });
    setTimeout(() => setShowToast({ show: false, message: "", type: "success" }), 3000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setCurrentUid(user.uid);
        try {
          const clientSnap = await getDoc(doc(firebaseDb, "clients", user.uid));
          if (clientSnap.exists()) {
            const data = clientSnap.data();
            setSettings({
              companyName: data.companyName || "",
              billingEmail: data.billingEmail || user.email || "",
              timezone: data.timezone || "UTC+0",
              emailNotifications: data.emailNotifications ?? true,
              projectUpdates: data.projectUpdates ?? true,
              showProfile: data.showProfile ?? true,
            });
            if (data.lightningAddress) setLightningAddress(data.lightningAddress);
            if (data.lightningConnectorType) setLightningConnectorType(data.lightningConnectorType);
          }
        } catch (error) {
          console.error("Error fetching settings:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const autoSave = useCallback(async (newSettings: typeof settings) => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(firebaseDb, "clients", user.uid), {
        ...newSettings,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, []);

  const handleSettingChange = (field: keyof typeof settings, value: any) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    autoSave(updated);
  };

  const handleWalletSaved = (address: string, connectorType: string) => {
    setLightningAddress(address);
    setLightningConnectorType(connectorType);
    triggerToast("Lightning wallet connected!");
  };

  const handlePasswordReset = async () => {
    const user = firebaseAuth.currentUser;
    if (!user || !user.email) return;
    setIsResetSending(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, user.email);
      triggerToast("Password reset email sent!");
    } catch {
      triggerToast("Failed to send reset email.", "error");
    } finally {
      setIsResetSending(false);
    }
  };

  const confirmDeleteAccount = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    try {
      const uid = user.uid;
      await deleteDoc(doc(firebaseDb, "all_users", uid));
      await deleteDoc(doc(firebaseDb, "clients", uid));
      await deleteUser(user);
      window.location.href = '/signup';
    } catch (error: any) {
      if (error.code === "auth/requires-recent-login") {
        alert("For your security, please logout and log back in again to confirm account deletion.");
      } else {
        alert("Deletion failed: " + error.message);
      }
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[12px] border border-[#EAE7E2] bg-white text-[12px] text-[#6b6762]">
        Loading your preferences...
      </div>
    );
  }

  return (
    <section className="w-full space-y-6 pb-20">
      {/* Header */}
      <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">Account Settings</div>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">Workspace preferences</h1>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">Changes are saved automatically as you type.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-save active
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Organization details */}
          <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">Organization Details</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.14em] text-[#9e9690]">Company Name</label>
                <input value={settings.companyName} onChange={(e) => handleSettingChange("companyName", e.target.value)} placeholder="Atlas Ventures" className="rounded-lg border border-[#EAE7E2] px-3 py-2.5 text-[12px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.14em] text-[#9e9690]">Billing Email</label>
                <input value={settings.billingEmail} onChange={(e) => handleSettingChange("billingEmail", e.target.value)} placeholder="finance@company.com" className="rounded-lg border border-[#EAE7E2] px-3 py-2.5 text-[12px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.14em] text-[#9e9690]">Timezone</label>
                <select value={settings.timezone} onChange={(e) => handleSettingChange("timezone", e.target.value)} className="rounded-lg border border-[#EAE7E2] px-3 py-2.5 text-[12px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="UTC-5">UTC-5 (EST)</option>
                  <option value="UTC+0">UTC+0 (GMT)</option>
                  <option value="UTC+1">UTC+1 (CET)</option>
                  <option value="UTC+8">UTC+8 (SGT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment Settings */}
          <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">Payment Settings</div>
            <p className="text-[12px] text-[#6b6762] mb-4">
              Connect a Lightning wallet to send instant Bitcoin payments to freelancers.
            </p>
            {currentUid && (
              <LightningWalletButton
                uid={currentUid}
                collection="clients"
                lightningAddress={lightningAddress}
                lightningConnectorType={lightningConnectorType}
                onSaved={handleWalletSaved}
              />
            )}
          </div>

          {/* Preferences */}
          <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">Notification Preferences</div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-[#1a1a1a]">Email notifications</div>
                  <div className="text-[11px] text-[#6b6762]">Receive email updates about your account and projects.</div>
                </div>
                <Toggle enabled={settings.emailNotifications} onChange={(val) => handleSettingChange("emailNotifications", val)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-[#1a1a1a]">Project updates</div>
                  <div className="text-[11px] text-[#6b6762]">Get notified about project proposals and messages.</div>
                </div>
                <Toggle enabled={settings.projectUpdates} onChange={(val) => handleSettingChange("projectUpdates", val)} />
              </div>
            </div>
            <div className="my-6 border-t border-[#F1F0EE]" />
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">Privacy Settings</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[#1a1a1a]">Show profile to freelancers</div>
                <div className="text-[11px] text-[#6b6762]">Allow potential candidates to view your company profile and mission.</div>
              </div>
              <Toggle enabled={settings.showProfile} onChange={(val) => handleSettingChange("showProfile", val)} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Security */}
          <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8C4F00]">Account Security</div>
            <h3 className="text-[13px] font-semibold text-[#1a1a1a]">Change Password</h3>
            <p className="mt-1 text-[11px] leading-[1.6] text-[#6b6762]">Update your password regularly for security. We will send a reset link to your email.</p>
            <Button size="sm" variant="outline" className="mt-4 w-full rounded-full" onClick={handlePasswordReset} disabled={isResetSending}>
              {isResetSending ? "Sending..." : "Send Reset Email"}
            </Button>
          </div>

          {/* Account Management */}
          <div className="rounded-[12px] border border-red-100 bg-red-50/30 p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-600">Account Management</div>
            <h3 className="text-[13px] font-semibold text-[#1a1a1a]">Delete Account</h3>
            <p className="mt-1 text-[11px] leading-[1.6] text-[#6b6762]">Permanently delete your account and all associated data. This action is irreversible.</p>
            <Button
              size="sm"
              className="mt-4 w-full rounded-full bg-red-600 text-white hover:bg-red-700 shadow-sm border-0"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast.show && (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-3 rounded-full border px-6 py-3 shadow-2xl ${showToast.type === "success" ? "bg-[#1a1a1a] border-[#333]" : "bg-red-600 border-red-500"}`}>
            {showToast.type === "success" && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
            <span className="text-[13px] font-medium text-white">{showToast.message}</span>
          </div>
        </div>
      )}
      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-[#e8dfd4]">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">Delete Account?</h3>
            <p className="text-[#646464] text-sm leading-relaxed mb-8">
              This action is <span className="text-red-600 font-bold uppercase">permanent</span> and cannot be undone.
            </p>
            <div className="space-y-3">
              <button onClick={confirmDeleteAccount} className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all">
                Yes, Delete Permanently
              </button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all">
                No, Keep My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-orange-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
    </label>
  );
}
