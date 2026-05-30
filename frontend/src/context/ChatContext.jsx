import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

export const ChatContext = createContext();

const API = import.meta.env.VITE_API_URL;

export const ChatProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activePartner, setActivePartner] = useState(null); // { id, name, avatar, role }
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchConversations = async () => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get(`${API}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(res.data);
      const totalUnread = res.data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setUnreadCount(totalUnread);
    } catch (err) {
      console.error('Lỗi tải cuộc hội thoại trong Context:', err);
    }
  };

  // Poll conversations every 5 seconds if user is logged in
  useEffect(() => {
    if (user) {
      fetchConversations();
      const interval = setInterval(fetchConversations, 5000);
      return () => clearInterval(interval);
    } else {
      setConversations([]);
      setUnreadCount(0);
      setActivePartner(null);
      setIsChatOpen(false);
    }
  }, [user]);

  // Open chat with a specific partner
  const openChatWith = (partner) => {
    // Normalize partner properties
    const id = partner.id || partner.partnerId || partner.id_User;
    const name = partner.fullName || partner.partnerName || partner.name || partner.name_Restaurant;
    const avatar = partner.avatar || partner.partnerAvatar || partner.logo;
    const role = partner.role || partner.partnerRole;

    setActivePartner({ id, name, avatar, role });
    setIsChatOpen(true);
  };

  return (
    <ChatContext.Provider value={{
      isChatOpen,
      setIsChatOpen,
      activePartner,
      setActivePartner,
      openChatWith,
      conversations,
      unreadCount,
      fetchConversations
    }}>
      {children}
    </ChatContext.Provider>
  );
};
