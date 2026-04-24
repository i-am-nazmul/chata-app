import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getAuthCookieName, getAuthMaxAgeSeconds, signAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    const { email, username, password } = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password) {
      return NextResponse.json(
        { message: "Email, username, and password are required." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Email or username already exists." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
    });

    const token = signAuthToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });

    const response = NextResponse.json(
      {
        message: "Account created successfully.",
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
        },
      },
      { status: 201 },
    );

    response.cookies.set(getAuthCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getAuthMaxAgeSeconds(),
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Unable to create your account right now." },
      { status: 500 },
    );
  }
}