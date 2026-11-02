import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="system-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <header className="mb-8">
        <Link href="/" className="rounded-md" aria-label="AWAKEN home">
          <Wordmark />
        </Link>
      </header>
      <main className="w-full max-w-md animate-rise">{children}</main>
      <nav aria-label="Legal" className="mt-8 flex gap-4 text-xs text-ink-faint">
        <Link href="/guide" className="hover:text-ink">
          Guide
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
      </nav>
    </div>
  );
}
