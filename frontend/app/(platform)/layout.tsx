import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-sand-50">{children}</main>
      <Footer />
    </div>
  );
}
