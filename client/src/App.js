import { useState, useEffect } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";

// 🔥 Firebase
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where
} from "firebase/firestore";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

// Icons
import { FiMenu, FiPlus, FiMessageSquare, FiLogOut } from "react-icons/fi";

function App() {
  // 💬 Chat state
  const [input, setInput] = useState("");
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loading, setLoading] = useState(false);

  // 👤 Auth state
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // 📂 Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 🔐 Track auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthError(""); // Clear any auth errors on state change
    });
    return () => unsubscribe();
  }, []);

  // 🧠 Load chats (ONLY user's chats)
  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const q = query(
        collection(db, "chats"),
        where("userId", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);

      const loadedChats = [];
      querySnapshot.forEach((docSnap) => {
        loadedChats.push({ id: docSnap.id, ...docSnap.data() });
      });

      setChats(loadedChats);

      if (loadedChats.length > 0) {
        setCurrentChatId(loadedChats[0].id);
      }
    };

    fetchChats();
  }, [user]);

  // 💬 Current messages
  const messages =
    chats.find((chat) => chat.id === currentChatId)?.messages || [];

  // ➕ Create new chat
  const createNewChat = async () => {
    const docRef = await addDoc(collection(db, "chats"), {
      title: "New Chat",
      messages: [],
      userId: user.uid,
      createdAt: new Date(),
    });

    const newChat = {
      id: docRef.id,
      title: "New Chat",
      messages: []
    };

    setChats([...chats, newChat]);
    setCurrentChatId(docRef.id);
  };

  // 🚀 Send message
  const sendMessage = async () => {
    if (!input.trim() || !currentChatId) return;

    const newMessages = [
      ...messages,
      { role: "user", content: input }
    ];

    let chatTitle = chats.find(c => c.id === currentChatId)?.title;

    if (!chatTitle || chatTitle === "New Chat") {
      chatTitle = input.slice(0, 30);
    }

    setInput("");

    setChats(
      chats.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, messages: newMessages, title: chatTitle }
          : chat
      )
    );

    try {
      setLoading(true);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      const updatedMessages = [
        ...newMessages,
        {
          role: "assistant",
          content: data.reply?.content || "No response"
        }
      ];

      setChats(
        chats.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, messages: updatedMessages, title: chatTitle }
            : chat
        )
      );

      await updateDoc(doc(db, "chats", currentChatId), {
        messages: updatedMessages,
        title: chatTitle
      });

    } catch (error) {
      console.error(error);
      setAuthError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Auth functions
  const handleSignup = async () => {
    try {
      setAuthError("");
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogin = async () => {
    try {
      setAuthError("");
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // 🔐 PROFESSIONAL LOGIN SCREEN
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>
            Welcome to <span>zenGPT</span> 🌿
          </h2>

          {/* Error Message */}
          {authError && (
            <div className="auth-error">
              {authError}
            </div>
          )}

          {/* Email Input */}
          <div className="auth-input-group">
            <label>Email</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">📧</span>
              <input
                type="email"
                placeholder="your@email.com"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="auth-input-group">
            <label>Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">🔒</span>
              <input
                type="password"
                placeholder="••••••••"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="auth-forgot">
            <a href="#" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </div>

          {/* Buttons */}
          <div className="auth-buttons">
            <button className="auth-btn login" onClick={handleLogin}>
              Log in
            </button>
            
            {/* Divider */}
            <div className="auth-divider">
              <span className="auth-divider-line"></span>
              <span>or</span>
              <span className="auth-divider-line"></span>
            </div>

            <button className="auth-btn signup" onClick={handleSignup}>
              Create new account
            </button>
          </div>

          {/* Social Login */}
          <div className="auth-social">
            <button className="auth-social-btn" onClick={(e) => e.preventDefault()}>G</button>
            <button className="auth-social-btn" onClick={(e) => e.preventDefault()}>f</button>
            <button className="auth-social-btn" onClick={(e) => e.preventDefault()}>in</button>
          </div>

          {/* Terms */}
          <div className="auth-terms">
            By continuing, you agree to our <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a> and <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
          </div>
        </div>
      </div>
    );
  }

  // 💬 MAIN CHAT INTERFACE (when logged in)
  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* 🧱 SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>

        <button
          className="toggle-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <FiMenu />
        </button>

        <button className="new-chat" onClick={createNewChat}>
          {sidebarOpen ? (
            <>
              <FiPlus /> New Chat
            </>
          ) : (
            <FiPlus />
          )}
        </button>

        <div className="chat-list">
          {sidebarOpen && <p className="chat-title">Your chats</p>}

          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`chat-item ${
                chat.id === currentChatId ? "active" : ""
              }`}
            >
              {sidebarOpen
                ? (chat.title || "New Chat")
                : <FiMessageSquare />}
            </div>
          ))}
        </div>

        {/* Logout */}
        <button className="logout-btn" onClick={handleLogout}>
          {sidebarOpen ? (
            <>
              <FiLogOut /> Logout
            </>
          ) : (
            <FiLogOut />
          )}
        </button>
      </div>

      {/* 💬 CHAT AREA */}
      <div className="app">
        <h1>zenGPT 🌿</h1>

        <div className="chat-box">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.role === "user" ? "user" : "bot"
              }`}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ))}

          {loading && (
            <div className="message bot typing">Thinking...</div>
          )}
        </div>

        <div className="input-box">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask anything..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;