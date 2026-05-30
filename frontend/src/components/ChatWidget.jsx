import { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { MessageSquare, Send, X, ArrowLeft, Plus, Search, User, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { getImageUrl } from '../utils/imageHelper';

const API = import.meta.env.VITE_API_URL;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const ChatWidget = () => {
  const { user } = useContext(AuthContext);

  const {
    isChatOpen,
    setIsChatOpen,
    activePartner,
    setActivePartner,
    conversations,
    unreadCount,
    fetchConversations
  } = useContext(ChatContext);

  const [view, setView] = useState('list'); // 'list' or 'chat' or 'contacts'
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Contacts
  const [contacts, setContacts] = useState([]);
  const [contactSearchTerm, setContactSearchTerm] = useState('');

  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  // Sync view state with activePartner from context
  useEffect(() => {
    if (activePartner) {
      setView('chat');
      fetchMessages(activePartner.id);
    } else {
      setView('list');
    }
  }, [activePartner]);

  // Fetch messages with current active partner
  const fetchMessages = async (partnerId, silent = false) => {
    try {
      const res = await axios.get(`${API}/chat/messages/${partnerId}`, { headers });
      setMessages(res.data);
      // Mark as read
      await axios.put(`${API}/chat/messages/${partnerId}/read`, {}, { headers });
      fetchConversations(); // Cập nhật lại số tin nhắn chưa đọc
      if (!silent) {
        scrollToBottom();
      }
    } catch (err) {
      console.error('Lỗi tải tin nhắn:', err);
    }
  };

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API}/chat/contacts`, { headers });
      setContacts(res.data);
    } catch (err) {
      console.error('Lỗi tải danh sách liên hệ:', err);
    }
  };

  // Poll messages every 4 seconds if chat view is open and widget is open
  useEffect(() => {
    let interval;
    if (isChatOpen && view === 'chat' && activePartner) {
      interval = setInterval(() => {
        fetchMessages(activePartner.id, true);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isChatOpen, view, activePartner]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Handle select a conversation from list
  const handleSelectConversation = (conv) => {
    setActivePartner({
      id: conv.partnerId,
      name: conv.partnerName,
      avatar: conv.partnerAvatar,
      role: conv.partnerRole
    });
  };

  // Handle start chat with a contact
  const handleStartChatWithContact = (contact) => {
    setActivePartner({
      id: contact.id,
      name: contact.fullName,
      avatar: contact.avatar,
      role: contact.role
    });
  };

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activePartner) return;

    const messageToSend = inputText.trim();
    setInputText('');

    try {
      const res = await axios.post(
        `${API}/chat/messages`,
        { receiverId: activePartner.id, messageText: messageToSend },
        { headers }
      );
      
      // Update local message list
      setMessages(prev => [...prev, res.data.data]);
      scrollToBottom();
      fetchConversations(); // refresh conversations snippet
    } catch (err) {
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  const handleBackToList = () => {
    setActivePartner(null);
    setView('list');
  };

  // Format time (HH:MM)
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c =>
    c.partnerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter contacts
  const filteredContacts = contacts.filter(c =>
    c.fullName?.toLowerCase().includes(contactSearchTerm.toLowerCase())
  );

  if (!user) return null; // Chỉ hiển thị khi đã đăng nhập

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[360px] sm:w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 mb-4"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3.5 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                {view !== 'list' && (
                  <button 
                    onClick={() => {
                      if (view === 'contacts') setView('list');
                      else handleBackToList();
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                
                {view === 'chat' && activePartner ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {activePartner.avatar ? (
                        <img 
                          src={getImageUrl(activePartner.avatar, 'avatar')}
                          alt={activePartner.name}
                          className="w-9 h-9 rounded-full object-cover border border-white/20"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${activePartner.name}&background=ffedd5&color=ea580c`;
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                          {activePartner.name?.charAt(0)}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        activePartner.role === 'restaurant_owner' ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                    </div>
                    <div>
                      <div className="font-bold text-sm leading-tight line-clamp-1">{activePartner.name}</div>
                      <div className="text-[10px] text-orange-100 font-semibold uppercase tracking-wider">
                        {activePartner.role === 'restaurant_owner' ? 'Cửa hàng' : activePartner.role === 'driver' ? 'Tài xế/Shipper' : 'Khách hàng'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-extrabold text-base flex items-center gap-1.5">
                      <MessageSquare size={18} className="text-orange-100" />
                      {view === 'contacts' ? 'Nhắn tin mới' : 'Trò chuyện'}
                    </h3>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
              {/* VIEW 1: CONVERSATION LIST */}
              {view === 'list' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search and New Chat button */}
                  <div className="p-3 bg-white border-b border-slate-100 flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2 border border-slate-200">
                      <Search size={16} className="text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Tìm cuộc trò chuyện..."
                        className="bg-transparent text-sm w-full outline-none text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        setView('contacts');
                        fetchContacts();
                      }}
                      className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition shadow-sm cursor-pointer flex items-center justify-center"
                      title="Tin nhắn mới"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredConversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                        <MessageSquare size={48} className="text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-500">Chưa có tin nhắn nào</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Hãy bắt đầu nhắn tin với cửa hàng hoặc shipper của bạn</p>
                      </div>
                    ) : (
                      filteredConversations.map((conv) => (
                        <div 
                          key={conv.partnerId}
                          onClick={() => handleSelectConversation(conv)}
                          className={`p-3.5 flex gap-3 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors duration-200 ${
                            conv.unreadCount > 0 ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            {conv.partnerAvatar ? (
                              <img 
                                src={getImageUrl(conv.partnerAvatar, 'avatar')}
                                alt={conv.partnerName}
                                className="w-11 h-11 rounded-full object-cover border border-slate-150"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://ui-avatars.com/api/?name=${conv.partnerName}&background=random`;
                                }}
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-base">
                                {conv.partnerName?.charAt(0)}
                              </div>
                            )}
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              conv.partnerRole === 'restaurant_owner' ? 'bg-orange-500' : 'bg-blue-500'
                            }`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <h4 className="font-bold text-slate-800 text-sm truncate">{conv.partnerName}</h4>
                              <span className="text-[10px] text-slate-400 font-medium">{formatTime(conv.lastMessageTime)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                {conv.lastMessageSenderId === conv.partnerId ? '' : 'Bạn: '}{conv.lastMessage}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="bg-orange-500 text-white font-extrabold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center scale-90">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 2: CONTACTS (NEW CHAT) */}
              {view === 'contacts' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                  <div className="p-3 border-b border-slate-100">
                    <div className="flex bg-slate-100 rounded-xl px-3 py-2 items-center gap-2 border border-slate-200">
                      <Search size={16} className="text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Tìm liên hệ..."
                        className="bg-transparent text-sm w-full outline-none text-slate-700"
                        value={contactSearchTerm}
                        onChange={(e) => setContactSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredContacts.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <User className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold">Không tìm thấy liên hệ nào</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto px-4">
                          Bạn chỉ có thể nhắn tin với nhà hàng hoặc tài xế từ các đơn hàng bạn đã đặt.
                        </p>
                      </div>
                    ) : (
                      filteredContacts.map(contact => (
                        <div 
                          key={contact.id}
                          onClick={() => handleStartChatWithContact(contact)}
                          className="p-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition duration-150"
                        >
                          <div className="relative">
                            {contact.avatar ? (
                              <img 
                                src={getImageUrl(contact.avatar, 'avatar')}
                                alt={contact.fullName}
                                className="w-10 h-10 rounded-full object-cover border border-slate-150"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://ui-avatars.com/api/?name=${contact.fullName}&background=random`;
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                                {contact.fullName?.charAt(0)}
                              </div>
                            )}
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                              contact.role === 'restaurant_owner' ? 'bg-orange-500' : 'bg-blue-500'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate">{contact.fullName}</h4>
                            <p className="text-xs text-slate-400">
                              {contact.role === 'restaurant_owner' ? 'Cửa hàng' : 'Shipper / Tài xế'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: CHAT ROOM */}
              {view === 'chat' && activePartner && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages Bubble Panel */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50 flex flex-col">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center my-auto text-slate-400 text-center px-4">
                        <MessageSquare size={40} className="text-orange-400/40 mb-3" />
                        <p className="text-xs font-semibold text-slate-500">Hãy gửi lời chào đầu tiên!</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Đặt câu hỏi về món ăn hoặc giao nhận đơn hàng</p>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const isSentByMe = msg.sender_id !== activePartner.id;
                        return (
                          <div 
                            key={msg.id_Message || index}
                            className={`flex flex-col ${isSentByMe ? 'items-end' : 'items-start'}`}
                          >
                            <div className="max-w-[75%] flex flex-col gap-0.5">
                              <div className={`px-3.5 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed ${
                                isSentByMe 
                                  ? 'bg-orange-500 text-white rounded-tr-none' 
                                  : 'bg-white text-slate-800 border border-slate-200/50 rounded-tl-none'
                              }`}>
                                {msg.message_text}
                              </div>
                              <span className={`text-[10px] text-slate-450 px-1 mt-0.5 ${isSentByMe ? 'text-right' : 'text-left'}`}>
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Footer */}
                  <form 
                    onSubmit={handleSendMessage}
                    className="p-3 bg-white border-t border-slate-150 flex items-center gap-2"
                  >
                    <input 
                      type="text" 
                      placeholder="Nhập tin nhắn..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-grow bg-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-800 border border-slate-200 focus:bg-white focus:border-orange-500 transition-all duration-250"
                    />
                    <button 
                      type="submit"
                      disabled={!inputText.trim()}
                      className="p-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white rounded-xl transition shadow-sm cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Circle Bubble Button */}
      <motion.button
        onClick={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) {
            fetchConversations();
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer border border-orange-400/20 relative group hover:from-orange-600 hover:to-orange-700 transition-colors"
      >
        <MessageSquare size={26} className="group-hover:rotate-6 transition-transform duration-350" />
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-extrabold text-[11px] w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow animate-pulse">
            {unreadCount}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default ChatWidget;
