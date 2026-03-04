export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  linkedin: string;
  github: string;
  portfolio: string;
  currentRole: string;
  yearsOfExperience: string;
  education: string;
  certifications: string;
  bio: string;
  skills: string;
  achievements: string;
  otherDetails: string;
}

export const defaultProfile: UserProfile = {
  fullName: '',
  email: '',
  phone: '',
  dob: '',
  address: '',
  linkedin: '',
  github: '',
  portfolio: '',
  currentRole: '',
  yearsOfExperience: '',
  education: '',
  certifications: '',
  bio: '',
  skills: '',
  achievements: '',
  otherDetails: '',
};
