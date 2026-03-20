import { useState, useEffect, useRef  } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { auth } from "./firebase";

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
  const [chat, setChat] = useState([]);

  // 📁 sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 🔐 auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setChat([]);
    });
    return () => unsub();
  }, []);

useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [chat]);

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
    setChat([]);
  };





  // 🆕 NEW CHAT
  const newChat = () => {
  setChat([]);
};

  // 🚀 SEND MESSAGE
  const sendMessage = async () => {
  if (!message.trim()) return;

  const userMsg = { role: "user", content: message };
  const updatedChat = [...chat, userMsg];

  setChat(updatedChat);
  setMessage("");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: updatedChat }),
    });

    const data = await res.json();

    const aiMsg = { role: "assistant", content: data.reply };
    setChat((prev) => [...prev, aiMsg]);
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
          <h2>KIIN</h2>

          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button onClick={login}>Login</button>
          <button onClick={signup}>Sign Up</button>
        </div>
      </div>
    );
  }

  // 💬 MAIN APP
  return (
    <div className="app">
      {/* 📁 SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
  {/* TOP BAR */}
  <div className="top">
    <div
      className="menu-btn"
      onClick={() => setSidebarOpen(!sidebarOpen)}
    >
      ☰
    </div>

    {sidebarOpen && <div className="logo">Kiin AI</div>}
  </div>

  {/* ACTIONS */}
  <div className="actions">
    <div className="action" onClick={newChat}>
      ✏️ {sidebarOpen && <span>New chat</span>}
    </div>

  </div>

  {/* CHATS */}
  

  {/* PROFILE */}
  <div className="profile" onClick={logout}>
  {sidebarOpen && <span>Logout</span>}
</div>
</div>

      {/* 💬 CHAT */}
      <div className="main">
  {chat.length === 0 ? (
    <div className="empty-state">
      <h1>What ki-in I do for you today ?</h1>

      <div className="center-input">
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
  {chat.map((msg, i) => (
    <div key={i} className={`message ${msg.role}`}>
      {msg.role === "assistant" ? (
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      ) : (
        msg.content
      )}
    </div>
  ))}

  <div ref={bottomRef} />
</div>

      <div className="input-box">
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