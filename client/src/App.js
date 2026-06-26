import { useState, useEffect, useRef } from "react";
import remarkGfm from "remark-gfm";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { auth } from "./firebase";
import { PiChatCircle } from "react-icons/pi";
import { BsLayoutSidebar } from "react-icons/bs";
import { GoTrash } from "react-icons/go";
import { BsPaperclip } from "react-icons/bs";
import { HiOutlineComputerDesktop } from "react-icons/hi2";
import { GiBrain } from "react-icons/gi";
import { TbBooks } from "react-icons/tb";
import { MdOutlineBarChart } from "react-icons/md";
import { IoSettingsOutline, IoCopyOutline, IoCheckmarkOutline } from "react-icons/io5";
import { RiMenu3Line } from "react-icons/ri";
import FlipClock from "./FlipClock";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";

const API_URL = "https://zengpt-backend.kiinbackend.workers.dev/chat";

const ACCENT_COLORS = [
  { name: "pink",   main: "#ff8fb1", hover: "#ff6f9c", light: "#ffe4ee", lightHover: "#ffd6e7" },
  { name: "blue",   main: "#4f8cff", hover: "#2d6ff0", light: "#e0eaff", lightHover: "#c7d9ff" },
  { name: "green",  main: "#3ecf8e", hover: "#28b87a", light: "#d6f5e8", lightHover: "#b8edda" },
  { name: "yellow", main: "#f5a623", hover: "#e09510", light: "#fff3d6", lightHover: "#ffe8b0" },
  { name: "purple", main: "#a259ff", hover: "#8a3fe8", light: "#ede0ff", lightHover: "#dcc9ff" },
];

const ANALYST_PROMPTS = [
  "Should I choose React or Vue for my next project?",
  "Pros and cons of remote work vs office",
  "Analyze the risks of launching a startup now",
  "Compare SQL vs NoSQL for my use case",
  "Is it worth learning Rust in 2025?",
  "Help me decide between two job offers",
];

const CODING_PROMPTS = [
  "Explain how async/await works",
  "Review my code for bugs",
  "Write a Python script to read a CSV file",
  "What's the difference between SQL and NoSQL?",
  "How do I center a div in CSS?",
  "Explain Big O notation simply",
];

