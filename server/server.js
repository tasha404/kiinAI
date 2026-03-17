import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const app = express();

// CORS configuration - Allow your Vercel frontend
app.use(cors({
  origin: [
    "https://kiinai.vercel.app", // Your Vercel frontend
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    message: "Backend is running on Render 🚀",
    frontend: "https://kiinai.vercel.app"
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    openai: process.env.OPENAI_API_KEY ? "configured" : "missing"
  });
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    console.log("📨 Received messages:", messages.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are zenGPT, a calm and helpful AI assistant.",
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiMessage = completion.choices?.[0]?.message?.content;

    res.json({
      reply: {
        role: "assistant",
        content: aiMessage || "I couldn't generate a response. Please try again.",
      },
      usage: completion.usage
    });

    console.log("✅ Response sent successfully");

  } catch (error) {
    console.error("🔥 OpenAI API Error:", error);

    let statusCode = 500;
    let errorMessage = error.message;

    if (error.status === 401) {
      statusCode = 401;
      errorMessage = "Invalid OpenAI API key";
    } else if (error.status === 429) {
      statusCode = 429;
      errorMessage = "Rate limit exceeded. Please try again later.";
    }

    res.status(statusCode).json({
      error: errorMessage,
      type: error.type || "api_error"
    });
  }
});

// ❌ REMOVE THIS LINE - it's causing the error
// app.options("*", cors());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Allowed frontend: https://kiinai.vercel.app`);
});