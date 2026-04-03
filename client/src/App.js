import { useState, useEffect, useRef } from "react";
import remarkGfm from "remark-gfm";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { auth } from "./firebase";
import { IoIosLogOut } from "react-icons/io";
import { PiChatCircle } from "react-icons/pi";
import { BsLayoutSidebar } from "react-icons/bs";
import { GoTrash } from "react-icons/go";
import { BsPaperclip } from "react-icons/bs";
import FlipClock from "./FlipClock";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

const API_URL = "https://kiinai-production.up.railway.app/chat";

function App() {
  const [user, setUser] = useState(null);
  const bottomRef = useRef(null);
  const [mode, setMode] = useState("normal");

  // 🔐 auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 💬 chat
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState([
    { id: Date.now(), title: "New Chat", messages: [] }
  ]);

  const [currentChatId, setCurrentChatId] = useState(chats[0].id);
  const currentChat = chats.find(c => c.id === currentChatId) || { messages: [] };

  // 📂 file context (MULTI FILE)
  const [fileContext, setFileContext] = useState({});

  // 📁 sidebar
const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 🍅 STUDY MODE (Pomodoro)
  const [time, setTime] = useState(1500); // 25 minutes in seconds
  const [audio, setAudio] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const timerRef = useRef(null);

  // 🔐 auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const newId = Date.now();
        setChats([{ id: newId, title: "New Chat", messages: [] }]);
        setCurrentChatId(newId);
      }
    });
    return () => unsub();
  }, []);

  // ✅ AUTO SCROLL
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat.messages]);

  // 🍅 Pomodoro timer effect
  useEffect(() => {
    if (isRunning && time > 0) {
      timerRef.current = setTimeout(() => {
        setTime(time - 1);
      }, 1000);
    } else if (time === 0) {
      // Timer finished
      if (!isBreak) {
        // Focus session ended, start break
        setIsBreak(true);
        setTime(300); // 5 minute break
      } else {
        // Break ended, start focus session
        setIsBreak(false);
        setTime(1500); // 25 minute focus
      }
      setIsRunning(false);
      // Play notification sound (optional)
      // new Audio('/notification.mp3').play();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isRunning, time, isBreak]);

  // 🔑 LOGIN
  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  // 🆕 SIGNUP
  const signup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  // 🚪 LOGOUT
  const logout = async () => {
    await signOut(auth);
    const newId = Date.now();
    setChats([{ id: newId, title: "New Chat", messages: [] }]);
    setCurrentChatId(newId);
  };

useEffect(() => {
  const handleResize = () => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);

    if (!mobile) {
      setSidebarOpen(true);
    }
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

  // 📂 FILE UPLOAD (MULTI FILE)
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
      [currentChatId]: [
        ...(prev[currentChatId] || []),
        { text, name: file.name }
      ]
    }));
  };

  // 🆕 NEW CHAT
  const newChat = () => {
    const newId = Date.now();
    const newChatObj = {
      id: newId,
      title: "New Chat",
      messages: []
    };
    setChats(prev => [...prev, newChatObj]);
    setCurrentChatId(newId);
  };

  const deleteChat = (id) => {
    const filtered = chats.filter(c => c.id !== id);

    if (filtered.length === 0) {
      const newId = Date.now();
      setChats([{ id: newId, title: "New Chat", messages: [] }]);
      setCurrentChatId(newId);
    } else {
      setChats(filtered);
      setCurrentChatId(filtered[0].id);
    }
  };

  const generateAITitle = async (messages) => {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "Summarize this conversation in 3-5 short words based on the overall topic.",
            },
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

  const playSound = (src) => {
  if (audio) {
    audio.pause();
  }

  const newAudio = new Audio(src);
  newAudio.loop = true;
  newAudio.volume = 0.5;

  newAudio.play();

  setAudio(newAudio);
};

