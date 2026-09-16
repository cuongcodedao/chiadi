import { renderIcon } from "@/lib/icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return renderIcon(32);
}
