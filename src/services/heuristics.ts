import { UserProfile } from '../types';

export function getHeuristicFill(
  profile: UserProfile,
  context: { label: string; placeholder: string; name: string; id: string }
): string | null {
  const searchStr = `${context.label} ${context.placeholder} ${context.name} ${context.id}`.toLowerCase();

  // Use word boundaries (\b) to prevent partial matches like "tel" in "tell"
  // Also replace underscores/hyphens with spaces in search string for better matching
  const normalizedSearchStr = searchStr.replace(/[_-]/g, ' ');

  const hasKeyword = (keywords: string[]) => {
    return keywords.some(k => {
      const regex = new RegExp(`\\b${k}\\b`, 'i');
      return regex.test(normalizedSearchStr);
    });
  };

  if (hasKeyword(['first name', 'fname', 'given name'])) {
    return profile.fullName ? profile.fullName.split(' ')[0] : null;
  }
  if (hasKeyword(['last name', 'lname', 'surname', 'family name'])) {
    if (!profile.fullName) return null;
    const parts = profile.fullName.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : profile.fullName;
  }
  if (hasKeyword(['full name', 'fullname', 'name'])) {
    return profile.fullName || null;
  }
  if (hasKeyword(['email', 'e mail', 'mail address', 'email address'])) {
    return profile.email || null;
  }
  if (hasKeyword(['phone', 'mobile', 'tel', 'telephone', 'cell', 'phone number'])) {
    return profile.phone || null;
  }
  if (hasKeyword(['dob', 'date of birth', 'birth date', 'birthdate'])) {
    return profile.dob || null;
  }
  if (hasKeyword(['address', 'location', 'city', 'zip', 'postal', 'street address'])) {
    return profile.address || null;
  }
  if (hasKeyword(['linkedin', 'linked in'])) {
    return profile.linkedin || null;
  }
  if (hasKeyword(['github', 'git hub'])) {
    return profile.github || null;
  }
  if (hasKeyword(['portfolio', 'website', 'url', 'link', 'personal website'])) {
    return profile.portfolio || null;
  }
  if (hasKeyword(['role', 'title', 'position', 'current role', 'job title'])) {
    return profile.currentRole || null;
  }
  if (hasKeyword(['experience', 'yoe', 'years of experience'])) {
    return profile.yearsOfExperience || null;
  }
  if (hasKeyword(['education', 'degree', 'university', 'college', 'school'])) {
    return profile.education || null;
  }
  if (hasKeyword(['certification', 'certifications', 'certificate', 'certs'])) {
    return profile.certifications || null;
  }

  return null;
}