// ─── CODE BLOCK ───────────────────────────────────────────────
const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{language || "code"}</span>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? <><IoCheckmarkOutline /> Copied!</> : <><IoCopyOutline /> Copy</>}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: "0 0 10px 10px", fontSize: "13px", padding: "16px" }}
        showLineNumbers={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

// ─── MARKDOWN RENDERER ────────────────────────────────────────
const MarkdownRenderer = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        const language = match ? match[1] : "";
        const value = String(children).replace(/\n$/, "");
        if (!inline && (match || value.includes("\n"))) {
          return <CodeBlock language={language} value={value} />;
        }
        return <code className="inline-code" {...props}>{children}</code>;
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const bottomRef = useRef(null);
  const [mode, setMode] = useState("normal");

  // 🔐 auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // 💬 chat
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState([
    { id: String(Date.now()), title: "New Chat", messages: [] }
  ]);
  const [currentChatId, setCurrentChatId] = useState(chats[0].id);
  const currentChat = chats.find(c => c.id === currentChatId) || { messages: [] };

  // 📂 file context
  const [fileContext, setFileContext] = useState({});

  // 📁 sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 🍅 Pomodoro
  const [time, setTime] = useState(1500);
  const [audio, setAudio] = useState(null);
  const [activeSound, setActiveSound] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const timerRef = useRef(null);

  // 🎨 Theme
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [accentIndex, setAccentIndex] = useState(() => parseInt(localStorage.getItem("accentIndex") || "0"));
  const [showSettings, setShowSettings] = useState(false);

  const accent = ACCENT_COLORS[accentIndex];

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accent.main);
    root.style.setProperty("--accent-hover", accent.hover);
    root.style.setProperty("--accent-light", accent.light);
    root.style.setProperty("--accent-light-hover", accent.lightHover);
    if (darkMode) {
      root.style.setProperty("--bg", "#111318");
      root.style.setProperty("--sidebar-bg", "#1a1d24");
      root.style.setProperty("--surface", "#1e2128");
      root.style.setProperty("--border", "#2e3138");
      root.style.setProperty("--text", "#e8e8f0");
      root.style.setProperty("--text-muted", "#7a7a90");
      root.style.setProperty("--msg-user", "#2a1f2e");
      root.style.setProperty("--msg-ai", "#1e2128");
      root.style.setProperty("--hover", "#2a2d36");
      root.style.setProperty("--input-bg", "#1e2128");
      root.style.setProperty("--input-border", "#2e3138");
    } else {
      root.style.setProperty("--bg", "#f5f5f7");
      root.style.setProperty("--sidebar-bg", "#f7f7f8");
      root.style.setProperty("--surface", "#ffffff");
      root.style.setProperty("--border", "#e5e5e5");
      root.style.setProperty("--text", "#111111");
      root.style.setProperty("--text-muted", "#999999");
      root.style.setProperty("--msg-user", accent.light);
      root.style.setProperty("--msg-ai", "#e5e5ea");
      root.style.setProperty("--hover", "#e9e9ee");
      root.style.setProperty("--input-bg", "#ffffff");
      root.style.setProperty("--input-border", "#dddddd");
    }
    localStorage.setItem("darkMode", darkMode);
    localStorage.setItem("accentIndex", accentIndex);
  }, [darkMode, accentIndex, accent]);

  // 🔐 Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const chatsRef = collection(db, "users", u.uid, "chats");
        const snapshot = await getDocs(chatsRef);
        const loadedChats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (loadedChats.length > 0) {
          setChats(loadedChats);
          setCurrentChatId(loadedChats[0].id);
        } else {
          const newId = String(Date.now());
          setChats([{ id: newId, title: "New Chat", messages: [] }]);
          setCurrentChatId(newId);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 💾 Save chats to Firestore — skip empty chats
  useEffect(() => {
    if (!user) return;
    const saveChats = async () => {
      for (const chat of chats) {
        if (chat.messages.length === 0) continue;
        const chatRef = doc(db, "users", user.uid, "chats", chat.id);
        await setDoc(chatRef, { title: chat.title, messages: chat.messages });
      }
    };
    saveChats();
  }, [chats, user]);

  // ✅ Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat.messages]);

  // 🍅 Pomodoro timer
  useEffect(() => {
    if (isRunning && time > 0) {
      timerRef.current = setTimeout(() => setTime(t => t - 1), 1000);
    } else if (time === 0) {
      setIsBreak(b => !b);
      setTime(isBreak ? 1500 : 300);
      setIsRunning(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [isRunning, time, isBreak]);

  // 📐 Resize handler
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    // Set initial state correctly
    if (window.innerWidth > 768) setSidebarOpen(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔑 Login / Signup / Logout
  const login = async () => {
    setAuthError("");
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) { setAuthError(err.message); }
  };
  const signup = async () => {
    setAuthError("");
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (err) { setAuthError(err.message); }
  };
  const logout = async () => {
    await signOut(auth);
    const newId = String(Date.now());
    setChats([{ id: newId, title: "New Chat", messages: [] }]);
    setCurrentChatId(newId);
    setShowSettings(false);
  };

  // 📂 File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      alert("Only .txt files supported for now");
      return;
    }
    const text = await file.text();
    setFileContext(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), { text, name: file.name }]
    }));
  };

  // 🎛️ Switch mode
  const switchMode = (newMode) => {
    if ((newMode === "coding" || newMode === "analyst") && mode !== newMode) {
      const current = chats.find(c => c.id === currentChatId);
      if (current && current.messages.length > 0) {
        const newId = String(Date.now());
        setChats(prev => [...prev, { id: newId, title: "New Chat", messages: [] }]);
        setCurrentChatId(newId);
      }
    }
    if ((mode === "coding" || mode === "analyst") && newMode !== mode) {
      setChats(prev => {
        const nonEmpty = prev.filter(c => c.messages.length > 0);
        if (nonEmpty.length === 0) {
          const newId = String(Date.now());
          setCurrentChatId(newId);
          return [{ id: newId, title: "New Chat", messages: [] }];
        }
        setCurrentChatId(nonEmpty[0].id);
        return nonEmpty;
      });
    }
    setMode(newMode);
    if (isMobile) setSidebarOpen(false);
  };

  // 💬 New / Delete chat
  const newChat = () => {
    const current = chats.find(c => c.id === currentChatId);
    if (current && current.messages.length === 0 && mode !== "study") {
      setCurrentChatId(current.id);
      if (isMobile) setSidebarOpen(false);
      return;
    }
    const newId = String(Date.now());
    setChats(prev => [...prev, { id: newId, title: "New Chat", messages: [] }]);
    setCurrentChatId(newId);
    if (mode === "study") setMode("normal");
    if (isMobile) setSidebarOpen(false);
  };

  const deleteChat = async (id) => {
    const chat = chats.find(c => c.id === id);
    if (chat && chat.messages.length > 0) {
      await deleteDoc(doc(db, "users", user.uid, "chats", id));
    }
    const filtered = chats.filter(c => c.id !== id);
    if (filtered.length === 0) {
      const newId = String(Date.now());
      setChats([{ id: newId, title: "New Chat", messages: [] }]);
      setCurrentChatId(newId);
    } else {
      setChats(filtered);
      setCurrentChatId(filtered[0].id);
    }
  };

  const selectChat = (id) => {
    setCurrentChatId(id);
    if (mode === "study") setMode("normal");
    if (isMobile) setSidebarOpen(false);
  };

  // 🤖 AI title
  const generateAITitle = async (messages) => {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Summarize this conversation in 3-5 short words based on the overall topic." },
            ...messages.filter(m => m.role === "user").slice(-5),
          ],
        }),
      });
      const data = await res.json();
      return data.reply?.replace(/[".]/g, "").trim() || "New Chat";
    } catch {
      return "New Chat";
    }
  };

  // 🔊 Sound controls
  const playSound = (src) => {
    if (audio) audio.pause();
    const newAudio = new Audio(src);
    newAudio.loop = true;
    newAudio.volume = 0.5;
    newAudio.play();
    setAudio(newAudio);
    setActiveSound(src);
  };
  const stopSound = () => {
    if (audio) { audio.pause(); setAudio(null); }
    setActiveSound(null);
  };

  // 🚀 Send message
  const sendMessage = async (overrideMessage) => {
    const msg = (overrideMessage !== undefined ? overrideMessage : message).trim();
    if (!msg) return;

    const userMsg = { role: "user", content: msg };
    const updatedMessages = [...currentChat.messages, userMsg];
    const isFirstMessage = currentChat.messages.length === 0;

    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
        ? { ...chat, title: isFirstMessage ? "Thinking..." : chat.title, messages: [...updatedMessages, { role: "assistant", content: "loading" }] }
        : chat
    ));
    setMessage("");

    try {
      const contextFiles = fileContext[currentChatId];
      const context = contextFiles ? contextFiles.map(f => f.text).join("\n\n") : null;

      let systemPrompt = "Be helpful and clear.";
      if (mode === "coding") systemPrompt = "You are a coding assistant. Be concise and technical. Always wrap code in markdown code blocks with the language specified.";
      else if (mode === "study") systemPrompt = "Explain step-by-step in a simple way like a tutor.";
      else if (mode === "analyst") systemPrompt = `You are a structured analyst. For every response, always format your answer using these sections where relevant:
**📊 Summary** — one sentence bottom line up front.
**✅ Pros / 🚫 Cons** — bullet points, be direct.
**⚠️ Risks & Assumptions** — what could go wrong, what are you assuming.
**🎯 Recommendation** — clear action or decision with a confidence level (e.g. Confidence: 8/10).
Never write in paragraphs. Always use structured formatting.`;

      const finalMessages = [
        { role: "system", content: `${systemPrompt}${context ? `\nUse this file context:\n${context}` : ""}` },
        ...updatedMessages
      ];

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalMessages }),
      });

      if (!res.body) {
        const data = await res.json();
        setChats(prev => prev.map(chat =>
          chat.id === currentChatId
            ? { ...chat, messages: [...updatedMessages, { role: "assistant", content: data.reply }] }
            : chat
        ));
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let aiText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          aiText += decoder.decode(value);
          const currentText = aiText;
          setChats(prev => prev.map(chat =>
            chat.id === currentChatId
              ? { ...chat, messages: [...updatedMessages, { role: "assistant", content: currentText }] }
              : chat
          ));
        }
      }

      if (isFirstMessage) {
        const newTitle = await generateAITitle(updatedMessages);
        setChats(prev => prev.map(chat =>
          chat.id === currentChatId ? { ...chat, title: newTitle } : chat
        ));
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  // ─── SETTINGS MODAL ───────────────────────────────────────────
  const SettingsModal = () => (
    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Settings</h3>
        <div className="setting-row">
          <span>Dark mode</span>
          <div className={`toggle ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(d => !d)}>
            <div className="toggle-thumb" />
          </div>
        </div>
        <div className="setting-row col">
          <span>Accent color</span>
          <div className="color-picks">
            {ACCENT_COLORS.map((c, i) => (
              <div
                key={c.name}
                className={`color-dot ${i === accentIndex ? "selected" : ""}`}
                style={{ background: c.main }}
                onClick={() => setAccentIndex(i)}
              />
            ))}
          </div>
        </div>
        <button className="modal-logout" onClick={logout}>Logout</button>
      </div>
    </div>
  );

  // ─── SHARED SIDEBAR ───────────────────────────────────────────
  const Sidebar = () => (
    <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="top">
        <div className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>
          <BsLayoutSidebar />
        </div>
        {sidebarOpen && <div className="logo">Kiin AI</div>}
      </div>

      {sidebarOpen && (
        <>
          <div className="actions">
            <div className="action" onClick={newChat}>
              <PiChatCircle />
              <span>New chat</span>
            </div>
          </div>

          {mode === "normal" && (
            <div className="chat-list">
              {[...chats].reverse().map((c) => (
                <div
                  key={c.id}
                  className={`chat-item ${c.id === currentChatId ? "active" : ""}`}
                  onClick={() => selectChat(c.id)}
                >
                  <span className="chat-title">{c.title}</span>
                  <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}>
                    <GoTrash />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(mode === "study" || mode === "coding" || mode === "analyst") && <div style={{ flex: 1 }} />}

          <div className="mode-switcher">
            <div className={`action ${mode === "normal" ? "active-mode" : ""}`} onClick={() => switchMode("normal")}>
              <GiBrain /> <span>Normal</span>
            </div>
            <div className={`action ${mode === "coding" ? "active-mode" : ""}`} onClick={() => switchMode("coding")}>
              <HiOutlineComputerDesktop /> <span>Coding</span>
            </div>
            <div className={`action ${mode === "study" ? "active-mode" : ""}`} onClick={() => switchMode("study")}>
              <TbBooks /> <span>Study</span>
            </div>
            <div className={`action ${mode === "analyst" ? "active-mode" : ""}`} onClick={() => switchMode("analyst")}>
              <MdOutlineBarChart /> <span>Analyst</span>
            </div>
          </div>

          <div className="profile" onClick={() => setShowSettings(true)}>
            <IoSettingsOutline />
            <span>Settings</span>
          </div>
        </>
      )}
    </div>
  );

  // ─── AUTH PAGE ────────────────────────────────────────────────
  if (authLoading) return null;

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2 style={{ fontFamily: "CuteFont" }}>KIIn</h2>
          <input placeholder="Email" onChange={(e) => { setEmail(e.target.value); setAuthError(""); }} />
          <input type="password" placeholder="Password" onChange={(e) => { setPassword(e.target.value); setAuthError(""); }} />
          {authError && <p className="auth-error">{authError}</p>}
          <button onClick={login}>Login</button>
          <button onClick={signup}>Sign Up</button>
        </div>
      </div>
    );
  }

  // ─── MAIN APP ─────────────────────────────────────────────────
  return (
    <div className="app">
      {showSettings && <SettingsModal />}

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Floating hamburger for mobile — only when sidebar is closed */}
      {isMobile && !sidebarOpen && (
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          <RiMenu3Line />
        </button>
      )}

      <Sidebar />

      <div className={`main ${isMobile ? "main-full" : ""}`}>
        {mode === "study" && (
          <div className="pomodoro">
            <h1>{isBreak ? "Doomscroll time " : "Lock in! "}</h1>
            <FlipClock time={time} />
            <div className="controls">
              <button onClick={() => setIsRunning(true)}>Start</button>
              <button onClick={() => setIsRunning(false)}>Pause</button>
              <button onClick={() => { setTime(1500); setIsRunning(false); setIsBreak(false); }}>Reset</button>
            </div>
            <div className="sound-controls">
              <p>Focus Sounds</p>
              <button className={activeSound === "/sounds/rain.mp3" ? "active-sound" : ""} onClick={() => playSound("/sounds/rain.mp3")}>🌧</button>
              <button className={activeSound === "/sounds/heater.mp3" ? "active-sound" : ""} onClick={() => playSound("/sounds/heater.mp3")}>🔥</button>
              <button className={activeSound === "/sounds/whitenoise.mp3" ? "active-sound" : ""} onClick={() => playSound("/sounds/whitenoise.mp3")}>🎧</button>
              <button onClick={stopSound}>Stop</button>
            </div>
          </div>
        )}

        {mode !== "study" && (
          <>
            {currentChat.messages.length === 0 ? (
              <div className="empty-state">
                {mode === "coding" ? (
                  <>
                    <h1>Wwhat are we vibing today :P️</h1>
                    <div className="suggestion-grid">
                      {CODING_PROMPTS.map((prompt, i) => (
                        <div key={i} className="suggestion-card" onClick={() => sendMessage(prompt)}>
                          {prompt}
                        </div>
                      ))}
                    </div>
                    <div className="center-input" style={{ marginTop: "24px" }}>
                      <input id="fileUploadCoding" type="file" accept=".txt" style={{ display: "none" }} onChange={handleFileUpload} />
                      <div className="upload-btn" onClick={() => document.getElementById("fileUploadCoding").click()}>
                        <BsPaperclip />
                      </div>
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Or ask anything..."
                      />
                      <button onClick={() => sendMessage()}>↑</button>
                    </div>
                  </>
                ) : mode === "analyst" ? (
                  <>
                    <h1>📊 What are we deciding today?</h1>
                    <div className="suggestion-grid">
                      {ANALYST_PROMPTS.map((prompt, i) => (
                        <div key={i} className="suggestion-card" onClick={() => sendMessage(prompt)}>
                          {prompt}
                        </div>
                      ))}
                    </div>
                    <div className="center-input" style={{ marginTop: "24px" }}>
                      <input id="fileUploadAnalyst" type="file" accept=".txt" style={{ display: "none" }} onChange={handleFileUpload} />
                      <div className="upload-btn" onClick={() => document.getElementById("fileUploadAnalyst").click()}>
                        <BsPaperclip />
                      </div>
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Give me a decision to analyze..."
                      />
                      <button onClick={() => sendMessage()}>↑</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h1>What ki-in I do for you today?</h1>
                    <div className="center-input">
                      <input id="fileUploadNormal" type="file" accept=".txt" style={{ display: "none" }} onChange={handleFileUpload} />
                      <div className="upload-btn" onClick={() => document.getElementById("fileUploadNormal").click()}>
                        <BsPaperclip />
                      </div>
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Ask anything"
                      />
                      <button onClick={() => sendMessage()}>↑</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="chat-box">
                  {currentChat.messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role}`}>
                      {msg.role === "assistant"
                        ? msg.content === "loading"
                          ? <div className="loading"><span /><span /><span /></div>
                          : (() => {
                              let content = msg.content;
                              try { const p = JSON.parse(msg.content); if (p.reply) content = p.reply; } catch {}
                              return <MarkdownRenderer content={content} />;
                            })()
                        : msg.content}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <div className="input-box">
                  <input id="fileUploadBottom" type="file" accept=".txt" style={{ display: "none" }} onChange={handleFileUpload} />
                  <div className="upload-btn" onClick={() => document.getElementById("fileUploadBottom").click()}>
                    <BsPaperclip />
                  </div>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask anything..."
                  />
                  <button onClick={() => sendMessage()}>Send</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;