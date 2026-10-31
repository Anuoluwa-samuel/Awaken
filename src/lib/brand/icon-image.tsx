import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/** The logo mark (src/app/icon.svg) as a data URI that next/og can draw. */
export async function logoDataUri() {
  const svg = await readFile(path.join(process.cwd(), "src/app/icon.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** Square PNG of the logo on the app background, for touch icons, the manifest and favicon.ico. */
export async function iconResponse(size: number) {
  const logo = await logoDataUri();
  const mark = Math.round(size * 0.72);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060912",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
        <img src={logo} width={mark} height={Math.round((mark * 140) / 128)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
