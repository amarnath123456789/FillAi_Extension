import { useState, useEffect } from 'react';
import { UserProfile, defaultProfile } from './types';

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('quickfill_profile');
    return saved ? JSON.parse(saved) : defaultProfile;
  });

  useEffect(() => {
    localStorage.setItem('quickfill_profile', JSON.stringify(profile));
  }, [profile]);

  return { profile, setProfile };
}
