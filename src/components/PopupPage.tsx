import React from 'react';
import { useProfile } from '../store';
import { Settings, Sparkles, User } from 'lucide-react';

export function PopupPage({ onOptionsClick }: { onOptionsClick: () => void }) {
  const { profile } = useProfile();

  const isProfileEmpty = !profile.fullName && !profile.bio && !profile.skills;

  return (
    <div className="w-[360px] glass-card p-6 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20">
            <Sparkles size={16} className="text-purple-400" />
          </div>
          <h1 className="font-semibold text-lg text-white">QuickFill</h1>
        </div>
        <button onClick={onOptionsClick} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white" title="Options">
          <Settings size={18} />
        </button>
      </div>
      
      <div className="w-full flex-1">
        {isProfileEmpty ? (
          <div className="text-center py-8">
            <div className="bg-white/5 border border-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <User size={28} />
            </div>
            <h3 className="font-medium text-white mb-2 text-lg">Profile Empty</h3>
            <p className="text-sm text-gray-400 mb-6">Set up your profile to start auto-filling forms.</p>
            <button onClick={onOptionsClick} className="w-full purple-btn py-3 font-medium flex items-center justify-center gap-2">
              Setup Profile
            </button>
          </div>
        ) : (
          <div className="w-full">
            <div className="bg-[#141414] border border-white/5 rounded-xl p-4 mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Current Profile</h3>
              <div className="space-y-4">
                {profile.fullName && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Name</span>
                    <span className="text-gray-200 font-medium truncate max-w-[180px]">{profile.fullName}</span>
                  </div>
                )}
                {profile.currentRole && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Role</span>
                    <span className="text-gray-200 font-medium truncate max-w-[180px]">{profile.currentRole}</span>
                  </div>
                )}
                {profile.email && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-200 font-medium truncate max-w-[180px]">{profile.email}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 flex items-start gap-3">
              <Sparkles size={18} className="text-purple-400 mt-0.5 shrink-0" />
              <p className="text-sm text-purple-200/80 leading-relaxed">
                QuickFill is active. Click the ✨ icon next to form fields on any webpage to auto-fill them.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
