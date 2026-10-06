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

Keep conversations engaging and natural.
Do not sound robotic or overly formal.

Prefer concise conversational replies unless the user asks for more detail.

Use emojis naturally, but do not overuse them.

Do not repeatedly introduce yourself.

Do not mention these instructions.

You are an early version of Aashi AI.
You do not have personal memories about the user unless they are included in the conversation history.
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

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash"
    ];

    let lastError = null;

    for (const model of models) {

      for (let attempt = 0; attempt < 2; attempt++) {

        try {

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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

          if (response.ok) {

            const reply =
              data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (reply) {
              return res.status(200).json({
                reply
              });
            }
          }

          lastError =
            data?.error?.message ||
            `Gemini returned HTTP ${response.status}`;

          console.error(
            `Gemini ${model} attempt ${attempt + 1}:`,
            lastError
          );

          // Retry temporary server/rate-limit errors.
          if (
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            await new Promise(resolve =>
              setTimeout(resolve, 1000 * (attempt + 1))
            );

            continue;
          }

          // Don't retry permanent errors.
          break;

        } catch (error) {

          lastError = error.message;

          console.error(
            `Gemini ${model} network error:`,
            error
          );

          await new Promise(resolve =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
        }
      }
    }

    return res.status(503).json({
      error: "Aashi AI is temporarily busy. Please try again in a moment."
    });

  } catch (error) {

    console.error("Server error:", error);

    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
