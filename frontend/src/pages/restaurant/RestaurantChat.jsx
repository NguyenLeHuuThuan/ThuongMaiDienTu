import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Send, Search, MessageSquare, Plus, X, User } from 'lucide-react';
import { getImageUrl } from '../../utils/imageHelper';

const API = import.meta.env.VITE_API_URL;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const RestaurantChat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activePartner, setActivePartner] = useState(null); // { id, name, avatar, role }
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Contacts
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');

  const messagesEndRef = useRef(null);
  const autoSelectCheckedRef = useRef(false);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch active conversations
  const fetchConversations = async (silent = false) => {
    try {
      const res = await axios.get(`${API}/restaurant/chat/conversations`, { headers });
      setConversations(res.data);
    } catch (err) {
      console.error('Lỗi tải cuộc hội thoại:', err);
    }
  };

  // Fetch chronological messages with active partner
  const fetchMessages = async (partnerId, silent = false) => {
    try {
      const res = await axios.get(`${API}/restaurant/chat/messages/${partnerId}`, { headers });
      setMessages(res.data);
      
      // Mark as read
      await axios.put(`${API}/restaurant/chat/messages/${partnerId}/read`, {}, { headers });
      
      if (!silent) {
        scrollToBottom();
      }
    } catch (err) {
      console.error('Lỗi tải tin nhắn:', err);
    }
  };

  // Fetch list of contacts from recent orders
  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API}/restaurant/chat/contacts`, { headers });
      setContacts(res.data);
    } catch (err) {
      console.error('Lỗi tải danh sách liên hệ:', err);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchConversations();
    fetchContacts();
  }, []);

  // Auto-select conversation passed from location state (e.g. Profile chat widget click)
  useEffect(() => {
    if (location.state?.partnerName && !autoSelectCheckedRef.current) {
      if (conversations.length > 0) {
        const match = conversations.find(c => c.partnerName === location.state.partnerName);
        if (match) {
          autoSelectCheckedRef.current = true;
          handleSelectPartner(match);
          navigate(location.pathname, { replace: true, state: {} });
        } else if (contacts.length > 0) {
          const matchContact = contacts.find(c => c.fullName === location.state.partnerName);
          if (matchContact) {
            autoSelectCheckedRef.current = true;
            handleStartChatWithContact(matchContact);
            navigate(location.pathname, { replace: true, state: {} });
          }
        }
      }
    }
  }, [conversations, contacts, location.state, navigate]);

  // Poll for new messages/conversations every 4 seconds to give real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      if (activePartner) {
        fetchMessages(activePartner.partnerId, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activePartner]);

  // Scroll messages panel to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // When active partner changes, load their messages
  const handleSelectPartner = (partner) => {
    setActivePartner(partner);
    fetchMessages(partner.partnerId);
    // Mark as read in local state immediately to avoid latency
    setConversations(prev =>
      prev.map(c => c.partnerId === partner.partnerId ? { ...c, unreadCount: 0 } : c)
    );
  };

  // Send message handler
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activePartner) return;

    const messageToSend = inputText.trim();
    setInputText('');

    try {
      const res = await axios.post(
        `${API}/restaurant/chat/messages`,
        { receiverId: activePartner.partnerId, messageText: messageToSend },
        { headers }
      );
      
      // Add message locally for instant UI update
      setMessages(prev => [...prev, res.data.data]);
      scrollToBottom();
      
      // Refresh conversations list to update snippet
      fetchConversations(true);
    } catch (err) {
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  // Initiate chat with a contact from the orders dropdown
  const handleStartChatWithContact = (contact) => {
    const existing = conversations.find(c => c.partnerId === contact.id);
    
    const partnerData = {
      partnerId: contact.id,
      partnerName: contact.fullName,
      partnerAvatar: contact.avatar,
      partnerRole: contact.role
    };

    setActivePartner(partnerData);
    setShowContacts(false);
    setContactSearchTerm('');

    if (existing) {
      fetchMessages(contact.id);
    } else {
      setMessages([]); // Brand new conversation
    }
  };

  // Helper: Format message time
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Helper: Format long date time for bubble hover
  const formatDateTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter conversations based on sidebar search
  const filteredConversations = conversations.filter(c =>
    c.partnerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter contacts in dropdown search
  const filteredContacts = contacts.filter(c =>
    c.fullName?.toLowerCase().includes(contactSearchTerm.toLowerCase())
  );

  return (
    <div className="res-chat-container">
      {/* Sidebar List */}
      <div className="res-chat-sidebar">
        <div className="res-chat-sidebar-header">
          <div className="res-chat-sidebar-title">
            <span>Trò chuyện</span>
            <button 
              className="res-btn res-btn-secondary res-btn-sm" 
              style={{ padding: '6px 8px', borderRadius: '50%', minWidth: 32, height: 32 }}
              onClick={() => setShowContacts(!showContacts)}
              title="Tin nhắn mới"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="res-chat-search">
            <Search className="res-chat-search-icon" size={16} />
            <input 
              type="text" 
              placeholder="Tìm kiếm cuộc trò chuyện..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Contacts Dropdown Panel */}
        {showContacts && (
          <div className="res-chat-contacts-dropdown">
            <div className="res-chat-contacts-header">
              <span>Bắt đầu trò chuyện</span>
              <button 
                onClick={() => setShowContacts(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <input
                className="res-form-input"
                style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8 }}
                placeholder="Tìm khách hàng/shipper..."
                value={contactSearchTerm}
                onChange={(e) => setContactSearchTerm(e.target.value)}
              />
            </div>
            <div className="res-chat-contacts-list">
              {filteredContacts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: 16 }}>
                  Không tìm thấy liên hệ nào từ đơn hàng
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <div 
                    key={contact.id} 
                    className="res-contact-item"
                    onClick={() => handleStartChatWithContact(contact)}
                  >
                    {contact.avatar ? (
                      <img 
                        src={getImageUrl(contact.avatar, 'avatar')} 
                        alt={contact.fullName}
                        className="res-chat-avatar"
                        style={{ width: 32, height: 32 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="res-chat-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {contact.fullName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="res-contact-name">{contact.fullName}</div>
                      <div className="res-contact-role">{contact.role === 'driver' ? 'Tài xế' : 'Khách hàng'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="res-chat-list">
          {filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '32px 16px', fontSize: 13 }}>
              Chưa có cuộc trò chuyện nào.<br/>Nhấn nút "+" ở trên để bắt đầu nhắn tin với khách hàng/shipper của đơn hàng.
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div 
                key={conv.partnerId}
                className={`res-chat-item ${activePartner?.partnerId === conv.partnerId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => handleSelectPartner(conv)}
              >
                <div className="res-chat-avatar-wrapper">
                  {conv.partnerAvatar ? (
                    <img 
                      src={getImageUrl(conv.partnerAvatar, 'avatar')} 
                      alt={conv.partnerName} 
                      className="res-chat-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${conv.partnerName}&background=random`;
                      }}
                    />
                  ) : (
                    <div className="res-chat-avatar">
                      {conv.partnerName?.charAt(0)}
                    </div>
                  )}
                  <span className={`res-chat-role-indicator ${conv.partnerRole}`}></span>
                </div>
                
                <div className="res-chat-item-info">
                  <div className="res-chat-item-name-row">
                    <span className="res-chat-item-name">{conv.partnerName}</span>
                    <span className="res-chat-item-time">{formatTime(conv.lastMessageTime)}</span>
                  </div>
                  <div className="res-chat-item-message-row">
                    <span className="res-chat-item-snippet">
                      {conv.lastMessageSenderId === conv.partnerId ? '' : 'Bạn: '}{conv.lastMessage}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="res-chat-item-unread-dot"></span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      {activePartner ? (
        <div className="res-chat-window">
          {/* Header */}
          <header className="res-chat-window-header">
            <div className="res-chat-header-user">
              <div className="res-chat-avatar-wrapper">
                {activePartner.partnerAvatar ? (
                  <img 
                    src={getImageUrl(activePartner.partnerAvatar, 'avatar')} 
                    alt={activePartner.partnerName} 
                    className="res-chat-avatar"
                    style={{ width: 42, height: 42 }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${activePartner.partnerName}&background=random`;
                    }}
                  />
                ) : (
                  <div className="res-chat-avatar" style={{ width: 42, height: 42 }}>
                    {activePartner.partnerName?.charAt(0)}
                  </div>
                )}
                <span className={`res-chat-role-indicator ${activePartner.partnerRole}`} style={{ width: 14, height: 14 }}></span>
              </div>
              <div>
                <div className="res-chat-header-name">{activePartner.partnerName}</div>
                <div className={`res-chat-header-role ${activePartner.partnerRole}`}>
                  {activePartner.partnerRole === 'driver' ? 'Tài xế/Shipper' : 'Khách hàng'}
                </div>
              </div>
            </div>
          </header>

          {/* Messages Panel */}
          <div className="res-chat-messages">
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#a0aec0', fontSize: 13 }}>
                <MessageSquare size={48} style={{ marginBottom: 12, opacity: 0.5, color: '#ff5722' }} />
                <div>Hãy gửi lời chào đầu tiên tới {activePartner.partnerName}!</div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSentByMe = msg.sender_id !== activePartner.partnerId;
                return (
                  <div 
                    key={msg.id_Message || index}
                    className={`res-chat-message-row ${isSentByMe ? 'sent' : 'received'}`}
                  >
                    <div className="res-chat-bubble-wrapper">
                      <div className="res-chat-bubble" title={formatDateTime(msg.created_at)}>
                        {msg.message_text}
                      </div>
                      <span className="res-chat-msg-time">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <footer className="res-chat-footer">
            <form onSubmit={handleSendMessage} className="res-chat-input-wrapper">
              <input 
                type="text" 
                placeholder="Nhập tin nhắn..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className="res-chat-send-btn">
                <Send size={18} />
              </button>
            </form>
          </footer>
        </div>
      ) : (
        <div className="res-chat-empty-window">
          <div className="res-chat-empty-icon">💬</div>
          <div className="res-chat-empty-text">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</div>
          <p style={{ fontSize: 13, color: '#a0aec0', marginTop: 8 }}>
            Bạn có thể chat với Khách hàng hoặc Shipper liên quan đến đơn hàng của mình.
          </p>
        </div>
      )}
    </div>
  );
};

export default RestaurantChat;
