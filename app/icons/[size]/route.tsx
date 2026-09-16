import { renderIcon } from "@/lib/icon";

/** Icon cho manifest. Android cần đúng 192 và 512 mới cho cài lên màn hình chính. */
const ALLOWED = new Set([192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const pixels = Number(size);
  if (!ALLOWED.has(pixels)) return new Response("Không có cỡ icon này", { status: 404 });
  return renderIcon(pixels);
}
