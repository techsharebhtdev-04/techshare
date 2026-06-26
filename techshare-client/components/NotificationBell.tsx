"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import io, { Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import api from "@/app/services/api";

type NotificationType = 
  | "new_message" 
  | "new_request" 
  | "request_accepted" 
  | "request_complete" 
  | "article_hidden"
  | "support_stopped"
  | "new_article"
  | "article_reported"
  | "new_review"
  | "request_confirmed";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  requestId?: string;
  articleId?: string;
  reviewId?: string;
  read: boolean;
  createdAt: Date;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`notifications_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setNotifications(parsed.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) })));
        } catch (e) {
          console.error("Error loading notifications:", e);
        }
      }
    }
  }, [user?.id]);
  useEffect(() => {
    if (user?.id && notifications.length > 0) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifications));
    }
  }, [notifications, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const newSocket = io("https://techshare-gpve.onrender.com", {
      transports: ["websocket"],
    });
    setSocket(newSocket);

    newSocket.emit("join-room", `user_${user.id}`);

    newSocket.on("notification", (notification: Omit<Notification, "id" | "read" | "createdAt">) => {
      const newNotif: Notification = {
        ...notification,
        id: Date.now().toString(),
        read: false,
        createdAt: new Date(),
      };
      setNotifications(prev => [newNotif, ...prev]);
      
      if (Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/favicon.ico",
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    setShowDropdown(false);
    
    if (notif.requestId) {
      router.push(`/chat/${notif.requestId}`);
    } else if (notif.articleId) {
      router.push(`/tai-nguyen/${notif.articleId}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_message": return "";
      case "new_request": return "";
      case "request_accepted": return "";
      case "request_complete": return "";
      case "article_hidden": return "";
      case "new_article": return "";
      case "article_reported": return "";
      case "new_review": return "";
      case "request_confirmed": return "";
      case "support_stopped": return "";
      default: return "";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Thông báo"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

{showDropdown && (
  <div className="fixed top-[var(--bell-bottom)] right-2 sm:right-0 z-50 w-[calc(100%-1rem)] sm:w-80 max-w-sm sm:max-w-md bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
    
    {/* Header */}
    <div className="flex flex-col sm:flex-row items-center sm:justify-between p-3 border-b border-gray-100 bg-gray-50 w-full">
      <h3 className="font-semibold text-gray-800 text-lg sm:text-xl truncate">
        Thông báo
      </h3>
      {unreadCount > 0 && (
        <button
          onClick={markAllAsRead}
          className="mt-2 sm:mt-0 text-xs sm:text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
        >
          Đánh dấu đã đọc
        </button>
      )}
    </div>

{/* Content */}
<div className="max-h-96 overflow-y-auto">
  {notifications.length === 0 ? (
    <div className="p-6 text-center text-gray-400">
      <p className="text-sm">Chưa có thông báo nào</p>
    </div>
  ) : (
    notifications.slice(0, 6).map((notif) => (
      <button
        key={notif.id}
        onClick={() => handleNotificationClick(notif)}
        className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
          !notif.read ? "bg-blue-50" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl">{getIcon(notif.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{notif.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(notif.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </button>
    ))
  )}
</div>
  </div>
)}
    </div>
  );
}
