import { GoogleGenAI } from '@google/genai';
import { UserProfile } from '../types';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateFieldResponse(
  profile: UserProfile,
  fieldContext: { label: string; placeholder: string; name: string; id: string }
): Promise<string> {
  const profileText = `
Name: ${profile.fullName}
Email: ${profile.email}
Phone: ${profile.phone}
Date of Birth: ${profile.dob}
Address: ${profile.address}
LinkedIn: ${profile.linkedin}
GitHub: ${profile.github}
Portfolio: ${profile.portfolio}
Current Role: ${profile.currentRole}
Years of Experience: ${profile.yearsOfExperience}
Education: ${profile.education}
Certifications: ${profile.certifications}
Bio: ${profile.bio}
Skills: ${profile.skills}
Achievements: ${profile.achievements}
Other Details: ${profile.otherDetails}
  `.trim();

  const contextText = `
Field Label: ${fieldContext.label}
Field Placeholder: ${fieldContext.placeholder}
Field Name: ${fieldContext.name}
Field ID: ${fieldContext.id}
  `.trim();

  const prompt = `
Using the following personal information:
${profileText}

Write a highly relevant response to this specific form field:
${contextText}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an AI assistant helping a user fill out a form field. Output ONLY the exact text to be inserted into the field. Do not include quotes, markdown formatting, introductory text, or conversational filler. Keep it concise, professional, and tailored to the field context. If the field asks for a simple detail (like name or email), just provide that detail. If it asks a complex question, write a well-crafted response (max 150 words).",
        temperature: 0.7,
      }
    });
    
    const text = response.text?.trim();
    if (!text) {
      throw new Error('AI returned an empty response.');
    }
    return text;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response. Please try again.');
  }
}
