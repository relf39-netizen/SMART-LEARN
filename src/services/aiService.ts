
import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedQuestion {
  text: string;
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  correct: string;
  explanation: string;
  image?: string; 
}

const generateImageUrl = (description: string): string => {
  if (!description || description.trim().length === 0 || description.toLowerCase() === 'none') return '';
  const encodedPrompt = encodeURIComponent(description + " cartoon style, for kids, educational, white background, simple, clear, high quality");
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`;
};

export const generateQuestionWithAI = async (
  subject: string,
  grade: string,
  topic: string,
  apiKey: string,
  count: number = 1,
  style: 'normal' | 'onet' = 'normal' 
): Promise<GeneratedQuestion[] | null> => {
  try {
    if (!apiKey) {
      throw new Error("กรุณาระบุ API Key");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = "gemini-2.5-flash";
    
    let systemInstruction = "";
    
    if (style === 'onet') {
      // 🟢 O-NET Specific Instruction
      systemInstruction = `
        You are an expert exam creator for Thailand's O-NET (Ordinary National Educational Test) for Grade 6 (Prathom 6).
        Your task is to generate standardized exam questions by simulating the style, difficulty, and format of past O-NET exam papers (ข้อสอบเก่า).
        
        Key Requirements for O-NET Style:
        - Reference: Mimic the style of actual past O-NET exams (ปี 2560-2566).
        - Difficulty: Challenging, requiring critical thinking (คิดวิเคราะห์), integration of knowledge, not just rote memory.
        - Language: Formal Academic Thai (ภาษาทางการแบบข้อสอบจริง).
        - Subject Context: Strictly aligns with the Thai Basic Education Curriculum B.E. 2551 (Updated 2560).
        - Question Types: Situation-based questions, reading comprehension, or problem-solving scenarios often found in O-NET.
      `;
    } else {
      // 🟢 Normal Instruction
      systemInstruction = `
        You are a helpful teacher assistant creating multiple-choice questions for ${grade} grade students.
        Language: Thai (Natural, age-appropriate, and encouraging).
      `;
    }

    const prompt = `
      ${systemInstruction}
      
      Task: Create ${count} multiple-choice question(s).
      Subject: ${subject}
      Topic/Strand: ${topic}
      
      Requirements:
      - Return an array of objects.
      - Each object must have 4 choices (c1, c2, c3, c4).
      - Indicate the correct choice number (1, 2, 3, or 4).
      - Provide a clear and educational explanation for the correct answer (in Thai).
      - If the question involves a visual scenario (e.g., geometry, animal characteristics, map) provide a concise English description in 'image_description'. If no image is needed, use "none".
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY, 
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The question text" },
              c1: { type: Type.STRING, description: "Choice 1" },
              c2: { type: Type.STRING, description: "Choice 2" },
              c3: { type: Type.STRING, description: "Choice 3" },
              c4: { type: Type.STRING, description: "Choice 4" },
              correct: { type: Type.STRING, description: "The correct choice number '1', '2', '3', or '4'" },
              explanation: { type: Type.STRING, description: "Explanation of the answer" },
              image_description: { type: Type.STRING, description: "Visual description in English for image generation (or 'none')" }
            },
            required: ["text", "c1", "c2", "c3", "c4", "correct", "explanation"],
          },
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      const rawArray = Array.isArray(data) ? data : [data];
      
      return rawArray.map((item: any) => ({
        text: item.text,
        c1: item.c1,
        c2: item.c2,
        c3: item.c3,
        c4: item.c4,
        correct: item.correct,
        explanation: item.explanation,
        image: item.image_description ? generateImageUrl(item.image_description) : ''
      }));
    }
    
    return null;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
};
