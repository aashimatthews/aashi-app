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
      return res.status(200).json({
        reply: "DEBUG ERROR: GEMINI_API_KEY is missing from Vercel."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: messages.slice(-20).map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [
              {
                text: String(message.content || "")
              }
            ]
          }))
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GEMINI ACTUAL ERROR:", data);

      return res.status(200).json({
        reply:
          "DEBUG ERROR FROM GEMINI:\n\n" +
          (data?.error?.message || JSON.stringify(data))
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(200).json({
        reply:
          "DEBUG ERROR: Gemini returned no text.\n\n" +
          JSON.stringify(data)
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(200).json({
      reply:
        "DEBUG SERVER ERROR:\n\n" +
        error.message
    });
  }
}
