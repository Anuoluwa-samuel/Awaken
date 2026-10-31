import { iconResponse } from "@/lib/brand/icon-image";

// PNG icons for the web app manifest (src/app/manifest.ts).
const SIZES = ["192", "512"];

export const dynamicParams = false;
export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params;
  return iconResponse(Number(size));
}
