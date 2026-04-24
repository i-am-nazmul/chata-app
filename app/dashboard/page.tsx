import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthCookieName, verifyAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;

  if (!token) {
    redirect("/login");
  }

  let username = "User";
  let userId = "";

  try {
    const authToken = verifyAuthToken(token);
    username = authToken.username;
    userId = authToken.userId;
  } catch {
    redirect("/login");
  }

  await connectToDatabase();

  const user = await User.findById(userId).populate({
    path: "friends",
    select: "username email",
  });

  if (!user) {
    redirect("/login");
  }

  const friends = (user.friends as unknown as Array<{
    _id: { toString: () => string };
    username: string;
    email: string;
  }>).map((friend) => ({
    id: friend._id.toString(),
    username: friend.username,
    email: friend.email,
  }));

  return <DashboardClient username={user.username} friends={friends} />;
}