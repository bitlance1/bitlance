import Header from '@/components/organisms/Header';
import Footer from '@/components/organisms/Footer';
import React from 'react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

export const metadata = {
  title: 'Find Bitcoin Freelancers | Bitlance',
  description: 'Discover skilled Bitcoin-native freelancers for your projects on Bitlance.',
};

async function getInitialFreelancers() {
  try {
    const freelancersSnap = await getDocs(collection(firebaseDb, 'freelancers'));
    const items = await Promise.all(
      freelancersSnap.docs.map(async (docSnap) => {
        const freeData = docSnap.data() as any;
        const uid = docSnap.id;
        let allData: any = {};
        try {
          const allUsersSnap = await getDoc(doc(firebaseDb, 'all_users', uid));
          allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
        } catch {
          allData = {};
        }
        const skills = Array.isArray(freeData.skills) ? freeData.skills.filter(Boolean) : [];
        const fullName =
          freeData.fullName ??
          allData.fullName ??
          `${freeData.firstName ?? allData.firstName ?? ''} ${freeData.lastName ?? allData.lastName ?? ''}`.trim() ??
          'Freelancer';
        return {
          id: uid,
          icon: '',
          title: freeData.title?.trim() || fullName || 'Freelancer',
          fullName,
          description: freeData.bio?.trim() || 'Professional freelancer available for Bitcoin-native work.',
          price: `${freeData.hourlyRate ?? '0'} ${freeData.currency ?? 'SATS'}/hr`,
          tags: skills.slice(0, 3),
          skills,
          profileHref: `/freelancer/public/${uid}`,
          avatarUrl: freeData.avatarUrl ?? allData.avatarUrl ?? '',
        };
      })
    );
    return items;
  } catch (error) {
    console.error('Failed to load freelancers on server:', error);
    return [];
  }
}

import FindFreelancersClient from '@/components/organisms/FindFreelancersClient';

export default async function FindFreelancers() {
  const initialFreelancers = await getInitialFreelancers();
  return (
    <>
      <Header />
      <FindFreelancersClient initialFreelancers={initialFreelancers} />
      <Footer />
    </>
  );
}
