import "server-only";
import type { NextRequest } from "next/server";
import { verifyGenerationUser } from "@/lib/cards/verified-generation-user";
import { evaluateAdminAccess } from "./admin-access.mjs";

export type AdminAccessStatus = "disabled" | "unauthenticated" | "forbidden" | "allowed";

/**
 * Use this exact server-only gate in all future admin data routes. Do not
 * authorize using request headers, query parameters, email or user_metadata.
 * This only authenticates/authorizes; future admin mutations still need
 * same-origin checks, bounded bodies, rate limits, validation and audit logs.
 */
export async function resolveAdminAccess(request: NextRequest): Promise<AdminAccessStatus> {
  return evaluateAdminAccess({
    enabled: process.env.ENABLE_LEARNTRANSLATE_ADMIN,
    adminId: process.env.LEARNTRANSLATE_ADMIN_USER_ID,
    accessToken: request.cookies.get("lt_auth_access")?.value,
    verifyUser: verifyGenerationUser,
  });
}
