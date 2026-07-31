import '../i18n';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import DbStatusBanner from '../components/DbStatusBanner';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {/* 只在接了 Supabase 且连不上时才渲染，其余情况是个空组件 */}
      <DbStatusBanner />
    </>
  );
}

export default MyApp;
