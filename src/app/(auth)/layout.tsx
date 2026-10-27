import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="system-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 rounded-md" aria-label="AWAKEN home">
        <Wordmark />
      </Link>
      <main className="w-full max-w-md animate-rise">{children}</main>
    </div>
  );
}
