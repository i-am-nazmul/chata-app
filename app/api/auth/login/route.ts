import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getAuthCookieName, getAuthMaxAgeSeconds, signAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    const token = signAuthToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });

    const response = NextResponse.json({
      message: "Logged in successfully.",
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
      },
    });

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
      { message: "Unable to log in right now." },
      { status: 500 },
    );
  }
}