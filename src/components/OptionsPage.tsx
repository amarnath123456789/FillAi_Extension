import React, { useState, useEffect } from 'react';
import { useProfile } from '../store';
import { Save, CheckCircle2 } from 'lucide-react';

export function OptionsPage() {
  const { profile, setProfile } = useProfile();
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col glass-card">
      <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Profile Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Your data is stored locally.</p>
        </div>
        <button
          onClick={handleSave}
          className="purple-btn px-4 py-2 flex items-center gap-2 font-medium text-sm"
        >
          {isSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {isSaved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="space-y-8">
          {/* Basic Info */}
          <section>
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">Basic Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                <input type="text" name="fullName" value={profile.fullName} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input type="email" name="email" value={profile.email} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input type="tel" name="phone" value={profile.phone} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date of Birth</label>
                  <input type="date" name="dob" value={profile.dob} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm text-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Location / Address</label>
                  <input type="text" name="address" value={profile.address} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="San Francisco, CA" />
                </div>
              </div>
            </div>
          </section>

          {/* Professional Details */}
          <section>
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">Professional Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Current Role</label>
                  <input type="text" name="currentRole" value={profile.currentRole} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="Senior Frontend Engineer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Years of Experience</label>
                  <input type="text" name="yearsOfExperience" value={profile.yearsOfExperience} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="5 years" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Highest Education</label>
                <input type="text" name="education" value={profile.education} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="B.S. Computer Science, University of Tech (2018)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Certifications</label>
                <input type="text" name="certifications" value={profile.certifications} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="AWS Certified Solutions Architect, Certified Scrum Master" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Skills (comma separated)</label>
                <input type="text" name="skills" value={profile.skills} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="React, TypeScript, Node.js, Tailwind CSS" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Bio / Summary</label>
                <textarea name="bio" value={profile.bio} onChange={handleChange} rows={3} className="w-full p-2.5 rounded-lg dark-input text-sm resize-none" placeholder="Passionate frontend developer with a focus on building accessible and performant web applications..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Key Achievements</label>
                <textarea name="achievements" value={profile.achievements} onChange={handleChange} rows={3} className="w-full p-2.5 rounded-lg dark-input text-sm resize-none" placeholder="- Led the migration of a legacy monolithic app to micro-frontends...&#10;- Improved core web vitals by 40%..." />
              </div>
            </div>
          </section>

          {/* Links */}
          <section>
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">Links & Profiles</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">LinkedIn URL</label>
                <input type="url" name="linkedin" value={profile.linkedin} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="https://linkedin.com/in/johndoe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">GitHub URL</label>
                <input type="url" name="github" value={profile.github} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="https://github.com/johndoe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Portfolio / Website</label>
                <input type="url" name="portfolio" value={profile.portfolio} onChange={handleChange} className="w-full p-2.5 rounded-lg dark-input text-sm" placeholder="https://johndoe.com" />
              </div>
            </div>
          </section>
          
          <div className="pb-8"></div>
        </div>
      </div>
    </div>
  );
}
