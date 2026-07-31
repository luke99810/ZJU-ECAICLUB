import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Globe, Menu, X } from 'lucide-react';
import Link from 'next/link';
import Logo from './Logo';

/**
 * 导航。
 *
 * 信息架构重排后回到单层：项目共享并入开源社区、活动成果并入社团新闻、
 * 历任负责人删除，所以「更多」下拉不再需要，联系我们直接摆出来。
 */
type NavItem = { key: string; href: string };

const NAV: NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'about', href: '/about' },
  { key: 'navTeam', href: '/team' },
  { key: 'community', href: '/community' },
  { key: 'news', href: '/news' },
  { key: 'navTools', href: '/tools' },
  { key: 'contact', href: '/contact' },
];

export default function Header() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    localStorage.setItem('i18nextLng', newLang);
  };

  // 只有首页顶部是深色 Hero，透明导航配白字才看得见。其余页面顶部是浅色，
  // 必须一开始就用实底深字——否则白字压在浅蓝底上等于隐形。
  const overHero = router.pathname === '/' && !isScrolled;
  const solid = !overHero;
  const linkTone = solid ? 'text-gray-700' : 'text-white/90';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solid ? 'bg-white/95 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center space-x-2 shrink-0">
            <Logo size={40} />
            <span
              className={`font-bold text-base xl:text-xl hidden sm:block ${
                solid ? 'text-gray-900' : 'text-white'
              }`}
            >
              {t('title')}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-5">
            {NAV.map(item => (
              <Link
                key={item.key}
                href={item.href}
                className={`text-sm font-medium whitespace-nowrap transition-colors hover:text-blue-600 ${linkTone}`}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link
              href="/join"
              className="px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              {t('navJoin')}
            </Link>
            <Link
              href="/admin"
              className={`px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                solid
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              {t('memberLogin')}
            </Link>
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-lg transition-colors ${
                solid
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm">
                {i18n.language === 'zh' ? t('english') : t('chinese')}
              </span>
            </button>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`lg:hidden p-2 rounded-lg ${solid ? 'text-gray-700' : 'text-white'}`}
            aria-label="menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            {NAV.map(item => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="block text-gray-700 hover:text-blue-600 py-2"
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-gray-100 flex flex-wrap gap-2">
              <Link
                href="/join"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
              >
                {t('navJoin')}
              </Link>
              <Link
                href="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
              >
                {t('memberLogin')}
              </Link>
              <button
                onClick={() => {
                  toggleLanguage();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
              >
                <Globe className="w-4 h-4" />
                {i18n.language === 'zh' ? t('english') : t('chinese')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
