'use client';
import React, { useState, useEffect, useRef } from 'react';
import FreelancerSidebar from '@/components/molecules/FreelancerSidebar';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import { onAuthStateChanged, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import LightningWalletButton from '@/components/organisms/LightningAddressModal';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveMessageTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accountSettings, setAccountSettings] = useState({
    notifications: { email: true, projectUpdates: true },
    privacy: { showProfile: true },
    payment: { lightningAddress: '' },
  });

  // Lightning wallet state
  const [lightningAddress, setLightningAddress] = useState('');
  const [lightningConnectorType, setLightningConnectorType] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadUserSettings(user.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    return () => {
      if (saveMessageTimeout.current) clearTimeout(saveMessageTimeout.current);
    };
  }, []);

  const loadUserSettings = async (uid: string) => {
    try {
      const freelancerSnap = await getDoc(doc(firebaseDb, 'freelancers', uid));
      if (freelancerSnap.exists()) {
        const data = freelancerSnap.data();
        if (data.settings) setAccountSettings(data.settings);
        if (data.lightningAddress) setLightningAddress(data.lightningAddress);
        if (data.lightningConnectorType) setLightningConnectorType(data.lightningConnectorType);
      } else {
        const userDoc = await getDoc(doc(firebaseDb, 'all_users', uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.settings) setAccountSettings(data.settings);
          if (data.lightningAddress) setLightningAddress(data.lightningAddress);
          if (data.lightningConnectorType) setLightningConnectorType(data.lightningConnectorType);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: typeof accountSettings) => {
    if (!currentUser) return false;
    setSaving(true);
    try {
      const updateData = { settings: newSettings, updatedAt: serverTimestamp() };
      await setDoc(doc(firebaseDb, 'all_users', currentUser.uid), updateData, { merge: true });
      await setDoc(doc(firebaseDb, 'freelancers', currentUser.uid), updateData, { merge: true });
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (category: 'notifications' | 'privacy', field: string, value: boolean) => {
    const updatedSettings = {
      ...accountSettings,
      [category]: { ...accountSettings[category as keyof typeof accountSettings], [field]: value },
    };
    setAccountSettings(updatedSettings as any);
    saveSettings(updatedSettings as any);
  };

  const handleLightningModalSave = (address: string, connectorType: string) => {
    setLightningAddress(address);
    setLightningConnectorType(connectorType);
    const updatedSettings = {
      ...accountSettings,
      payment: { ...accountSettings.payment, lightningAddress: address },
    };
    setAccountSettings(updatedSettings);
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordResetEmail(firebaseAuth, currentUser.email);
      setShowSuccessModal(true);
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const confirmDeleteAccount = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    try {
      const uid = user.uid;
      await deleteDoc(doc(firebaseDb, 'all_users', uid));
      await deleteDoc(doc(firebaseDb, 'freelancers', uid));
      await deleteUser(user);
      window.location.href = '/signup';
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert('For your security, please logout and log back in again to confirm account deletion.');
      } else {
        alert('Deletion failed: ' + error.message);
      }
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] font-sans relative">
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-[#e8dfd4]">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">Check Your Email</h3>
            <p className="text-[#646464] text-sm leading-relaxed mb-8">
              A password reset link has been sent to <span className="font-bold text-[#1a1a1a]">{currentUser?.email}</span>.
            </p>
            <button onClick={() => setShowSuccessModal(false)} className="w-full py-4 bg-[#CC7000] text-white font-bold rounded-2xl hover:bg-[#A85C00] transition-all">
              Got it, Thanks!
            </button>
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

      <div className="flex">
        <FreelancerSidebar active="/freelancer/dashboard/settings" />
        <div className="flex-1 lg:ml-0">
          <div className="h-screen overflow-y-auto pt-4 md:pt-0 bg-[#F7F6F3]">
            <div className="max-w-[100%] mx-auto p-6 md:p-12 space-y-8">

              {/* Header */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
                  <p className="text-sm text-gray-600 mt-2">Manage your account preferences, notifications, and privacy settings.</p>
                </div>
                {saving && (
                  <div className="flex items-center gap-2 text-orange-600 text-sm font-medium">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                    Saving...
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* Notifications */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Notification Preferences</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-slate-700">Email notifications</span>
                        <p className="text-xs text-gray-500">Receive email updates about your account and projects</p>
                      </div>
                      <input type="checkbox" checked={accountSettings.notifications.email} onChange={(e) => handleToggle('notifications', 'email', e.target.checked)} className="w-10 h-5 rounded-full appearance-none bg-gray-200 checked:bg-orange-600 relative transition-colors cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:left-5.5 before:transition-all" />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-slate-700">Project updates</span>
                        <p className="text-xs text-gray-500">Get notified about project proposals and messages</p>
                      </div>
                      <input type="checkbox" checked={accountSettings.notifications.projectUpdates} onChange={(e) => handleToggle('notifications', 'projectUpdates', e.target.checked)} className="w-10 h-5 rounded-full appearance-none bg-gray-200 checked:bg-orange-600 relative transition-colors cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:left-5.5 before:transition-all" />
                    </label>
                  </div>
                </div>

                {/* Payment Settings */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Payment Settings</h3>
                  <p className="text-xs text-gray-500 mb-5">
                    Connect your Lightning wallet to receive instant payments when clients approve your work.
                  </p>
                  {currentUser && (
                    <LightningWalletButton
                      uid={currentUser.uid}
                      collection="freelancers"
                      lightningAddress={lightningAddress}
                      lightningConnectorType={lightningConnectorType}
                      onSaved={handleLightningModalSave}
                    />
                  )}
                </div>

                {/* Security */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Account Security</h3>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Change Password</label>
                    <p className="text-xs text-gray-500 mb-3">Update your account password regularly for security</p>
                    <button onClick={handlePasswordReset} className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors">
                      Send Reset Email
                    </button>
                  </div>
                </div>

                {/* Management */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Account Management</h3>
                  <div>
                    <label className="text-sm font-medium text-red-600">Delete Account</label>
                    <p className="text-xs text-gray-500 mb-3">Permanently delete your account and all associated data</p>
                    <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
