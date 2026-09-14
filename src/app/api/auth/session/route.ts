import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/rbac";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      roleKey: user.roleKey,
      permissions: Array.from(user.permissions),
    },
  });
}
