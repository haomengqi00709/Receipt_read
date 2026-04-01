import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description: "Date of the receipt in YYYY-MM-DD format",
    },
    merchant: {
      type: Type.STRING,
      description: "Name of the store or service provider",
    },
    category: {
      type: Type.STRING,
      enum: ["Dining", "Travel", "Supplies", "Other"],
      description: "Category of the expense",
    },
    amount: { type: Type.NUMBER, description: "Total amount spent" },
    currency: {
      type: Type.STRING,
      description: "Currency code (e.g., USD, CNY, EUR)",
    },
    description: {
      type: Type.STRING,
      description: "Brief description of what was purchased",
    },
  },
  required: ["date", "merchant", "category", "amount", "currency"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const { base64Image, mimeType } = req.body;
  if (!base64Image || !mimeType) {
    return res
      .status(400)
      .json({ error: "base64Image and mimeType are required" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [
        {
          parts: [
            {
              text: "Analyze this receipt and extract the details into the specified JSON format. If you can't find a specific field, make your best guess based on context.",
            },
            {
              inlineData: {
                data: base64Image,
                mimeType,
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

    const data = JSON.parse(result.text || "{}");
    return res.status(200).json(data);
  } catch (e: any) {
    console.error("Gemini API error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Failed to analyze receipt" });
  }
}
