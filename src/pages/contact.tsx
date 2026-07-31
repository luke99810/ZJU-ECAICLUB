
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import { Loader2, Mail, MapPin, Navigation, Send } from 'lucide-react';
import { CONTACT } from '../data/club';
import { createMessage } from '../lib/store';

export default function Contact() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 留言真的写进数据层，社团成员在后台「留言管理」里能看到并标记处理。
   * 原来这里只是把按钮切成"已提交"，什么都没存 —— 提交完就没了，比不做还糟。
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await createMessage({
        name: formData.name,
        email: formData.email,
        body: formData.message,
      });
      setIsSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    } catch (err) {
      setError(`提交失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <section className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t('contact')}
          </h1>
          <p className="text-lg text-blue-100">
            如有任何问题或建议，欢迎与我们联系
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                {t('contactSection.title')}
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {t('contactSection.address')}
                    </h3>
                    <p className="text-gray-600">{CONTACT.address}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {t('contactSection.email')}
                    </h3>
                    <a
                      href={`mailto:${CONTACT.email}`}
                      className="text-gray-600 hover:text-blue-600 break-all"
                    >
                      {CONTACT.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      邮编
                    </h3>
                    <p className="text-gray-600">{CONTACT.postcode}</p>
                  </div>
                </div>
              </div>

              {/* 原来这里嵌了一张 Google 地图：国内打不开，指的还是旧地址，
                  留着只会显示一块空白。改成一句能直接复制去导航的地址。 */}
              <p className="mt-8 text-sm text-gray-500 leading-relaxed">
                导航请搜索「浙江大学工程师学院」或直接使用上方地址；
                学院位于杭州市拱墅区，地铁与公交均可直达。
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                {t('contactSection.sendMessage')}
              </h2>

              {isSubmitted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6">
                  <p className="font-medium text-emerald-900 mb-1.5">留言已收到</p>
                  <p className="text-sm text-emerald-800 leading-relaxed mb-4">
                    社团成员会在后台看到它并尽快回复到你留的邮箱。
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="text-sm text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
                  >
                    再留一条
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contactSection.name')}
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contactSection.email')}
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contactSection.message')}
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span>{t('contactSection.submit')}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
