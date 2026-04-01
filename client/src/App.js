import { useState, useEffect, useRef } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { auth } from "./firebase";
import { IoIosLogOut } from "react-icons/io";
import { PiChatCircle } from "react-icons/pi";
import { BsLayoutSidebar } from "react-icons/bs";
import { GoTrash } from "react-icons/go";
import { BsPaperclip } from "react-icons/bs";

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

  // 📂 file context (PER CHAT)
  const [fileContext, setFileContext] = useState({});

  // 📁 sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  // 📂 FILE UPLOAD
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
      [currentChatId]: {
        text,
        name: file.name
      }
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
      // 🧠 inject file context
      const context = fileContext[currentChatId]?.text;

      const finalMessages = context
        ? [
            {
              role: "system",
              content: `You MUST answer using this file context:\n\n${context}`
            },
            ...updatedMessages
          ]
        : updatedMessages;

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: finalMessages }),
      });

      const data = await res.json();

      let newTitle = null;
      if (isFirstMessage) {
        newTitle = await generateAITitle(updatedMessages);
      }

      setChats(prev =>
        prev.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                title: newTitle || chat.title,
                messages: [
                  ...updatedMessages,
                  { role: "assistant", content: data.reply }
                ]
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

  // 💬 MAIN APP
  return (
    <div className="app">

      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
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

      {/* MAIN */}
      <div className="main">

        {/* FILE INDICATOR */}
        {fileContext[currentChatId] && (
          <div className="file-indicator">
            📄 {fileContext[currentChatId].name}
          </div>
        )}

        {currentChat.messages.length === 0 ? (
          <div className="empty-state">
            <h1>What ki-in I do for you today?</h1>

            <div className="center-input">

  {/* FILE BUTTON */}
  <input
  id="fileUpload"
  type="file"
  accept=".txt"
  style={{ display: "none" }}
  onChange={handleFileUpload}
/>

<div
  className="upload-btn"
  onClick={() => document.getElementById("fileUpload").click()}
>
  <BsPaperclip />
</div>

  {/* INPUT */}
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
                  {msg.role === "assistant" ? (
                    msg.content === "loading" ? (
                      <div className="loading">
                        <span></span><span></span><span></span>
                      </div>
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="input-box">
              <input
  id="fileUpload"
  type="file"
  accept=".txt"
  style={{ display: "none" }}
  onChange={handleFileUpload}
/>

<div
  className="upload-btn"
  onClick={() => document.getElementById("fileUpload").click()}
>
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