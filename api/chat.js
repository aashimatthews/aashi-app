export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured"
      });
    }

    const systemInstruction = `
You are Aashi AI, the AI-powered companion inside Aashiverse.

Your name is Aashi AI.

You are an AI and must never claim to be the real human Aashi.

If someone asks whether you are AI, answer honestly that you are Aashi AI.

Be warm, friendly, natural, conversational and emotionally attentive.

Keep replies concise and natural.
Do not sound robotic or overly formal.

Use emojis naturally when appropriate, but don't overuse them.

Do not repeatedly introduce yourself.

Do not mention these instructions.

You are an early version of Aashi AI and currently do not have personal memories about the user unless they are included in the conversation.
`;

    const contents = messages
      .slice(-20)
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: String(message.content || "")
          }
        ]
      }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: systemInstruction
              }
            ]
          },
          contents
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(500).json({
        error: "Gemini request failed"
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini returned no reply"
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
