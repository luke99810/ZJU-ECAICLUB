import Header from './Header';
import Footer from './Footer';
import AssistantWidget from './AssistantWidget';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
      {/* AI 客服全站可用。后台 /admin 不套 Layout，所以只出现在对外页面。 */}
      <AssistantWidget />
    </div>
  );
}
