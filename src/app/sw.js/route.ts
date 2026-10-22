import { readFile } from "node:fs/promises";
import path from "node:path";

// Built once per deploy, with that deploy's id inside.
export const dynamic = "force-static";

export async function GET() {
  const source = await readFile(path.join(process.cwd(), "src/lib/sw/worker.js"), "utf8");
  return new Response(source.replace("__BUILD_ID__", process.env.NEXT_PUBLIC_BUILD_ID ?? "local"), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
