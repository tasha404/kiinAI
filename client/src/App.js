import { useState, useEffect } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
// 🔥 Firebase
import { auth, db } from "./firebase";
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
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const API_URL = "https://kiinai-production.up.railway.app/chat";

function App() {
  const [user, setUser] = useState(null);

  // 🔐 auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 💬 chat
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [chatId, setChatId] = useState(null);

  // 📁 sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState([]);
 const [loading, setLoading] = useState(false);
  // 🔐 auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadHistory(u.uid);
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
    setChat([]);
  };

  // 📂 LOAD SIDEBAR HISTORY
  const loadHistory = async (uid) => {
    const q = query(collection(db, "sessions"), where("uid", "==", uid));
    const snap = await getDocs(q);

    let arr = [];
    snap.forEach((doc) => {
      arr.push({ id: doc.id, ...doc.data() });
    });

    setHistory(arr);
  };

  // 📂 LOAD ONE CHAT
  const loadChat = async (id) => {
    const q = query(
  collection(db, "messages"),
  where("chatId", "==", id),
  orderBy("createdAt", "asc")
);

    const snap = await getDocs(q);

    let msgs = [];
snap.forEach((doc) => {
  const data = doc.data();
  msgs.push(data);
});

    setChat(msgs);
    setChatId(id);
  };

  // 🆕 NEW CHAT
  const newChat = () => {
    setChat([]);
    setChatId(null);
  };

  // ❌ DELETE CHAT
  const deleteChat = async (id) => {
    await deleteDoc(doc(db, "sessions", id));
    loadHistory(user.uid);
    if (chatId === id) {
      setChat([]);
      setChatId(null);
    }
  };

  // 🚀 SEND MESSAGE
  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { role: "user", content: message };
const updatedChat = [...chat, userMsg];

setChat(updatedChat);

    setMessage("");

setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [...chat, { role: "user", content: message }] }),
      });

      const data = await res.json();


const aiMsg = { role: "assistant", content: data.reply };
setChat((prev) => [...prev, aiMsg]);

      let currentChatId = chatId;

      // 🆕 create new session if needed
      if (!currentChatId) {
        const docRef = await addDoc(collection(db, "sessions"), {
          uid: user.uid,
          title: message.slice(0, 20),
          createdAt: serverTimestamp(),
        });

        currentChatId = docRef.id;
        setChatId(currentChatId);
        loadHistory(user.uid);
      }

      // 💾 save messages
      await addDoc(collection(db, "messages"), {
        chatId: currentChatId,
        role: "user",
        content: message,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "messages"), {
        chatId: currentChatId,
        role: "assistant",
        content: data.reply,
        createdAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      alert("Server error");
      setLoading(false);
    }

  };

  // 🔐 AUTH PAGE
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>💬 ZenGPT</h2>

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

    {sidebarOpen && <div className="logo">Zen</div>}
  </div>

  {/* ACTIONS */}
  <div className="actions">
    <div className="action" onClick={newChat}>
      ✏️ {sidebarOpen && <span>New chat</span>}
    </div>

  </div>

  {/* CHATS */}
  <div className="chat-list">
    {history.map((h) => (
      <div
  key={h.id}
  className={`chat-row ${chatId === h.id ? "active" : ""}`}
>
  <span
  onClick={() => {
    console.log("CLICKED CHAT:", h.id);
    loadChat(h.id);
  }}
>
    {sidebarOpen ? h.title : "💬"}
  </span>

  {sidebarOpen && (
    <button onClick={() => deleteChat(h.id)}>⋯</button>
  )}
</div>
    ))}
  </div>

  {/* PROFILE */}
  <div className="profile" onClick={logout}>
  {sidebarOpen && <span>Logout</span>}
</div>
</div>

      {/* 💬 CHAT */}
      <div className="main">
  {chat.length === 0 ? (
    <div className="empty-state">
      <h1>What can I help with?</h1>

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

  {loading && (
  <div className="message assistant loading">
    <span></span><span></span><span></span>
  </div>
)}
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