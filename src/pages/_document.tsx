import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh">
      <Head>
        {/*
          favicon 用 logo 里的「AI」字母垫一块深色圆角底 —— 原图是为深色背景画的，
          白色笔画直接放到浅色标签页上会消失。完整版带 Club 字样，32px 里糊成一团，
          所以小尺寸只用字母。
          .ico 兜住老浏览器，.png 给现代浏览器与移动端书签。
        */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
