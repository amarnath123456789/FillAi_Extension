export type FieldType =
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'dob'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'job_title'
  | 'experience_years'
  | 'education'
  | 'skills'
  | 'salary'
  | 'essay'
  | 'unknown';

export type FieldContext = {
  label?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  type?: string;
  nearbyText?: string;
  formTitle?: string;
};

export type ClassifierResult = {
  type: FieldType;
  confidence: number;
  matchedKeywords?: string[];
  debugInfo?: Record<string, any>;
};

// Extensible keyword configuration
export const KEYWORDS: Record<Exclude<FieldType, 'unknown'>, string[]> = {
  first_name: ['first name', 'given name', 'fname', 'first'],
  last_name: ['last name', 'family name', 'lname', 'surname', 'last'],
  full_name: ['full name', 'your name', 'name'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'mobile', 'contact number', 'telephone', 'cell', 'tel'],
  address: ['address', 'street', 'location', 'residence'],
  city: ['city', 'town', 'municipality'],
  dob: ['dob', 'date of birth', 'birth date', 'birthday'],
  linkedin: ['linkedin', 'linked in'],
  github: ['github', 'git hub'],
  portfolio: ['portfolio', 'website', 'personal website', 'blog'],
  job_title: ['job title', 'title', 'position', 'role', 'current role'],
  experience_years: ['experience', 'years of experience', 'yoe', 'total experience'],
  education: ['education', 'university', 'college', 'degree', 'school'],
  skills: ['skills', 'technologies', 'core competencies', 'tech stack'],
  salary: ['salary', 'compensation', 'expected salary', 'pay'],
  essay: ['why', 'describe', 'tell us', 'tell me', 'explain', 'motivation', 'cover letter', 'about yourself'],
};

// Base confidence map
const BASE_CONFIDENCE: Partial<Record<FieldType, number>> = {
  email: 0.95,
  phone: 0.95,
  full_name: 0.9,
  first_name: 0.9,
  last_name: 0.9,
  dob: 0.9,
  linkedin: 0.85,
  github: 0.85,
  portfolio: 0.85,
  address: 0.8,
  city: 0.8,
  job_title: 0.75,
  education: 0.75,
  experience_years: 0.75,
  skills: 0.7,
  salary: 0.7,
  essay: 0.6,
  unknown: 0.3
};

/**
 * Normalizes text to lowercase, replaces punctuation with spaces, and removes extra whitespace.
 */
