"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/app/services/api";
import io, { Socket } from "socket.io-client";
import imageCompression from "browser-image-compression";
import { 
  FaPaperPlane, 
  FaPaperclip, 
  FaTimes, 
  FaImage, 
  FaVideo,
  FaCheckCircle,
  FaStop,
  FaSpinner,
  FaUserCircle
} from "react-icons/fa";
import Link from "next/link";
import { toast } from "sonner";

interface Message {
  _id: string;
  requestId: string;
  senderId: string;
  senderName: string;
  senderType: string;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  read: boolean;
  createdAt: string;
}

interface ChatBoxProps {
  requestId: string;
  otherUserName: string;
  otherUserId: string;
  currentUserType: "user" | "volunteer";
  onComplete?: () => void;
  currentStatus?: string;
  currentUserId?: string; 
  requestCreatorId?: string; 
}

export default function ChatBox({ 
  requestId, 
  otherUserName, 
  otherUserId, 
  currentUserType,
  onComplete,
  currentStatus,
  currentUserId,
  requestCreatorId
}: ChatBoxProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [viewerMedia, setViewerMedia] = useState<{ url: string; type: "image" | "video"; index: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const [isUserScrolling, setIsUserScrolling] = useState(false);
const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const isAssignedVolunteer = currentUserType === "volunteer" && currentUserId === user?.id && requestCreatorId !== user?.id;

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;
    
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };
    
    try {
      const compressed = await imageCompression(file, options);
      return compressed;
    } catch (error) {
      console.error("Compression error:", error);
      return file;
    }
  };

  useEffect(() => {
    const newSocket = io("https://techshare-gpve.onrender.com", {
      transports: ["websocket"],
    });
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && requestId) {
      socket.emit("join-room", requestId);
      
      socket.on("receive-message", (newMessage: Message) => {
        setMessages((prev) => [...prev, newMessage]);
        if (newMessage.senderId !== user?.id) {
          api.patch(`/chat/${requestId}/read`, { userId: user?.id });
        }
      });
      
      socket.on("user-typing", ({ isTyping: typing }) => {
        setOtherUserTyping(typing);
      });
      
      return () => {
        socket.emit("leave-room", requestId);
        socket.off("receive-message");
        socket.off("user-typing");
      };
    }
  }, [socket, requestId, user?.id]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socket?.emit("typing", { roomId: requestId, isTyping: true });
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket?.emit("typing", { roomId: requestId, isTyping: false });
    }, 1000);
  };

  const fetchMessages = useCallback(async () => {
    try {
      const response = await api.get(`/chat/${requestId}/messages`);
      setMessages(response.data);
      await api.patch(`/chat/${requestId}/read`, { userId: user?.id });
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [requestId, user?.id]);

useEffect(() => {
  fetchMessages();
}, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if ((!inputText.trim() && !selectedMedia) || sending) return;
    
    setSending(true);
    const messageText = inputText;
    let mediaFile = selectedMedia;
    setInputText("");
    setSelectedMedia(null);
    setMediaPreview(null);
    
    try {
      let mediaUrl = null;
      let mediaType = null;
      
      if (mediaFile) {
        setUploading(true);
        
        if (mediaFile.type.startsWith("image/")) {
          mediaFile = await compressImage(mediaFile);
        }
        
        const formData = new FormData();
        formData.append("file", mediaFile);
        formData.append("senderId", user?.id || "");
        formData.append("senderName", user?.fullName || (currentUserType === "volunteer" ? "Tình nguyện viên" : "Bạn"));
        formData.append("senderType", currentUserType);
        formData.append("text", messageText);
        
        const response = await api.post(`/chat/${requestId}/messages/media`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
            }
          },
          timeout: 60000,
        });
        
        mediaUrl = response.data.mediaUrl;
        mediaType = response.data.mediaType;
        setUploadProgress(0);
      } else {
        await api.post(`/chat/${requestId}/messages`, {
          senderId: user?.id,
          senderName: user?.fullName || (currentUserType === "volunteer" ? "Tình nguyện viên" : "Bạn"),
          senderType: currentUserType,
          text: messageText,
        });
      }
      
      fetchMessages();
      
      if (socket) {
        socket.emit("send-message", {
          roomId: requestId,
          message: { text: messageText, mediaUrl, mediaType, senderName: user?.fullName },
        });
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Không thể gửi tin nhắn");
      setInputText(messageText);
      setSelectedMedia(mediaFile);
      if (mediaFile) setMediaPreview(URL.createObjectURL(mediaFile));
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleStopSupport = async () => {
    try {
      await api.patch(`/requests/${requestId}/stop-support`, {
        reason: stopReason || "Tình nguyện viên đã kết thúc hỗ trợ"
      });
      setShowStopConfirm(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error stopping support:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleComplete = async () => {
    try {
      await api.patch(`/requests/${requestId}/request-complete`);
      toast.success("Đã gửi yêu cầu xác nhận hoàn thành!");
      if (onComplete) onComplete();
      setShowCompleteConfirm(false);
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const openMediaViewer = (message: Message, index: number) => {
    if (message.mediaUrl && message.mediaType) {
      setViewerMedia({
        url: message.mediaUrl,
        type: message.mediaType,
        index: index,
      });
    }
  };

  const mediaMessages = messages.filter(m => m.mediaUrl && m.mediaType);
  
  const showNextMedia = () => {
    if (viewerMedia && viewerMedia.index + 1 < mediaMessages.length) {
      const next = mediaMessages[viewerMedia.index + 1];
      setViewerMedia({
        url: next.mediaUrl!,
        type: next.mediaType!,
        index: viewerMedia.index + 1,
      });
    }
  };
  
  const showPrevMedia = () => {
    if (viewerMedia && viewerMedia.index - 1 >= 0) {
      const prev = mediaMessages[viewerMedia.index - 1];
      setViewerMedia({
        url: prev.mediaUrl!,
        type: prev.mediaType!,
        index: viewerMedia.index - 1,
      });
    }
  };

  const renderMedia = (message: Message, idx: number) => {
    if (!message.mediaUrl) return null;
    
    if (message.mediaType === "image") {
      return (
        <button
          onClick={() => openMediaViewer(message, idx)}
          className="mt-1 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
        >
          <img 
            src={message.mediaUrl} 
            alt="Image" 
            className="max-w-[200px] max-h-[200px] object-cover"
          />
        </button>
      );
    }
    
    if (message.mediaType === "video") {
      return (
        <button
          onClick={() => openMediaViewer(message, idx)}
          className="mt-1 rounded-lg overflow-hidden cursor-pointer relative group"
        >
          <video 
            src={message.mediaUrl} 
            className="max-w-[250px] max-h-[150px] object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <FaVideo size={30} className="text-white" />
          </div>
        </button>
      );
    }
    
    return null;
  };

  const canShowActionButtons = currentUserType === "volunteer" && isAssignedVolunteer;
  const canRequestComplete = canShowActionButtons && currentStatus === "in-progress";

  const renderTypingIndicator = () => {
    if (!otherUserTyping) return null;
    return (
      <div className="flex justify-start mb-3">
        <div className="bg-gray-200 rounded-lg px-4 py-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  };

  const renderSendingIndicator = () => {
    if (!sending && !uploading) return null;
    return (
      <div className="flex justify-end mb-3">
        <div className="rounded-lg px-4 py-2 flex items-center gap-2">
          <FaSpinner className="w-4 h-4 text-white animate-spin" />
          <span className="text-white text-sm">
            {uploading ? `Đang gửi ảnh/video ${uploadProgress}%` : "Đang gửi..."}
          </span>
        </div>
      </div>
    );
  };  


useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;
  
  const handleScroll = () => {
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsUserScrolling(!isNearBottom);
  };
  
  container.addEventListener('scroll', handleScroll);
  return () => container.removeEventListener('scroll', handleScroll);
}, []);

useEffect(() => {
  if (!isUserScrolling) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}, [messages.length]);


const formatTime = (dateString?: string) => {
  if (!dateString) return "Vừa xong";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Vừa xong";
    return date.toLocaleTimeString();
  } catch (error) {
    return "Vừa xong";
  }
};

  return (
    <div className="flex flex-col w-full h-[90vh] max-w-full bg-white rounded-xl shadow-lg">
            <div className="bg-gradient-to-r p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full flex items-center justify-center">
  {user?.avatar ? (
    <img 
      src={user.avatar} 
      alt="Avatar" 
      className="w-10 h-10 rounded-full object-cover"
    />
  ) : (
    <FaUserCircle size={24} className="text-black" />
  )}
</div>
            <div>
              <h3 className="font-semibold text-black">{otherUserName}</h3>
              {/* <p className="text-xs text-blue-200">
                {currentStatus && `Trạng thái: ${currentStatus} | `}
                {messages.length > 0 ? `${messages.length} tin nhắn` : "Chưa có tin nhắn"}
              </p> */}
            </div>
          </div>
          <div className="flex gap-2">
            {canRequestComplete && (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition flex items-center gap-1"
              >
                <FaCheckCircle size={14} /> Hoàn thành
              </button>
            )}
            {canShowActionButtons && (currentStatus === "accepted" || currentStatus === "in-progress") && (
              <button
                onClick={() => setShowStopConfirm(true)}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition flex items-center gap-1"
              >
                {/* <FaStop size={14} />*/} Stop
              </button>
              
            )}
            <Link href={"/messages"} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition flex items-center gap-1">Back</Link>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-400 py-10">
            <FaSpinner className="w-8 h-8 animate-spin mx-auto mb-2" />
            Đang tải tin nhắn...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <FaImage size={40} className="mx-auto mb-2 opacity-50" />
            Chưa có tin nhắn nào
            <p className="text-sm mt-2">Hãy gửi tin nhắn để bắt đầu trò chuyện</p>
          </div>
        ) : (
          <>
{messages.map((msg, idx) => {
  const isMe = msg.senderId === user?.id;
  const mediaIndex = mediaMessages.findIndex(m => m._id === msg._id);

  const key = msg._id || `${msg.senderId}-${msg.createdAt}-${idx}`;

  return (
    <div
      key={key}
      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[70%] rounded-lg p-3 ${isMe ? "bg-white text-black" : "bg-white shadow-sm"}`}>
        
        {!isMe && (
          <p className="text-xs font-medium mb-1 text-blue-600">
            {msg.senderName}
          </p>
        )}

        {renderMedia(msg, mediaIndex)}

        {msg.text && (
          <p className="text-sm break-words">{msg.text}</p>
        )}

        <p className="text-xs mt-1 text-black">
          {formatTime(msg.createdAt)}
          {msg.read && isMe && <span className="ml-2">✓✓</span>}
        </p>
      </div>
    </div>
  );
})}
            {renderSendingIndicator()}
            {renderTypingIndicator()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            disabled={sending}
          >
            <FaPaperclip className="w-5 h-5 text-gray-500" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 50 * 1024 * 1024) {
                  toast.error("File quá lớn! Chỉ chấp nhận file dưới 50MB");
                  return;
                }
                setSelectedMedia(file);
                setMediaPreview(URL.createObjectURL(file));
              }
            }}
          />
          <input
            type="text"
            value={inputText}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Nhập tin nhắn..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || (!inputText.trim() && !selectedMedia)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <>{uploadProgress}%</>
            ) : sending ? (
              <FaSpinner className="w-4 h-4 animate-spin" />
            ) : (
              <FaPaperPlane className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {mediaPreview && (
          <div className="mt-2 relative inline-block">
            {selectedMedia?.type.startsWith("image/") ? (
              <img src={mediaPreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
            ) : (
              <video src={mediaPreview} className="h-16 w-16 object-cover rounded-lg" />
            )}
            <button
              onClick={() => {
                setSelectedMedia(null);
                setMediaPreview(null);
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              <FaTimes size={10} />
            </button>
          </div>
        )}
      </div>

      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-3">Xác nhận hoàn thành</h3>
            <p className="text-gray-600 mb-4">
              Bạn đã hoàn thành hỗ trợ? Người dùng sẽ xác nhận lại trước khi đánh giá.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCompleteConfirm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                Hủy
              </button>
              <button onClick={handleComplete} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg">
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {showStopConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-3">Dừng hỗ trợ</h3>
            <p className="text-gray-600 mb-3">
              Bạn có chắc muốn dừng hỗ trợ? Người dùng sẽ được yêu cầu đánh giá.
            </p>
            <textarea
              placeholder="Lý do dừng hỗ trợ (không bắt buộc)..."
              value={stopReason}
              onChange={(e) => setStopReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 resize-none"
              rows={2}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowStopConfirm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                Hủy
              </button>
              <button onClick={handleStopSupport} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">
                Xác nhận dừng
              </button>
            </div>
          </div>
        </div>
      )}


      {viewerMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <button
            onClick={() => setViewerMedia(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <FaTimes size={28} />
          </button>
          
          {mediaMessages.length > 1 && (
            <>
              {viewerMedia.index > 0 && (
                <button
                  onClick={showPrevMedia}
                  className="absolute left-4 text-white hover:text-gray-300 z-10"
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {viewerMedia.index + 1 < mediaMessages.length && (
                <button
                  onClick={showNextMedia}
                  className="absolute right-4 text-white hover:text-gray-300 z-10"
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </>
          )}
          
          <div className="max-w-[90vw] max-h-screen flex items-center justify-center">
{viewerMedia.type === "image" ? ( <img src={viewerMedia.url} alt="Preview" className="max-w-full max-h-screen object-cover" /> ) : ( <video src={viewerMedia.url} controls autoPlay className="max-w-full max-h-screen" /> )}
          </div>
        </div>
      )}
    </div>
  );
}
