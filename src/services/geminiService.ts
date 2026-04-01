import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ReceiptData {
  date: string;
  merchant: string;
  category: "Dining" | "Travel" | "Supplies" | "Other";
  amount: number;
  currency: string;
  description: string;
}

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, description: "Date of the receipt in YYYY-MM-DD format" },
    merchant: { type: Type.STRING, description: "Name of the store or service provider" },
    category: { 
      type: Type.STRING, 
      enum: ["Dining", "Travel", "Supplies", "Other"],
      description: "Category of the expense" 
    },
    amount: { type: Type.NUMBER, description: "Total amount spent" },
    currency: { type: Type.STRING, description: "Currency code (e.g., USD, CNY, EUR)" },
    description: { type: Type.STRING, description: "Brief description of what was purchased" },
  },
  required: ["date", "merchant", "category", "amount", "currency"],
};

export async function analyzeReceipt(base64Image: string, mimeType: string): Promise<ReceiptData> {
  const model = "gemini-3-flash-preview";
  
  const prompt = "Analyze this receipt and extract the details into the specified JSON format. If you can't find a specific field, make your best guess based on context.";

  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: receiptSchema,
    },
  });

  try {
    return JSON.parse(result.text || "{}") as ReceiptData;
  } catch (e) {
    console.error("Failed to parse Gemini response:", e);
    throw new Error("Failed to extract data from receipt");
  }
}
