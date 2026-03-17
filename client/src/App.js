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
  where,
  orderBy,
  deleteDoc
} from "firebase/firestore";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

// Icons
import { FiMenu, FiPlus, FiMessageSquare, FiLogOut, FiTrash2 } from "react-icons/fi";

function App() {
  // 💬 Chat state
  const [input, setInput] = useState("");
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

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
      setAuthError("");
    });
    return () => unsubscribe();
  }, []);

  // 🧠 Load chats (ONLY user's chats)
  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      try {
        const q = query(
          collection(db, "chats"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);

        const loadedChats = [];
        querySnapshot.forEach((docSnap) => {
          loadedChats.push({ id: docSnap.id, ...docSnap.data() });
        });

        setChats(loadedChats);

        if (loadedChats.length > 0) {
          setCurrentChatId(loadedChats[0].id);
        } else {
          // Create a default chat if none exists
          createNewChat();
        }
      } catch (error) {
        console.error("Error fetching chats:", error);
        setAuthError("Failed to load chats");
      }
    };

    fetchChats();
  }, [user]);

  // 💬 Current messages
  const messages = chats.find((chat) => chat.id === currentChatId)?.messages || [];

  // ➕ Create new chat
  const createNewChat = async () => {
    if (!user) return;

    try {
      const newChat = {
        title: "New Chat",
        messages: [],
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, "chats"), newChat);

      setChats(prev => [{ id: docRef.id, ...newChat }, ...prev]);
      setCurrentChatId(docRef.id);
    } catch (error) {
      console.error("Error creating chat:", error);
      setAuthError("Failed to create new chat");
    }
  };

  // 🗑️ Delete chat
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    try {
      await deleteDoc(doc(db, "chats", chatId));
      
      const updatedChats = chats.filter(chat => chat.id !== chatId);
      setChats(updatedChats);
      
      if (currentChatId === chatId) {
        setCurrentChatId(updatedChats[0]?.id || null);
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      setAuthError("Failed to delete chat");
    }
  };

  // 🚀 Send message
  const sendMessage = async () => {
    if (!input.trim() || !currentChatId || loading) return;

    const userMessage = input.trim();
    const newMessages = [
      ...messages,
      { role: "user", content: userMessage, timestamp: new Date().toISOString() }
    ];

    // Update chat title if it's a new chat
    let chatTitle = chats.find(c => c.id === currentChatId)?.title;
    if (!chatTitle || chatTitle === "New Chat") {
      chatTitle = userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
    }

    // Clear input and update UI immediately
    setInput("");
    setApiError("");

    // Optimistic update
    setChats(prev =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, messages: newMessages, title: chatTitle }
          : chat
      )
    );

    try {
      setLoading(true);

      // IMPORTANT: Use your Render backend URL
      // Replace this with your actual Render URL
      const API_URL = import.meta.env.PROD 
        ? "https://zengpt-j99f.onrender.com/" // ⚠️ REPLACE with your actual Render URL
        : import.meta.env.VITE_API_URL || "http://localhost:5000";

      console.log("Sending request to:", `${API_URL}/chat`);

      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          messages: messages.concat({ role: "user", content: userMessage })
        }),
      });

      // Check if response is OK
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      // Parse response
      const data = await res.json();
      console.log("✅ Backend response:", data);

      // Add AI response
      const updatedMessages = [
        ...newMessages,
        {
          role: "assistant",
          content: data.reply?.content || "I received your message but couldn't generate a response.",
          timestamp: new Date().toISOString()
        }
      ];

      // Update state with AI response
      setChats(prev =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, messages: updatedMessages, title: chatTitle }
            : chat
        )
      );

      // Save to Firestore
      await updateDoc(doc(db, "chats", currentChatId), {
        messages: updatedMessages,
        title: chatTitle,
        updatedAt: new Date()
      });

    } catch (error) {
      console.error("❌ Send message error:", error);
      
      // Show error in chat
      const errorMessages = [
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ Error: ${error.message}. Please try again.`,
          timestamp: new Date().toISOString(),
          isError: true
        }
      ];
      
      setChats(prev =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, messages: errorMessages }
            : chat
        )
      );

      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Auth functions
  const handleSignup = async () => {
    try {
      setAuthError("");
      await createUserWithEmailAndPassword(auth, email, password);
      setEmail("");
      setPassword("");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogin = async () => {
    try {
      setAuthError("");
      await signInWithEmailAndPassword(auth, email, password);
      setEmail("");
      setPassword("");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setChats([]);
      setCurrentChatId(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 🔐 Login Screen
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card minimal">
          <h2>✨ kiin AI</h2>
          <p className="auth-subtitle">Sign in to continue</p>

          {authError && (
            <div className="auth-error">
              {authError.includes("Firebase") 
                ? "Authentication error. Please check your Firebase configuration."
                : authError}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />

          <input
            type="password"
            placeholder="Password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
          />

          <button 
            className="auth-btn primary" 
            onClick={handleLogin}
            disabled={!email || !password}
          >
            Log in
          </button>

          <button 
            className="auth-btn secondary" 
            onClick={handleSignup}
            disabled={!email || !password}
          >
            Create account
          </button>

          <div className="auth-footer">
            <small>Demo: test@example.com / password123</small>
          </div>
        </div>
      </div>
    );
  }

  // 💬 Main Chat Interface
  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <button
          className="toggle-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
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

          {chats.length === 0 ? (
            <div className="no-chats">
              {sidebarOpen ? "No chats yet. Start one!" : "..."}
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setCurrentChatId(chat.id)}
                className={`chat-item ${chat.id === currentChatId ? "active" : ""}`}
              >
                {sidebarOpen ? (
                  <div className="chat-item-content">
                    <FiMessageSquare className="chat-icon" />
                    <span className="chat-title-text">
                      {chat.title || "New Chat"}
                    </span>
                    <button
                      className="delete-chat-btn"
                      onClick={(e) => deleteChat(chat.id, e)}
                      title="Delete chat"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ) : (
                  <FiMessageSquare />
                )}
              </div>
            ))
          )}
        </div>

        {/* User info and logout */}
        <div className="sidebar-footer">
          {sidebarOpen && (
            <div className="user-info">
              <span className="user-email">{user.email}</span>
            </div>
          )}
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
      </div>

      {/* Chat Area */}
      <div className="app">
        <h1>kiin AI</h1>

        {apiError && (
          <div className="api-error">
            ⚠️ {apiError}
          </div>
        )}

        <div className="chat-box">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <h2>Welcome to kiin AI! 👋</h2>
              <p>Start a conversation by typing a message below.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${msg.role === "user" ? "user" : "bot"} ${msg.isError ? "error" : ""}`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ))
          )}

          {loading && (
            <div className="message bot typing">
              <span className="typing-dots">Thinking</span>
            </div>
          )}
        </div>

        <div className="input-box">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything..."
            disabled={loading || !currentChatId}
          />
          <button 
            onClick={sendMessage}
            disabled={loading || !input.trim() || !currentChatId}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;