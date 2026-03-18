import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

// ✅ CORS (allow all for now)
app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

// ✅ OpenAI setup
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Health check (important for Render)
app.get("/", (req, res) => {
  res.send("🔥 ZenGPT backend is running");
});

// ✅ Chat route
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
  {
    role: "system",
    content: "You are a helpful, friendly, slightly cute AI assistant.",
  },
  ...messages
],
    });

    res.json({
      reply: response.choices[0].message.content,
    });
  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ✅ Use Render port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});