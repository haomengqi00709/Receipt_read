import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(express.json({ limit: "50mb" }));

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
    total: {
      type: Type.NUMBER,
      description: "The final total amount on the receipt (inclusive of all taxes)",
    },
    gst: {
      type: Type.NUMBER,
      description:
        "GST (Goods and Services Tax) amount only. Do NOT include other taxes. Return 0 if no GST is found on the receipt.",
    },
    currency: {
      type: Type.STRING,
      description: "Currency code (e.g., USD, CNY, EUR, SGD, AUD)",
    },
    description: {
      type: Type.STRING,
      description: "Brief description of what was purchased",
    },
  },
  required: ["date", "merchant", "category", "total", "gst", "currency"],
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

app.post("/api/analyze-receipt", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables");
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const { base64Image, mimeType } = req.body;
  if (!base64Image || !mimeType) {
    return res
      .status(400)
      .json({ error: "base64Image and mimeType are required" });
  }

  console.log(`Processing receipt: mimeType=${mimeType}, imageSize=${base64Image.length} chars`);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            {
              text: "Analyze this receipt and extract the details into the specified JSON format. If you can't find a specific field, make your best guess based on context.",
            },
            {
              inlineData: { data: base64Image, mimeType },
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
    const costBeforeGst = parseFloat((data.total - data.gst).toFixed(2));
    console.log("Receipt processed successfully:", data.merchant);
    return res.status(200).json({ ...data, costBeforeGst });
  } catch (e: any) {
    console.error("Gemini API error:", e?.message || e);
    return res
      .status(500)
      .json({ error: e.message || "Failed to analyze receipt" });
  }
});

// Serve Vite build output
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "SET" : "NOT SET"}`);
});