const stopSound = () => {
  if (audio) {
    audio.pause();
    setAudio(null);
  }
};

  // 🚀 SEND MESSAGE
  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { role: "user", content: message };
    const updatedMessages = [...currentChat.messages, userMsg];
    const isFirstMessage = currentChat.messages.length === 0;

    setChats(prev =>
      prev.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              title: isFirstMessage ? "Thinking..." : chat.title,
              messages: [
                ...updatedMessages,
                { role: "assistant", content: "loading" }
              ]
            }
          : chat
      )
    );

    setMessage("");

    try {
      // 📂 MULTI FILE CONTEXT
      const contextFiles = fileContext[currentChatId];
      const context = contextFiles
        ? contextFiles.map(f => f.text).join("\n\n")
        : null;

      let systemPrompt = "";

      if (mode === "coding") {
        systemPrompt = "You are a coding assistant. Be concise and technical.";
      } else if (mode === "study") {
        systemPrompt = "Explain step-by-step in a simple way like a tutor.";
      } else {
        systemPrompt = "Be helpful and clear.";
      }

      const finalMessages = [
        {
          role: "system",
          content: `
${systemPrompt}
${context ? `Use this file context:\n${context}` : ""}
          `
        },
        ...updatedMessages
      ];

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalMessages }),
      });

      // 🧠 fallback if no streaming
      if (!res.body) {
        const data = await res.json();

        setChats(prev =>
          prev.map(chat =>
            chat.id === currentChatId
              ? {
                  ...chat,
                  messages: [
                    ...updatedMessages,
                    { role: "assistant", content: data.reply }
                  ]
                }
              : chat
          )
        );
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let aiText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          aiText += chunk;
const currentText = aiText; // ✅ FIX: stable reference

setChats(prev =>
  prev.map(chat =>
    chat.id === currentChatId
      ? {
          ...chat,
          messages: [
            ...updatedMessages,
            { role: "assistant", content: currentText }
          ]
        }
      : chat
  )
);
        }
      }

      // ✅ TITLE UPDATE
      let newTitle = null;
      if (isFirstMessage) {
        newTitle = await generateAITitle(updatedMessages);
      }

      setChats(prev =>
        prev.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                title: newTitle || chat.title
              }
            : chat
        )
      );

    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  // 🔐 AUTH PAGE
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2 style={{ fontFamily: 'CuteFont' }}>KIIn</h2>

          <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

          <button onClick={login}>Login</button>
          <button onClick={signup}>Sign Up</button>
        </div>
      </div>
    );
  }

  // 🎓 STUDY MODE (Pomodoro Flip Clock)
  if (mode === "study") {
    return (
      <div className="app">
        <div className={`sidebar 
  ${sidebarOpen ? "open" : ""} 
  ${isMobile && !sidebarOpen ? "mini" : ""}
`}>
          <div className="top">
            <div className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <BsLayoutSidebar />
            </div>
            {sidebarOpen && <div className="logo">Kiin AI</div>}
          </div>

          <div className="actions">
            <div className="action" onClick={newChat}>
              <PiChatCircle />
              {sidebarOpen && <span>New chat</span>}
            </div>

            <div className="action" onClick={() => setMode("normal")}>🧠 {sidebarOpen && <span>Normal</span>}</div>
            <div className="action" onClick={() => setMode("coding")}>💻 {sidebarOpen && <span>Coding</span>}</div>
            <div className="action" onClick={() => setMode("study")}>🎓 {sidebarOpen && <span>Study</span>}</div>
          </div>
        </div>

        <div className="main">
          <div className="pomodoro">
            <h1>{isBreak ? "Doomscroll time" : "Lock in !"}</h1>

          <FlipClock time={time} />
            
      
            <div className="controls">
              <button onClick={() => setIsRunning(true)}>Start</button>
              <button onClick={() => setIsRunning(false)}>Pause</button>
              <button onClick={() => {
                setTime(1500);
                setIsRunning(false);
                setIsBreak(false);
              }}>
                Reset
              </button>
            </div>
            <div className="sound-controls">
  <p>Focus Sounds 🎧</p>

  <button onClick={() => playSound("/sounds/rain.mp3")}>
    🌧
  </button>

  <button onClick={() => playSound("/sounds/heater.mp3")}>
    🔥
  </button>

  <button onClick={() => playSound("/sounds/whitenoise.mp3")}>
    🎧
  </button>

  <button onClick={stopSound}>
    Stop
  </button>
</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className={`sidebar 
  ${sidebarOpen ? "open" : ""} 
  ${isMobile && !sidebarOpen ? "mini" : ""}
`}>
        <div className="top">
          <div className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <BsLayoutSidebar />
          </div>
          {sidebarOpen && <div className="logo">Kiin AI</div>}
        </div>

        <div className="actions">
          <div className="action" onClick={newChat}>
            <PiChatCircle />
            {sidebarOpen && <span>New chat</span>}
          </div>

          <div className="action" onClick={() => setMode("normal")}>🧠 {sidebarOpen && <span>Normal</span>}</div>
          <div className="action" onClick={() => setMode("coding")}>💻 {sidebarOpen && <span>Coding</span>}</div>
          <div className="action" onClick={() => setMode("study")}>🎓 {sidebarOpen && <span>Study</span>}</div>
        </div>

        <div className="chat-list">
          {chats.map((c) => (
            <div key={c.id} className="chat-item">
              <span className="chat-title" onClick={() => setCurrentChatId(c.id)}>
                {sidebarOpen && c.title}
              </span>
              <button className="delete-btn" onClick={() => deleteChat(c.id)}>
                <GoTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="profile" onClick={logout}>
          <IoIosLogOut />
          {sidebarOpen && <span>Logout</span>}
        </div>
      </div>

      <div className="main">
        {currentChat.messages.length === 0 ? (
          <div className="empty-state">
            <h1>What ki-in I do for you today?</h1>

            <div className="center-input">
              <input
                id="fileUploadTop"
                type="file"
                accept=".txt"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />

              <div className="upload-btn" onClick={() => document.getElementById("fileUploadTop").click()}>
                <BsPaperclip />
              </div>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything"
              />

              <button onClick={sendMessage}>↑</button>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-box">
              {currentChat.messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.role === "assistant"
  ? msg.content === "loading"
    ? <div className="loading"><span></span><span></span><span></span></div>
    : (() => {
        let content = msg.content;

        // 🔥 FIX: extract JSON reply
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.reply) content = parsed.reply;
        } catch (e) {
          // not JSON, ignore
        }

        return (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        );
      })()
  : msg.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="input-box">
              <input
                id="fileUploadBottom"
                type="file"
                accept=".txt"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />

              <div className="upload-btn" onClick={() => document.getElementById("fileUploadBottom").click()}>
                <BsPaperclip />
              </div>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything..."
              />

              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;