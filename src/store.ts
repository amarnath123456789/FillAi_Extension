import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, defaultProfile } from './types';

// True when running as a real Chrome extension (not the Vite dev app)
const isExt: boolean = typeof chrome !== 'undefined' && !!chrome?.storage?.local;

interface ProfileContextValue {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function loadFromLocalStorage(): UserProfile {
  try {
    const saved = localStorage.getItem('quickfill_profile');
    if (saved) return { ...defaultProfile, ...JSON.parse(saved) };
  } catch {
    localStorage.removeItem('quickfill_profile');
  }
  return defaultProfile;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  // Dev: load synchronously (no flash). Extension: start with defaults, load async.
  const [profile, setProfile] = useState<UserProfile>(() =>
    isExt ? defaultProfile : loadFromLocalStorage()
  );
  const [isLoading, setIsLoading] = useState(isExt);

  // Extension: async load on mount
  useEffect(() => {
    if (!isExt) return;
    chrome.storage.local.get('quickfill_profile')
      .then((result) => {
        if (result.quickfill_profile) {
          setProfile({ ...defaultProfile, ...result.quickfill_profile });
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setIsLoading(false));
  }, []);

  // Persist on every change (skip during the initial async load)
  useEffect(() => {
    if (isLoading) return;
    if (isExt) {
      chrome.storage.local.set({ quickfill_profile: profile });
    } else {
      try {
        localStorage.setItem('quickfill_profile', JSON.stringify(profile));
      } catch { /* storage full */ }
    }
  }, [profile, isLoading]);

  return React.createElement(
    ProfileContext.Provider,
    { value: { profile, setProfile, isLoading } },
    children
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
