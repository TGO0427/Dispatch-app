import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Mail, Send, Inbox, Search, X, AlertCircle, Users, User, Link2 } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
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

  // Thread state
  const [threadMessages, setThreadMessages] = useState<(Message & { _readAt?: string | null })[]>([]);

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
      console.log(`[Inbox] ${folder} messages:`, data?.length ?? 0, data);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Inbox] Failed to fetch messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    setIsLoading(true);
    setSelectedMessage(null);
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchMessages(), 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const filtered = useMemo(() => {
    if (!searchQuery) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) =>
      m.subject.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q) ||
      (m.jobRef && m.jobRef.toLowerCase().includes(q))
    );
  }, [messages, searchQuery]);

  const unreadCount = useMemo(() => messages.filter((m) => !m._readAt).length, [messages]);

  const handleSelectMessage = async (msg: Message & { _readAt?: string | null }) => {
    setSelectedMessage(msg);
    // Load conversation thread
    const tid = msg.threadId || msg.id;
    try {
      const thread = await messagesAPI.getThread(tid);
      setThreadMessages(thread);
    } catch {
      setThreadMessages([msg]);
    }
    // Mark as read if unread and in inbox
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
      console.log("[Inbox] All users fetched:", users);
      console.log("[Inbox] Current user id:", user?.id);
      setAllUsers(users.filter((u) => u.id !== user?.id));
    } catch (err) { console.error("[Inbox] Failed to fetch users:", err); }

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
      console.log("[Inbox] Sending message:", { subject: composeSubject, recipients: composeRecipients, broadcast: composeBroadcast });
      const result = await messagesAPI.send({
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        recipientIds: composeBroadcast ? undefined : composeRecipients,
        jobRef: composeJobRef.trim() || undefined,
        priority: composePriority,
        broadcast: composeBroadcast,
        threadId: composeThreadId || undefined,
      });
      console.log("[Inbox] Send result:", result);
      setShowCompose(false);
      fetchMessages();
    } catch (err) {
      console.error("[Inbox] Failed to send:", err);
    } finally {
      setIsSending(false);
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-xs text-gray-400 mt-0.5">Internal team communication</p>
        </div>
        <Button onClick={() => openCompose()} className="gap-2">
          <Send className="h-4 w-4" /> New Message
        </Button>
      </div>

      {/* Folder tabs + search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setFolder("inbox")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              folder === "inbox" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            Inbox
            {unreadCount > 0 && folder === "inbox" && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setFolder("sent")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              folder === "sent" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            Sent
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search messages..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-8 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-3" style={{ minHeight: "500px" }}>
        {/* Message List */}
        <Card className="col-span-1 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{folder === "inbox" ? "No messages" : "No sent messages"}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((msg) => {
                  const isUnread = folder === "inbox" && !msg._readAt;
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        isSelected ? "bg-blue-50 border-l-2 border-blue-600" : isUnread ? "bg-white border-l-2 border-blue-400" : "bg-white border-l-2 border-transparent hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            <span className={`text-xs truncate ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                              {folder === "inbox" ? msg.senderName : msg.recipients.map((r) => r.username).join(", ")}
                            </span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${isUnread ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                            {msg.subject}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{msg.body.slice(0, 60)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                          {msg.priority === "urgent" && (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                          {msg.jobRef && <Link2 className="h-3 w-3 text-blue-400" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card className="col-span-2 overflow-hidden">
          <CardContent className="p-0">
            {selectedMessage ? (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">
                          {selectedMessage.subject.replace(/^(Re: )+/, "")}
                        </h3>
                        {selectedMessage.priority === "urgent" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgent</Badge>
                        )}
                        {threadMessages.length > 1 && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{threadMessages.length} messages</span>
                        )}
                      </div>
                      {selectedMessage.jobRef && (
                        <div className="flex items-center gap-1 mt-1">
                          <Link2 className="h-3 w-3 text-blue-500" />
                          <span className="text-xs text-blue-600 font-medium">{selectedMessage.jobRef}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {folder === "sent" && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            await messagesAPI.remove(selectedMessage.id);
                            setSelectedMessage(null);
                            setThreadMessages([]);
                            fetchMessages();
                          } catch (err) { console.error("Failed to delete:", err); }
                        }} className="text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <X className="h-3 w-3" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {/* Conversation thread */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {threadMessages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-lg px-3.5 py-2.5 ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-900 rounded-bl-sm"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold ${isMe ? "text-blue-200" : "text-gray-500"}`}>
                              {msg.senderName}
                            </span>
                            <span className={`text-[10px] ${isMe ? "text-blue-200" : "text-gray-400"}`}>
                              {new Date(msg.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isMe ? "text-white" : "text-gray-700"}`}>
                            {msg.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Inline reply input */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const input = e.currentTarget.querySelector("input") as HTMLInputElement;
                      const text = input?.value?.trim();
                      if (!text || !selectedMessage) return;
                      input.value = "";
                      const tid = selectedMessage.threadId || selectedMessage.id;
                      // Determine recipients: reply to sender if inbox, reply to original recipients if sent
                      const replyTo = folder === "inbox"
                        ? [selectedMessage.senderId]
                        : selectedMessage.recipients.map((r) => r.userId);
                      try {
                        await messagesAPI.send({
                          subject: selectedMessage.subject.startsWith("Re: ") ? selectedMessage.subject : `Re: ${selectedMessage.subject}`,
                          body: text,
                          recipientIds: replyTo,
                          jobRef: selectedMessage.jobRef || undefined,
                          threadId: tid,
                        });
                        // Reload thread
                        const thread = await messagesAPI.getThread(tid);
                        setThreadMessages(thread);
                        fetchMessages();
                      } catch (err) {
                        console.error("Failed to send reply:", err);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center flex-shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full py-20">
                <div className="text-center">
                  <Mail className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Select a message to read</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
                          console.log("[Inbox] Selected recipient:", selectedId);
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

              {/* Subject */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Subject</label>
                <input
                  type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Message subject..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Message</label>
                <textarea
                  value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Type your message..."
                  rows={5}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
              </div>

              {/* Job link + Priority */}
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

              {/* Send */}
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
