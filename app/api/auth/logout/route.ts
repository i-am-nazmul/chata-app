import { NextResponse } from "next/server";
import { getAuthCookieName } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully." });

  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}