import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const app = express();
console.log("ENV CHECK:", process.env.OPENAI_API_KEY ? "FOUND" : "MISSING");
// middleware
app.use(cors());
app.use(express.json());

// test route (so browser doesn't show error)
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are zenGPT, a calm and helpful AI assistant.",
        },
        ...messages,
      ],
    });

    const aiMessage = response.choices?.[0]?.message?.content;

    res.json({
      reply: {
        role: "assistant",
        content: aiMessage || "No response from AI",
      },
    });

  } catch (error) {
  console.error("🔥 FULL ERROR:", error);

  res.status(500).json({
    error: error.message,
  });
}
});

// IMPORTANT: use Render's port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});