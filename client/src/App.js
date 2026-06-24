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
import { HiOutlineComputerDesktop } from "react-icons/hi2";
import { GiBrain } from "react-icons/gi";
import { TbBooks } from "react-icons/tb";
import FlipClock from "./FlipClock";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";

const API_URL = "https://zengpt-backend.kiinbackend.workers.dev/chat";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const bottomRef = useRef(null);
  const [mode, setMode] = useState("normal");

  // 🔐 auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 🍅 Pomodoro
  const [time, setTime] = useState(1500);
  const [audio, setAudio] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const timerRef = useRef(null);

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
          const newChatObj = { title: "New Chat", messages: [] };
          const docRef = await addDoc(chatsRef, newChatObj);
          setChats([{ id: docRef.id, ...newChatObj }]);
          setCurrentChatId(docRef.id);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 💾 Save chats to Firestore
  useEffect(() => {
    if (!user) return;
    const saveChats = async () => {
      for (const chat of chats) {
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
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔑 Login / Signup / Logout
  const login = async () => {
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) { alert(err.message); }
  };
  const signup = async () => {
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (err) { alert(err.message); }
  };
  const logout = async () => {
    await signOut(auth);
    const newId = String(Date.now());
    setChats([{ id: newId, title: "New Chat", messages: [] }]);
    setCurrentChatId(newId);
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

  // 💬 New / Delete chat
  const newChat = async () => {
    const current = chats.find(c => c.id === currentChatId);
    if (current && current.messages.length === 0 && mode !== "study") {
      setCurrentChatId(current.id);
      return;
    }
    const chatsRef = collection(db, "users", user.uid, "chats");
    const newChatObj = { title: "New Chat", messages: [] };
    const docRef = await addDoc(chatsRef, newChatObj);
    setChats(prev => [...prev, { id: docRef.id, ...newChatObj }]);
    setCurrentChatId(docRef.id);
    if (mode === "study") setMode("normal");
  };

  const deleteChat = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "chats", id));
    const filtered = chats.filter(c => c.id !== id);
    if (filtered.length === 0) {
      newChat();
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
  };
  const stopSound = () => {
    if (audio) { audio.pause(); setAudio(null); }
  };

  // 🚀 Send message
  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { role: "user", content: message };
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
      if (mode === "coding") systemPrompt = "You are a coding assistant. Be concise and technical.";
      else if (mode === "study") systemPrompt = "Explain step-by-step in a simple way like a tutor.";

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

  // ─── SHARED SIDEBAR ───────────────────────────────────────────
  const Sidebar = () => (
    <div className={`sidebar ${sidebarOpen ? "open" : ""} ${isMobile && !sidebarOpen ? "mini" : ""}`}>
      <div className="top">
        <div className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>
          <BsLayoutSidebar />
        </div>
        {sidebarOpen && <div className="logo">Kiin AI</div>}
      </div>

      <div className="actions">
        <div className="action" onClick={newChat}>
          <PiChatCircle />
          {sidebarOpen && <span>New chat</span>}
        </div>
      </div>

      {mode !== "study" && (
        <div className="chat-list">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`chat-item ${c.id === currentChatId ? "active" : ""}`}
              onClick={() => selectChat(c.id)}
            >
              {sidebarOpen && <span className="chat-title">{c.title}</span>}
              {sidebarOpen && (
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}>
                  <GoTrash />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mode-switcher">
        <div className={`action ${mode === "normal" ? "active-mode" : ""}`} onClick={() => setMode("normal")}>
          <GiBrain /> {sidebarOpen && <span>Normal</span>}
        </div>
        <div className={`action ${mode === "coding" ? "active-mode" : ""}`} onClick={() => setMode("coding")}>
          <HiOutlineComputerDesktop /> {sidebarOpen && <span>Coding</span>}
        </div>
        <div className={`action ${mode === "study" ? "active-mode" : ""}`} onClick={() => setMode("study")}>
          <TbBooks /> {sidebarOpen && <span>Study</span>}
        </div>
      </div>

      <div className="profile" onClick={logout}>
        <IoIosLogOut />
        {sidebarOpen && <span>Logout</span>}
      </div>
    </div>
  );

  // ─── AUTH PAGE ────────────────────────────────────────────────
  if (authLoading) return null;

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2 style={{ fontFamily: "CuteFont" }}>KIIn</h2>
          <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={login}>Login</button>
          <button onClick={signup}>Sign Up</button>
        </div>
      </div>
    );
  }

  // ─── MAIN APP ─────────────────────────────────────────────────
  return (
    <div className="app">
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar />

      <div className="main">
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
              <button onClick={() => playSound("/sounds/rain.mp3")}>🌧</button>
              <button onClick={() => playSound("/sounds/heater.mp3")}>🔥</button>
              <button onClick={() => playSound("/sounds/whitenoise.mp3")}>🎧</button>
              <button onClick={stopSound}>Stop</button>
            </div>
          </div>
        )}

        {mode !== "study" && (
          <>
            {currentChat.messages.length === 0 ? (
              <div className="empty-state">
                <h1>What ki-in I do for you today?</h1>
                <div className="center-input">
                  <input id="fileUploadTop" type="file" accept=".txt" style={{ display: "none" }} onChange={handleFileUpload} />
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
                          ? <div className="loading"><span /><span /><span /></div>
                          : (() => {
                              let content = msg.content;
                              try { const p = JSON.parse(msg.content); if (p.reply) content = p.reply; } catch {}
                              return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
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
                  <button onClick={sendMessage}>Send</button>
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