import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthCookieName, verifyAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const currentUser = verifyAuthToken(token);
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return NextResponse.json(
        { message: "Username is required." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const user = await User.findOne({
      username: { $regex: `^${escapeRegex(username)}$`, $options: "i" },
    }).select("username email");

    if (!user || user._id.toString() === currentUser.userId) {
      return NextResponse.json({ message: "No user found." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to search users right now." },
      { status: 500 },
    );
  }
}