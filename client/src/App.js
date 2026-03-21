import { useState, useEffect, useRef  } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { auth } from "./firebase";
import { IoIosLogOut } from "react-icons/io";
import { PiChatCircle } from "react-icons/pi";
import { BsLayoutSidebar } from "react-icons/bs";
import { GoTrash } from "react-icons/go";


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

  // 📁 sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 🔐 auth listener
  useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (u) {
      const newId = Date.now();
      setChats([{ id: newId, messages: [] }]);
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
  setChats([{ id: newId, messages: [] }]);
  setCurrentChatId(newId);
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
    setChats([{ id: newId, messages: [] }]);
    setCurrentChatId(newId);
  } else {
    setChats(filtered);
    setCurrentChatId(filtered[0].id);
  }
};

const generateTitle = (messages) => {
  // only take USER messages
  const userText = messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join(" ")
    .toLowerCase();

  // remove useless words
  const cleaned = userText
    .replace(/\b(hi|hello|hey|ok|thanks|thank you)\b/gi, "")
    .trim();

  if (!cleaned || cleaned.length < 5) return "New Chat";

  // shorten nicely
  return cleaned.slice(0, 30) + "...";
};

const generateAITitle = async (messages) => {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "Summarize this conversation in 3-5 short words only."
          },
          ...messages.slice(0, 3) // only first few msgs
        ],
      }),
    });

    const data = await res.json();

    return data.reply || "New Chat";
  } catch (err) {
    console.error(err);
    return "New Chat";
  }
};

  // 🚀 SEND MESSAGE
const sendMessage = async () => {
  if (!message.trim()) return;

  const userMsg = { role: "user", content: message };
  const updatedMessages = [...currentChat.messages, userMsg];
  const isFirstMessage = currentChat.messages.length === 0;

  // 1️⃣ show loading
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
    // 2️⃣ fetch response
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: updatedMessages }),
    });

    const data = await res.json();

    // 3️⃣ generate AI title (only first message)
    let newTitle = null;
    if (isFirstMessage) {
      newTitle = await generateAITitle(updatedMessages);
    }

    // 4️⃣ replace loading with real response
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
      <BsLayoutSidebar />
    </div>

    {sidebarOpen && <div className="logo">Kiin AI</div>}
  </div>

  {/* ACTIONS */}
  <div className="actions">
    <div className="action" onClick={newChat}>
      <PiChatCircle />
      {sidebarOpen && <span>New chat</span>}
    </div>



  </div>

 <div className="chat-list">
  {chats.map((c, index) => (
   <div key={c.id} className="chat-item">
  <span
    className="chat-title"
    onClick={() => setCurrentChatId(c.id)}
  >
    {sidebarOpen && c.title}
  </span>

  <button
    className="delete-btn"
    onClick={() => deleteChat(c.id)}
  >
    <GoTrash />
  </button>
</div>
  ))}
</div>
  

{/* profile */} 
  <div className="profile" onClick={logout}>
  <IoIosLogOut />
  {sidebarOpen && <span>Logout</span>}
</div>
</div>

      {/* 💬 CHAT */}
      <div className="main">
  {currentChat.messages.length === 0 ? (
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
  {currentChat.messages.map((msg, i) => (
    <div key={i} className={`message ${msg.role}`}>
      {msg.role === "assistant" ? (
  msg.content === "loading" ? (
    <div className="loading">
      <span></span>
      <span></span>
      <span></span>
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