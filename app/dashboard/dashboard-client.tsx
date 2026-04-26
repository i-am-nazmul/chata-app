"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Socket } from "socket.io-client";
import { createChatSocket, type ChatMessage } from "@/lib/chat-socket";

type Friend = {
  id: string;
  username: string;
  email: string;
};

type DashboardClientProps = {
  username: string;
  userId: string;
  friends: Friend[];
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChatMessage>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.senderId === "string" &&
    typeof candidate.receiverId === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.read === "boolean" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function upsertMessage(messages: ChatMessage[], message: ChatMessage) {
  const existingIndex = messages.findIndex((entry) => entry.id === message.id);

  if (existingIndex === -1) {
    return [...messages, message];
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = message;
  return nextMessages;
}

function sortMessagesByDate(messages: ChatMessage[]) {
  return [...messages].sort((first, second) => {
    return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
  });
}

function mergeMessages(primary: ChatMessage[], secondary: ChatMessage[]) {
  const merged = [...primary];

  for (const message of secondary) {
    const existingIndex = merged.findIndex((entry) => entry.id === message.id);

    if (existingIndex === -1) {
      merged.push(message);
      continue;
    }

    merged[existingIndex] = message;
  }

  return sortMessagesByDate(merged);
}

export default function DashboardClient({ username, userId, friends }: DashboardClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [suggestedFriend, setSuggestedFriend] = useState<Friend | null>(null);
  const [friendList, setFriendList] = useState(friends);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState(() => {
    if (typeof window === "undefined") {
      return friends[0]?.id ?? "";
    }

    const storageKey = `chatapp:lastPeer:${userId}`;
    const savedPeerId = window.localStorage.getItem(storageKey);

    if (savedPeerId && friends.some((friend) => friend.id === savedPeerId)) {
      return savedPeerId;
    }

    return friends[0]?.id ?? "";
  });
  const [draftMessage, setDraftMessage] = useState("");
  const [messagesByPeer, setMessagesByPeer] = useState<Record<string, ChatMessage[]>>({});
  const [chatErrorByPeer, setChatErrorByPeer] = useState<Record<string, string>>({});
  const [historyLoadingByPeer, setHistoryLoadingByPeer] = useState<Record<string, boolean>>({});
  const socketMapRef = useRef<Record<string, Socket>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const storageKey = `chatapp:lastPeer:${userId}`;

  function getMessageStorageKey(peerId: string) {
    return `chatapp:messages:${userId}:${peerId}`;
  }

  function readStoredMessages(peerId: string) {
    if (typeof window === "undefined") {
      return [] as ChatMessage[];
    }

    try {
      const raw = window.localStorage.getItem(getMessageStorageKey(peerId));

      if (!raw) {
        return [] as ChatMessage[];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [] as ChatMessage[];
      }

      return parsed.filter(isChatMessage);
    } catch {
      return [] as ChatMessage[];
    }
  }

  function writeStoredMessages(peerId: string, messages: ChatMessage[]) {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(getMessageStorageKey(peerId), JSON.stringify(messages));
    } catch {
      // Ignore storage errors and keep in-memory state working.
    }
  }

  const friendCount = useMemo(() => friendList.length, [friendList.length]);
  const selectedFriend = friendList.find((friend) => friend.id === selectedFriendId) ?? null;
  const selectedMessages = selectedFriend ? messagesByPeer[selectedFriend.id] ?? [] : [];
  const isHistoryLoading = selectedFriend ? historyLoadingByPeer[selectedFriend.id] ?? false : false;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedFriendId) {
      window.localStorage.setItem(storageKey, selectedFriendId);
      return;
    }

    window.localStorage.removeItem(storageKey);
  }, [selectedFriendId, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedMessages]);

  useEffect(() => {
    return () => {
      Object.values(socketMapRef.current).forEach((socket) => {
        socket.removeAllListeners();
        socket.disconnect();
      });

      socketMapRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!selectedFriend) {
      return;
    }

    void connectSocket(selectedFriend.id).catch((error: unknown) => {
      setChatError(
        selectedFriend.id,
        error instanceof Error ? error.message : "Unable to connect to the chat server.",
      );
    });
  }, [selectedFriend]);

  useEffect(() => {
    if (!selectedFriend) {
      return;
    }

    const peerId = selectedFriend.id;
    let isActive = true;

    async function loadHistory() {
      setHistoryLoadingByPeer((current) => ({
        ...current,
        [peerId]: true,
      }));

      try {
        const response = await fetch(`/api/messages?peerId=${encodeURIComponent(peerId)}`);
        const data = (await response.json()) as {
          message?: string;
          messages?: ChatMessage[];
        };

        if (!response.ok) {
          if (isActive) {
            setChatError(peerId, data.message ?? "Unable to load messages.");
          }

          return;
        }

        if (isActive) {
          const storedMessages = readStoredMessages(peerId);
          const mergedMessages = mergeMessages(data.messages ?? [], storedMessages);

          setMessagesByPeer((current) => ({
            ...current,
            [peerId]: mergedMessages,
          }));
          writeStoredMessages(peerId, mergedMessages);
          clearChatFeedback(peerId);
        }
      } catch (error) {
        if (isActive) {
          setChatError(
            peerId,
            error instanceof Error ? error.message : "Unable to load messages.",
          );
        }
      } finally {
        if (isActive) {
          setHistoryLoadingByPeer((current) => ({
            ...current,
            [peerId]: false,
          }));
        }
      }
    }

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [selectedFriend]);

  function setChatError(peerId: string, message: string) {
    setChatErrorByPeer((current) => ({
      ...current,
      [peerId]: message,
    }));
  }

  function clearChatFeedback(peerId: string) {
    setChatErrorByPeer((current) => {
      if (!current[peerId]) {
        return current;
      }

      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }

  function appendMessage(peerId: string, message: ChatMessage) {
    setMessagesByPeer((current) => {
      const currentMessages = current[peerId] ?? [];
      const nextMessages = upsertMessage(currentMessages, message);
      const sortedMessages = sortMessagesByDate(nextMessages);

      writeStoredMessages(peerId, sortedMessages);

      return {
        ...current,
        [peerId]: sortedMessages,
      };
    });
  }

  function getOrCreateSocket(peerId: string) {
    const existingSocket = socketMapRef.current[peerId];

    if (existingSocket) {
      return existingSocket;
    }

    const socket = createChatSocket(userId, peerId);

    socket.on("connected", () => {});

    socket.on("peer:online", () => {});

    socket.on("message:sent", (message: unknown) => {
      if (isChatMessage(message)) {
        appendMessage(peerId, message);
        clearChatFeedback(peerId);
      }
    });

    socket.on("message:new", (message: unknown) => {
      if (isChatMessage(message)) {
        appendMessage(peerId, message);
      }
    });

    socket.on("connect_error", (error: Error) => {
      setChatError(peerId, error.message || "Unable to connect to the chat server.");
    });

    socket.on("error", (error: unknown) => {
      if (error instanceof Error) {
        setChatError(peerId, error.message);
        return;
      }

      if (typeof error === "string") {
        setChatError(peerId, error);
        return;
      }

      if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string") {
          setChatError(peerId, message);
          return;
        }
      }

      setChatError(peerId, "An unexpected socket error occurred.");
    });

    socketMapRef.current[peerId] = socket;
    return socket;
  }

  function connectSocket(peerId: string) {
    return new Promise<Socket>((resolve, reject) => {
      const socket = getOrCreateSocket(peerId);

      if (socket.connected) {
        resolve(socket);
        return;
      }

      const handleConnect = () => {
        socket.off("connect_error", handleConnectError);
        resolve(socket);
      };

      const handleConnectError = (error: Error) => {
        socket.off("connect", handleConnect);
        reject(error);
      };

      socket.once("connect", handleConnect);
      socket.once("connect_error", handleConnectError);
      socket.connect();
    });
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFriend) {
      setStatusMessage("Select a friend first.");
      return;
    }

    const content = draftMessage.trim();

    if (!content) {
      setChatError(selectedFriend.id, "Message content cannot be empty.");
      return;
    }

    setStatusMessage("");
    clearChatFeedback(selectedFriend.id);

    try {
      const socket = await connectSocket(selectedFriend.id);

      socket.emit(
        "message:send",
        { content },
        (response: unknown) => {
          if (typeof response === "string") {
            setChatError(selectedFriend.id, response);
            return;
          }

          if (!response || typeof response !== "object") {
            return;
          }

          const payload = response as Partial<ChatMessage> & { error?: string; message?: string };

          if (typeof payload.error === "string") {
            setChatError(selectedFriend.id, payload.error);
            return;
          }

          if (typeof payload.message === "string" && !isChatMessage(response)) {
            setChatError(selectedFriend.id, payload.message);
            return;
          }

          if (isChatMessage(response)) {
            appendMessage(selectedFriend.id, response);
          }
        },
      );

      setDraftMessage("");
    } catch (error) {
      setChatError(
        selectedFriend.id,
        error instanceof Error ? error.message : "Unable to connect to the chat server.",
      );
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleSearchFriend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    setSuggestedFriend(null);

    const response = await fetch(
      `/api/users/search?username=${encodeURIComponent(searchValue.trim())}`,
    );
    const data = (await response.json()) as {
      message?: string;
      user?: Friend;
    };

    if (!response.ok) {
      setStatusMessage(data.message ?? "No user found.");
      return;
    }

    setSuggestedFriend(data.user ?? null);
    setStatusMessage("Suggested profile found.");
  }

  async function handleAddFriend(friendUserId: string) {
    setStatusMessage("");

    const response = await fetch("/api/friends/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ friendUserId }),
    });

    const data = (await response.json()) as {
      message?: string;
      friend?: Friend;
    };

    if (!response.ok) {
      setStatusMessage(data.message ?? "Unable to add friend.");
      return;
    }

    if (data.friend) {
      setFriendList((currentFriends) => {
        if (currentFriends.some((friend) => friend.id === data.friend?.id)) {
          return currentFriends;
        }

        return [...currentFriends, data.friend as Friend];
      });
    }

    setSuggestedFriend(null);
    setSearchValue("");
    setStatusMessage(data.message ?? "Friend added.");
  }

  return (
    <main className="h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid h-full w-full max-w-7xl gap-4 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-amber-300 p-5 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Friends
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                {friendCount} total
              </h2>
            </div>
            <button
              type="button"
              aria-label="Add your friend"
              onClick={() => setIsOpen((current) => !current)}
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                +
              </span>
              <span className="pointer-events-none absolute mt-24 hidden whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm group-hover:block">
                add ur friend
              </span>
            </button>
          </div>

          <div className="mt-5 flex-1 space-y-3 overflow-hidden pr-1">
            {friendList.length ? (
              friendList.map((friend) => {
                const isActive = friend.id === (selectedFriend?.id ?? friendList[0]?.id);

                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-slate-300 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">{friend.username}</p>
                    <p className={`text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                      {friend.email}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No friends added yet.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          >
            Logout
          </button>
        </aside>

        <section className="relative flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-green-800 p-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-green-100">
            ChatApp Dashboard
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Welcome to ChatApp, {username}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-green-100">
            Pick a friend from the left panel and start a conversation on the right.
          </p>

          {isOpen ? (
            <div className="mt-8 rounded-3xl border border-green-300 bg-green-50/90 p-5">
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSearchFriend}>
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  type="text"
                  placeholder="Enter friend's username"
                  className="flex-1 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-green-400"
                />
                <button
                  type="submit"
                  className="h-11 min-w-[96px] rounded-2xl border border-green-200 bg-green-600 px-5 text-sm font-medium text-white shadow-sm transition hover:border-green-300 hover:bg-green-700"
                >
                  Search
                </button>
              </form>

              {statusMessage ? (
                <p className="mt-3 text-sm text-green-700">{statusMessage}</p>
              ) : null}

              {suggestedFriend ? (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-green-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {suggestedFriend.username}
                    </p>
                    <p className="text-xs text-slate-500">{suggestedFriend.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddFriend(suggestedFriend.id)}
                    className="rounded-full border border-green-200 bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:border-green-300 hover:bg-green-700"
                  >
                    Add friend
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-purple-600 p-5 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4 border-b border-purple-400 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-200">
                Conversation
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                {selectedFriend ? selectedFriend.username : "Select a friend"}
              </h2>
              {!selectedFriend ? (
                <p className="mt-1 text-xs text-purple-200">Your messages will appear here</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1 hide-scrollbar">
            {selectedFriend ? (
              isHistoryLoading ? (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-purple-300 bg-purple-500 px-6 py-10 text-center text-sm text-purple-200">
                  <div className="flex flex-col items-center gap-3">
                    <span
                      className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-white"
                      aria-label="Loading messages"
                    />
                    <span>Loading previous messages...</span>
                  </div>
                </div>
              ) : selectedMessages.length ? (
                <>
                  {selectedMessages.map((message) => {
                    const isMine = message.senderId !== selectedFriend.id;

                    return (
                      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                            isMine
                              ? "rounded-br-md bg-black text-white"
                              : "rounded-bl-md border border-white bg-white text-black"
                          }`}
                        >
                          <p>{message.content}</p>
                          <p className={`mt-2 text-[11px] ${isMine ? "text-slate-300" : "text-slate-600"}`}>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>

              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-purple-300 bg-purple-500 px-6 py-10 text-center text-sm text-purple-200">
                  Messages for {selectedFriend.username} will appear here once the socket sends them.
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-purple-300 bg-purple-500 px-6 py-10 text-center text-sm text-purple-200">
                Choose a friend from the left panel to open a chat session.
              </div>
            )}
          </div>

          {selectedFriend ? (
            <div className="mt-4 border-t border-purple-400 pt-4">
              {chatErrorByPeer[selectedFriend.id] ? (
                <p className="mb-3 rounded-2xl border border-red-300 bg-red-500 px-4 py-3 text-xs text-white">
                  {chatErrorByPeer[selectedFriend.id]}
                </p>
              ) : null}

              <form className="flex gap-3" onSubmit={handleSendMessage}>
                <input
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-2xl border border-white bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-slate-400 focus:border-white"
                />
                <button
                  type="submit"
                  className="rounded-2xl border border-white bg-black px-5 py-3 text-sm font-medium text-white transition hover:border-purple-300 hover:bg-slate-800"
                >
                  Send
                </button>
              </form>
              <p className="mt-2 text-xs text-purple-200">
                Socket.IO connects only when you send the first message for this chat.
              </p>
            </div>
          ) : (
            <div className="mt-4 border-t border-purple-400 pt-4 text-xs text-purple-200">
              Select a friend to enable chat.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}