function normalizeText(text: string | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Internal match metadata
 */
type MatchData = {
  matchesLabel: boolean;
  matchesPlaceholder: boolean;
  matchesNameOrId: boolean;
  matchesNearby: boolean;
  matchedKeywords: string[];
};

/**
 * Field Classifier - determines form field types based on given DOM context.
 */
export function classifyField(context: FieldContext): ClassifierResult {
  const normLabel = normalizeText(context.label);
  const normPlaceholder = normalizeText(context.placeholder);
  const normName = normalizeText(context.name);
  const normId = normalizeText(context.id);
  const normNearbyText = normalizeText(context.nearbyText);
  const normFormTitle = normalizeText(context.formTitle);

  const debugInfo: Record<string, any> = {
    normalizedContext: {
      label: normLabel,
      placeholder: normPlaceholder,
      name: normName,
      id: normId,
      nearbyText: normNearbyText,
      formTitle: normFormTitle,
      type: context.type?.toLowerCase()
    },
    ruleMatches: []
  };

  const allTexts = [normLabel, normPlaceholder, normName, normId, normNearbyText, normFormTitle].filter(Boolean);
  const mergedText = allTexts.join(' ');

  if (mergedText.length === 0 && !context.type) {
    debugInfo.ruleMatches.push('empty context');
    return { type: 'unknown', confidence: 0.3, matchedKeywords: [], debugInfo };
  }

  // Helper to generate MatchData
  const getMatchData = (type: Exclude<FieldType, 'unknown'>): MatchData => {
    const kws = KEYWORDS[type];
    const matched: string[] = [];
    
    let matchesLabel = false;
    let matchesPlaceholder = false;
    let matchesNameOrId = false;
    let matchesNearby = false;

    kws.forEach(kw => {
      // Escape for regex, protect explicitly against any special chars
      const escapedKw = kw.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
      const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
      let matchedKw = false;

      if (normLabel && regex.test(normLabel)) { matchesLabel = true; matchedKw = true; }
      if (normPlaceholder && regex.test(normPlaceholder)) { matchesPlaceholder = true; matchedKw = true; }
      if (normName && regex.test(normName)) { matchesNameOrId = true; matchedKw = true; }
      if (normId && regex.test(normId)) { matchesNameOrId = true; matchedKw = true; }
      if (normNearbyText && regex.test(normNearbyText)) { matchesNearby = true; matchedKw = true; }
      if (normFormTitle && regex.test(normFormTitle)) { matchedKw = true; } // Count as support

      if (matchedKw) matched.push(kw);
    });

    return { matchesLabel, matchesPlaceholder, matchesNameOrId, matchesNearby, matchedKeywords: matched };
  };

  // Helper to construct result with confidence dynamic adjustments
  const buildResult = (type: FieldType, baseConf: number, mData: MatchData | null): ClassifierResult => {
    let confidence = baseConf;
    if (mData) {
      let matchedFields = 0;
      if (mData.matchesLabel) matchedFields++;
      if (mData.matchesPlaceholder) matchedFields++;
      if (mData.matchesNameOrId) matchedFields++;

      if (matchedFields >= 2) confidence += 0.05;
      if (matchedFields === 0 && mData.matchesNearby) confidence -= 0.15;
      if (!mData.matchesLabel && !mData.matchesPlaceholder && mData.matchesNameOrId) confidence -= 0.1;
    }

    if (mData && mData.matchedKeywords.length >= 2) confidence += 0.05;
    confidence = Math.min(Math.max(confidence, 0.0), 1.0);
    
    return { 
      type, 
      confidence: Number(confidence.toFixed(2)), 
      matchedKeywords: mData ? mData.matchedKeywords : [], 
      debugInfo 
    };
  };

  // 1. Special Handling: Textarea strongly biased to essay
  const isTextarea = context.type?.toLowerCase() === 'textarea';
  if (isTextarea) {
     const essayMatch = getMatchData('essay');
     if (essayMatch.matchedKeywords.length > 0) {
        debugInfo.ruleMatches.push('textarea + essay keywords');
        return buildResult('essay', 0.95, essayMatch); 
     } else {
        debugInfo.ruleMatches.push('textarea fallback');
        return buildResult('essay', 0.85, null); 
     }
  }

  // 2. Special overrides derived from HTML5 input type
  const inputType = context.type?.toLowerCase();
  if (inputType === 'email') {
     debugInfo.ruleMatches.push('type override email');
     return buildResult('email', 0.95, getMatchData('email')); 
  }
  if (inputType === 'tel') {
     debugInfo.ruleMatches.push('type override tel');
     return buildResult('phone', 0.95, getMatchData('phone')); 
  }

  // 3. Names Evaluation (first / last / full priority logic)
  const firstMatch = getMatchData('first_name');
  const lastMatch = getMatchData('last_name');
  const hasFirst = firstMatch.matchedKeywords.length > 0;
  const hasLast = lastMatch.matchedKeywords.length > 0;

  if (hasFirst && hasLast) {
    debugInfo.ruleMatches.push('first_name + last_name match -> full_name');
    const combinedMatch: MatchData = {
      matchesLabel: firstMatch.matchesLabel || lastMatch.matchesLabel,
      matchesPlaceholder: firstMatch.matchesPlaceholder || lastMatch.matchesPlaceholder,
      matchesNameOrId: firstMatch.matchesNameOrId || lastMatch.matchesNameOrId,
      matchesNearby: firstMatch.matchesNearby || lastMatch.matchesNearby,
      matchedKeywords: [...firstMatch.matchedKeywords, ...lastMatch.matchedKeywords]
    };
    return buildResult('full_name', BASE_CONFIDENCE['full_name'] as number, combinedMatch);
  }

  if (hasFirst) {
    debugInfo.ruleMatches.push('first_name match');
    return buildResult('first_name', BASE_CONFIDENCE['first_name'] as number, firstMatch);
  }

  if (hasLast) {
    debugInfo.ruleMatches.push('last_name match');
    return buildResult('last_name', BASE_CONFIDENCE['last_name'] as number, lastMatch);
  }

  // Strict check on full_name for false positives
  const fullMatch = getMatchData('full_name');
  if (fullMatch.matchedKeywords.length > 0) {
    if (/\b(username|user name|company name|business|employer|organization)\b/.test(mergedText)) {
       debugInfo.ruleMatches.push('prevented full_name false positive');
    } else {
       if (fullMatch.matchedKeywords.length === 1 && fullMatch.matchedKeywords[0] === 'name') {
          if (!fullMatch.matchesLabel && !fullMatch.matchesPlaceholder && !fullMatch.matchesNameOrId) {
             debugInfo.ruleMatches.push('ignored weak full_name (generic "name" only in nearbyText/title)');
          } else {
             debugInfo.ruleMatches.push('full_name generic match');
             return buildResult('full_name', BASE_CONFIDENCE['full_name'] as number, fullMatch);
          }
       } else {
          debugInfo.ruleMatches.push('full_name strong match');
          return buildResult('full_name', BASE_CONFIDENCE['full_name'] as number, fullMatch);
       }
    }
  }

  // 4. Sequential Evaluation based on priority order
  const PRIORITY_ORDER: FieldType[] = [
    'email',
    'phone',
    'dob',
    'linkedin',
    'github',
    'portfolio',
    'address',
    'city',
    'job_title',
    'experience_years',
    'education',
    'skills',
    'salary',
    'essay'
  ];

  for (const type of PRIORITY_ORDER) {
    const matchData = getMatchData(type as Exclude<FieldType, 'unknown'>);
    if (matchData.matchedKeywords.length > 0) {
      debugInfo.ruleMatches.push(`${type} priority match`);
      return buildResult(type, BASE_CONFIDENCE[type] as number, matchData);
    }
  }

  // 5. Unrecognized field
  debugInfo.ruleMatches.push('no match');
  return buildResult('unknown', BASE_CONFIDENCE['unknown'] as number, null);
}

// --------------------------------------------------------------------------------------
// TEST EXAMPLES
// --------------------------------------------------------------------------------------
export function runTests() {
  const tests: { input: FieldContext; expected: FieldType; name: string }[] = [
    { name: '1. "First & Last Name"', input: { label: 'First & Last Name', name: 'name' }, expected: 'full_name' },
    { name: '2. "Your Name"', input: { placeholder: 'Your Name' }, expected: 'full_name' },
    { name: '3. "Work Email"', input: { label: 'Work Email', type: 'text' }, expected: 'email' },
    { name: '4. "Contact Info"', input: { formTitle: 'Contact Info' }, expected: 'unknown' },
    { name: '5. "LinkedIn URL"', input: { label: 'LinkedIn URL' }, expected: 'linkedin' },
    { name: '6. "Tell us about yourself"', input: { label: 'Tell us about yourself' }, expected: 'essay' },
    { name: '7. Empty context', input: {}, expected: 'unknown' },
    { name: '8. Username false positive', input: { label: 'Username' }, expected: 'unknown' },
    { name: '9. Company Name false positive', input: { label: 'Company Name' }, expected: 'unknown' },
    { name: '10. Textarea heavily biased to essay', input: { type: 'textarea' }, expected: 'essay' }
  ];

  console.log('--- RUNNING CLASSIFIER TESTS ---');
  let passed = 0;
  tests.forEach((t, i) => {
    const res = classifyField(t.input);
    const success = res.type === t.expected;
    if (success) passed++;
    console.log(`Test ${i + 1}: ${t.name}`);
    console.log(`  Expected: ${t.expected}`);
    console.log(`  Actual: ${res.type} (Confidence: ${res.confidence}) | Pass: ${success ? '✅' : '❌'}`);
  });
  console.log(`\nTests passed: ${passed}/${tests.length}`);
}
