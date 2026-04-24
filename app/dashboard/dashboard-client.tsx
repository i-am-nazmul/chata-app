"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Friend = {
  id: string;
  username: string;
  email: string;
};

type DashboardClientProps = {
  username: string;
  friends: Friend[];
};

export default function DashboardClient({ username, friends }: DashboardClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [suggestedFriend, setSuggestedFriend] = useState<Friend | null>(null);
  const [friendList, setFriendList] = useState(friends);
  const [statusMessage, setStatusMessage] = useState("");

  const friendCount = useMemo(() => friendList.length, [friendList.length]);

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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="relative w-full max-w-3xl rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-10">
        <div className="absolute right-5 top-5 group">
          <button
            type="button"
            aria-label="Add your friend"
            onClick={() => setIsOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              +
            </span>
          </button>
          <span className="pointer-events-none absolute right-0 top-12 hidden whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm group-hover:block">
            add ur friend
          </span>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          ChatApp Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
          Welcome to ChatApp, {username}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
          You are logged in and your session will remain active for one hour.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          >
            Logout
          </button>
          <Link
            href="/signup"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          >
            Go to signup
          </Link>
        </div>

        {isOpen ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/90 p-5">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearchFriend}>
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                type="text"
                placeholder="Enter friend's username"
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />
              <button
                type="submit"
                className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:border-slate-300 hover:bg-slate-800"
              >
                Search
              </button>
            </form>

            {statusMessage ? (
              <p className="mt-3 text-sm text-slate-600">{statusMessage}</p>
            ) : null}

            {suggestedFriend ? (
              <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {suggestedFriend.username}
                  </p>
                  <p className="text-xs text-slate-500">{suggestedFriend.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddFriend(suggestedFriend.id)}
                  className="rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-300 hover:bg-slate-800"
                >
                  Add friend
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Your friends
            </h2>
            <span className="text-xs text-slate-500">{friendCount} total</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {friendList.length ? (
              friendList.map((friend) => (
                <div
                  key={friend.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {friend.username}
                  </p>
                  <p className="text-xs text-slate-500">{friend.email}</p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 sm:col-span-2">
                No friends added yet.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}