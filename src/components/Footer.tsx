
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Navigation } from 'lucide-react';
import GithubIcon from './icons/GithubIcon';
import Logo from './Logo';
import { CONTACT } from '../data/club';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Logo size={44} />
              <span className="font-bold text-xl">{t('title')}</span>
            </div>
            <p className="text-gray-400 mb-4">
              {t('aboutSection.missionDesc')}
            </p>
            <div className="flex space-x-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <GithubIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t('contact')}</h3>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{CONTACT.address}</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="w-4 h-4 shrink-0" />
                <a href={`mailto:${CONTACT.email}`} className="hover:text-white break-all">
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Navigation className="w-4 h-4 shrink-0" />
                <span>邮编 {CONTACT.postcode}</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  {t('about')}
                </a>
              </li>
              <li>
                <a href="/news" className="hover:text-white transition-colors">
                  {t('news')}
                </a>
              </li>
              <li>
                <a href="/community" className="hover:text-white transition-colors">
                  {t('community')}
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:text-white transition-colors">
                  {t('contact')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
          <p>&copy; 2024 {t('title')}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
