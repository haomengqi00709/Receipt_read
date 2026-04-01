export interface ReceiptData {
  date: string;
  merchant: string;
  category: "Dining" | "Travel" | "Supplies" | "Other";
  amount: number;
  currency: string;
  description: string;
}

export async function analyzeReceipt(
  base64Image: string,
  mimeType: string
): Promise<ReceiptData> {
  const response = await fetch("/api/analyze-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to analyze receipt");
  }

  return response.json();
}
