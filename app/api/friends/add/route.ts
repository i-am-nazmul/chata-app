import mongoose from "mongoose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthCookieName, verifyAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST(request: Request) {
  const session = await mongoose.startSession();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const currentUser = verifyAuthToken(token);
    const { friendUserId } = (await request.json()) as {
      friendUserId?: string;
    };

    if (!friendUserId) {
      return NextResponse.json(
        { message: "Friend user id is required." },
        { status: 400 },
      );
    }

    if (friendUserId === currentUser.userId) {
      return NextResponse.json(
        { message: "You cannot add yourself." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const current = await User.findById(currentUser.userId).select("friends");
    const friend = await User.findById(friendUserId).select("username email");

    if (!current || !friend) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const alreadyFriends = current.friends.some(
      (friendId) => friendId.toString() === friend._id.toString(),
    );

    if (alreadyFriends) {
      return NextResponse.json(
        { message: "This friend is already added." },
        { status: 409 },
      );
    }

    session.startTransaction();

    await User.updateOne(
      { _id: current._id },
      { $addToSet: { friends: friend._id } },
      { session },
    );

    await User.updateOne(
      { _id: friend._id },
      { $addToSet: { friends: current._id } },
      { session },
    );

    await session.commitTransaction();

    return NextResponse.json({
      message: "Friend added successfully.",
      friend: {
        id: friend._id.toString(),
        username: friend.username,
        email: friend.email,
      },
    });
  } catch {
    await session.abortTransaction();
    return NextResponse.json(
      { message: "Unable to add friend right now." },
      { status: 500 },
    );
  } finally {
    session.endSession();
  }
}