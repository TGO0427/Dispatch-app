import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Mail, Send, Inbox, Search, AlertCircle, Users, User, Link2, MoreHorizontal, Trash2, MessageSquare, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { messagesAPI } from "../../services/api";
import type { Message } from "../../types";

// Fetch all users for recipient selection
async function fetchUsers(): Promise<{ id: string; username: string; role: string }[]> {
  const res = await fetch("/api/users", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
  });
  const json = await res.json();
  return json.data || [];
}

export const InboxView: React.FC = () => {
  const { user } = useAuth();
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [messages, setMessages] = useState<(Message & { _readAt?: string | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<(Message & { _readAt?: string | null }) | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Thread state
  const [threadMessages, setThreadMessages] = useState<(Message & { _readAt?: string | null })[]>([]);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; username: string; role: string }[]>([]);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeRecipients, setComposeRecipients] = useState<string[]>([]);
  const [composeJobRef, setComposeJobRef] = useState("");
  const [composePriority, setComposePriority] = useState<"normal" | "urgent">("normal");
  const [composeBroadcast, setComposeBroadcast] = useState(false);
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const data = folder === "sent" ? await messagesAPI.getSent() : await messagesAPI.getInbox();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    setIsLoading(true);
    setSelectedMessage(null);
    setThreadMessages([]);
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const interval = setInterval(() => fetchMessages(), 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom of thread when messages update
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  // Group messages by conversation thread
  const grouped = useMemo(() => {
    const threadMap = new Map<string, (Message & { _readAt?: string | null })>();
    messages.forEach((m) => {
      const tid = m.threadId || m.id;
      const existing = threadMap.get(tid);
      if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
        threadMap.set(tid, m);
      }
      if (existing && !m._readAt && existing._readAt) {
        threadMap.set(tid, { ...threadMap.get(tid)!, _readAt: null });
      }
    });
    return Array.from(threadMap.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [messages]);

  const filtered = useMemo(() => {
    if (!searchQuery) return grouped;
    const q = searchQuery.toLowerCase();
    return grouped.filter((m) =>
      m.subject.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q) ||
      (m.jobRef && m.jobRef.toLowerCase().includes(q))
    );
  }, [grouped, searchQuery]);

  const unreadCount = useMemo(() => messages.filter((m) => !m._readAt).length, [messages]);

  const handleSelectMessage = async (msg: Message & { _readAt?: string | null }) => {
    setSelectedMessage(msg);
    setShowDeleteMenu(false);
    const tid = msg.threadId || msg.id;
    try {
      const thread = await messagesAPI.getThread(tid);
      setThreadMessages(thread);
    } catch {
      setThreadMessages([msg]);
    }
    if (folder === "inbox" && !msg._readAt) {
      try {
        await messagesAPI.markRead(msg.id);
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, _readAt: new Date().toISOString() } : m));
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }
  };

  const openCompose = async (replyTo?: Message) => {
    try {
      const users = await fetchUsers();
      setAllUsers(users.filter((u) => u.id !== user?.id));
    } catch { /* ignore */ }

    if (replyTo) {
      setComposeSubject(replyTo.subject.startsWith("Re: ") ? replyTo.subject : `Re: ${replyTo.subject}`);
      setComposeRecipients([replyTo.senderId]);
      setComposeJobRef(replyTo.jobRef || "");
      setComposeThreadId(replyTo.threadId || replyTo.id);
    } else {
      setComposeSubject("");
      setComposeRecipients([]);
      setComposeJobRef("");
      setComposeThreadId(null);
    }
    setComposeBody("");
    setComposePriority("normal");
    setComposeBroadcast(false);
    setShowCompose(true);
  };

  const handleSend = async () => {
    if (!composeSubject.trim() || !composeBody.trim()) return;
    if (!composeBroadcast && composeRecipients.length === 0) return;
    setIsSending(true);
    try {
      await messagesAPI.send({
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        recipientIds: composeBroadcast ? undefined : composeRecipients,
        jobRef: composeJobRef.trim() || undefined,
        priority: composePriority,
        broadcast: composeBroadcast,
        threadId: composeThreadId || undefined,
      });
      setShowCompose(false);
      fetchMessages();
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleInlineReply = async (text: string) => {
    if (!text.trim() || !selectedMessage) return;
    const tid = selectedMessage.threadId || selectedMessage.id;
    const replyTo = folder === "inbox"
      ? [selectedMessage.senderId]
      : selectedMessage.recipients.map((r) => r.userId);
    try {
      await messagesAPI.send({
        subject: selectedMessage.subject.startsWith("Re: ") ? selectedMessage.subject : `Re: ${selectedMessage.subject}`,
        body: text.trim(),
        recipientIds: replyTo,
        jobRef: selectedMessage.jobRef || undefined,
        threadId: tid,
      });
      const thread = await messagesAPI.getThread(tid);
      setThreadMessages(thread);
      fetchMessages();
    } catch (err) {
      console.error("Failed to send reply:", err);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-2">
      {/* Header bar — unified toolbar */}
      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
        <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
          <button
            onClick={() => setFolder("inbox")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              folder === "inbox" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            Inbox
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full min-w-[16px] text-center">{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setFolder("sent")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              folder === "sent" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            Sent
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search messages..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 h-7 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <Button size="sm" onClick={() => openCompose()} className="gap-1.5 h-7 text-xs">
          <Send className="h-3 w-3" /> New
        </Button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-2" style={{ height: "calc(100vh - 180px)" }}>
        {/* Conversation List */}
        <div className="col-span-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4 py-10">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <MessageSquare className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">{folder === "inbox" ? "No messages yet" : "No sent messages"}</p>
                <p className="text-[10px] text-gray-400 mt-1 text-center">
                  {folder === "inbox" ? "Messages from your team will appear here" : "Start a conversation with the New button"}
                </p>
                <button
                  onClick={() => openCompose()}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  <Send className="h-3 w-3" /> Start a conversation
                </button>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1">
                {filtered.map((msg) => {
                  const isUnread = folder === "inbox" && !msg._readAt;
                  const isSelected = selectedMessage && (selectedMessage.threadId || selectedMessage.id) === (msg.threadId || msg.id);
                  const otherPerson = folder === "inbox" ? msg.senderName : (msg.recipients?.[0]?.username || "Unknown");
                  return (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`w-full text-left px-3 py-2 transition-colors border-b border-gray-50 ${
                        isSelected ? "bg-blue-50" : isUnread ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                          isUnread ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        }`}>
                          {getInitials(otherPerson)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs truncate ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                              {otherPerson}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(msg.createdAt)}</span>
                          </div>
                          <p className={`text-[11px] truncate ${isUnread ? "font-semibold text-gray-800" : "text-gray-500"}`}>
                            {msg.subject.replace(/^(Re: )+/, "")}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{msg.body.slice(0, 50)}</p>
                        </div>
                        {/* Indicators */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          {msg.priority === "urgent" && <AlertCircle className="h-3 w-3 text-red-500" />}
                          {msg.jobRef && <Link2 className="h-3 w-3 text-blue-400" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
                </div>
                {/* Low-volume helper */}
                <div className="p-3 border-t border-gray-50 mt-auto">
                  {filtered.length < 5 && (
                    <p className="text-[10px] text-gray-300 text-center mb-2">
                      {filtered.length === 1 ? "1 conversation" : `${filtered.length} conversations`}
                    </p>
                  )}
                  <button
                    onClick={() => openCompose()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Send className="h-2.5 w-2.5 text-gray-400" />
                    </div>
                    New conversation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thread View */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {selectedMessage ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate">
                    {selectedMessage.subject.replace(/^(Re: )+/, "")}
                  </h3>
                  {selectedMessage.priority === "urgent" && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">Urgent</Badge>
                  )}
                  {selectedMessage.jobRef && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      <Link2 className="h-2.5 w-2.5" /> {selectedMessage.jobRef}
                    </span>
                  )}
                  {threadMessages.length > 1 && (
                    <span className="text-[10px] text-gray-400">{threadMessages.length} messages</span>
                  )}
                </div>
                {/* Delete — demoted to icon menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {showDeleteMenu && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                      <button
                        onClick={async () => {
                          try {
                            await messagesAPI.remove(selectedMessage.id);
                            setSelectedMessage(null);
                            setThreadMessages([]);
                            setShowDeleteMenu(false);
                            fetchMessages();
                          } catch (err) { console.error("Failed to delete:", err); }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Delete conversation
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-2 bg-gray-50/30">
                {threadMessages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  const prevMsg = idx > 0 ? threadMessages[idx - 1] : null;
                  const sameSender = prevMsg && prevMsg.senderId === msg.senderId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${sameSender ? "mt-px" : idx === 0 ? "" : "mt-3"}`}>
                      {!isMe && (
                        sameSender ? (
                          <div className="w-5 mr-1 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-[7px] font-bold mr-1 mt-auto mb-px flex-shrink-0">
                            {getInitials(msg.senderName)}
                          </div>
                        )
                      )}
                      <div className={`max-w-[70%] px-2.5 py-1 ${
                        isMe
                          ? `bg-blue-600 text-white ${sameSender ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-md"}`
                          : `bg-white border border-gray-100 text-gray-900 ${sameSender ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-md"}`
                      }`}>
                        <p className={`text-[13px] whitespace-pre-wrap leading-tight ${isMe ? "text-white" : "text-gray-700"}`}>
                          {msg.body}
                        </p>
                        <p className={`text-[8px] leading-none mt-0.5 text-right ${isMe ? "text-blue-300" : "text-gray-400"}`}>
                          {new Date(msg.createdAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {/* Composer bar */}
              <div className="px-3 py-2 border-t border-gray-100 bg-white">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector("input") as HTMLInputElement;
                    const text = input?.value?.trim();
                    if (!text) return;
                    input.value = "";
                    await handleInlineReply(text);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 h-9 px-4 text-sm border border-gray-200 rounded-full bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center flex-shrink-0 shadow-sm"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Mail className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">Select a conversation</p>
                <p className="text-[10px] text-gray-400 mt-1">Choose from the left or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCompose(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">New Message</h3>
              <button onClick={() => setShowCompose(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Broadcast toggle */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Recipients</label>
                <button
                  onClick={() => setComposeBroadcast(!composeBroadcast)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    composeBroadcast ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Users className="h-3 w-3" /> Broadcast to All
                </button>
              </div>

              {!composeBroadcast && (
                <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg min-h-[36px]">
                  {composeRecipients.map((rid) => {
                    const u = allUsers.find((u) => u.id === rid);
                    return (
                      <span key={rid} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-xs">
                        <User className="h-3 w-3" />
                        {u?.username || rid}
                        <button onClick={() => setComposeRecipients((prev) => prev.filter((r) => r !== rid))} className="hover:text-blue-900">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  {(() => {
                    const available = allUsers.filter((u) => !composeRecipients.includes(u.id));
                    return (
                      <select
                        value="__placeholder__"
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          if (selectedId && selectedId !== "__placeholder__" && !composeRecipients.includes(selectedId)) {
                            setComposeRecipients((prev) => [...prev, selectedId]);
                          }
                        }}
                        className="text-xs border-none outline-none bg-transparent flex-1 min-w-[120px]"
                      >
                        <option value="__placeholder__">Add recipient...</option>
                        {available.map((u) => (
                          <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Subject</label>
                <input
                  type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Message subject..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Message</label>
                <textarea
                  value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Link to Order (optional)</label>
                  <input
                    type="text" value={composeJobRef} onChange={(e) => setComposeJobRef(e.target.value)}
                    placeholder="e.g. ASO0024525"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Priority</label>
                  <div className="flex gap-1.5 mt-1">
                    <button
                      onClick={() => setComposePriority("normal")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        composePriority === "normal" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setComposePriority("urgent")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        composePriority === "urgent" ? "border-red-600 bg-red-600 text-white" : "border-gray-200 hover:border-red-300 text-red-600"
                      }`}
                    >
                      Urgent
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowCompose(false)} className="flex-1 text-sm">Cancel</Button>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !composeSubject.trim() || !composeBody.trim() || (!composeBroadcast && composeRecipients.length === 0)}
                  className="flex-1 text-sm gap-2"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Sending..." : composeBroadcast ? "Broadcast" : "Send"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
