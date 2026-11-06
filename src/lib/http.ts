import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { AppError, badRequest } from "./errors";

export function ok(data: unknown, status = 200) { return NextResponse.json({ ok: true, data }, { status }); }

export function fail(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ ok: false, error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ ok: false, error: { code: "validation", message: "Check the highlighted fields.", details: e.flatten().fieldErrors } }, { status: 422 });
  const pgCode = (e as { code?: string })?.code;
  if (pgCode === "P0001") return NextResponse.json({ ok: false, error: { code: "locked", message: (e as Error).message } }, { status: 409 });
  console.error("[api] unhandled", e);
  return NextResponse.json({ ok: false, error: { code: "server_error", message: "Something went wrong on our side. Try again." } }, { status: 500 });
}

/** Wrap a route handler with structured error handling. */
export function route<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => { try { return await fn(...a); } catch (e) { return fail(e); } };
}

export async function body<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw badRequest("Request body must be JSON."); }
  return schema.parse(raw);
}
