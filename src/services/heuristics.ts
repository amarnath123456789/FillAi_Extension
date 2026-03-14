import { UserProfile } from '../types';

export function getHeuristicFill(
  profile: UserProfile,
  context: { label: string; placeholder: string; name: string; id: string }
): string | null {
  const searchStr = `${context.label} ${context.placeholder} ${context.name} ${context.id}`.toLowerCase();
  // Normalise separators so "first_name" and "first-name" both become "first name"
  const s = searchStr.replace(/[_\-./]/g, ' ');

  // Escape any special regex characters inside a keyword string
  const esc = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const has = (keywords: string[]) =>
    keywords.some(k => new RegExp(`\\b${esc(k)}\\b`, 'i').test(s));

  // ── Names ─────────────────────────────────────────────────────────────────
  // Check specific compounds BEFORE the generic "name" fallback
  if (has(['first name', 'given name', 'fname', 'forename', 'first n'])) {
    return profile.fullName ? profile.fullName.trim().split(/\s+/)[0] : null;
  }
  if (has(['last name', 'family name', 'surname', 'lname', 'last n'])) {
    if (!profile.fullName) return null;
    const parts = profile.fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  }
  if (has(['full name', 'fullname', 'legal name', 'your name', 'applicant name', 'candidate name', 'full legal name'])) {
    return profile.fullName || null;
  }

  // ── Contact ──────────────────────────────────────────────────────────────
  if (has(['email address', 'email', 'e-mail', 'e mail', 'mail address', 'contact email', 'work email', 'personal email'])) {
    return profile.email || null;
  }
  if (has(['phone number', 'mobile number', 'contact number', 'cell number', 'phone', 'mobile', 'telephone', 'tel', 'cell', 'whatsapp'])) {
    return profile.phone || null;
  }
  if (has(['street address', 'home address', 'mailing address', 'residential address', 'current address', 'full address', 'address'])) {
    return profile.address || null;
  }
  if (has(['city', 'town', 'zip code', 'postal code', 'postcode', 'location', 'region', 'country', 'state', 'province', 'zip', 'postal'])) {
    return profile.address || null;
  }

  // ── Personal ─────────────────────────────────────────────────────────────
  if (has(['date of birth', 'birth date', 'birthdate', 'dob', 'birthday', 'born on', 'date of birth'])) {
    return profile.dob || null;
  }

  // ── Social / Links ────────────────────────────────────────────────────────
  if (has(['linkedin profile', 'linkedin url', 'linkedin link', 'linkedin', 'linked in'])) {
    return profile.linkedin || null;
  }
  if (has(['github profile', 'github url', 'github link', 'github handle', 'github', 'git hub'])) {
    return profile.github || null;
  }
  if (has(['portfolio url', 'portfolio link', 'online portfolio', 'portfolio website', 'portfolio', 'personal website', 'personal site', 'personal url'])) {
    return profile.portfolio || null;
  }
  // Generic URL — only if nothing above matched
  if (has(['website url', 'web address', 'webpage', 'website'])) {
    return profile.portfolio || null;
  }

  // ── Professional ─────────────────────────────────────────────────────────
  if (has(['current job title', 'current position', 'current title', 'current role', 'job title', 'job role', 'position applying', 'desired position', 'role applying', 'position', 'designation', 'occupation', 'profession'])) {
    return profile.currentRole || null;
  }
  // Years-of-experience: specific compound phrases only to avoid matching essay prompts
  if (has(['years of experience', 'years experience', 'total experience', 'professional experience', 'experience in years', 'yoe', 'work experience years'])) {
    return profile.yearsOfExperience || null;
  }

  // ── Education ─────────────────────────────────────────────────────────────
  // Education before bio so "educational background" hits here, not bio
  if (has(['highest education', 'highest qualification', 'education level', 'academic qualification', 'academic background', 'educational background', 'degree', 'university', 'college', 'school', 'institute', 'alma mater', 'education'])) {
    return profile.education || null;
  }
  if (has(['professional certification', 'certifications', 'certification', 'certificate', 'credential', 'accreditation', 'professional license', 'licenses', 'licence', 'certs'])) {
    return profile.certifications || null;
  }

  // ── Long-form text ────────────────────────────────────────────────────────
  if (has(['professional summary', 'career summary', 'personal statement', 'bio', 'biography', 'about yourself', 'about you', 'tell us about', 'brief introduction', 'summary', 'elevator pitch', 'self description', 'introduce yourself', 'professional background', 'work background'])) {
    return profile.bio || null;
  }
  // Cover letter → use bio as the starting content the LLM will expand upon
  if (has(['cover letter', 'motivation letter', 'letter of motivation', 'letter of interest', 'letter of intent', 'why should we hire', 'why hire you', 'why are you a good fit', 'why do you want'])) {
    return profile.bio || null;
  }
  if (has(['technical skills', 'key skills', 'core skills', 'skill set', 'tech stack', 'technologies used', 'tools and technologies', 'software skills', 'programming languages', 'programming language', 'competencies', 'expertise', 'proficiencies', 'skills'])) {
    return profile.skills || null;
  }
  if (has(['greatest achievement', 'biggest achievement', 'key accomplishment', 'notable work', 'most proud of', 'proud of', 'impact made', 'accomplishment', 'achievement', 'highlight'])) {
    return profile.achievements || null;
  }

  // ── Compensation ──────────────────────────────────────────────────────────
  if (has(['expected salary', 'desired salary', 'salary expectation', 'salary range', 'expected compensation', 'expected ctc', 'desired ctc', 'annual salary', 'salary', 'compensation', 'ctc', 'remuneration', 'pay expectation'])) {
    return profile.otherDetails || null;
  }

  return null;
}
