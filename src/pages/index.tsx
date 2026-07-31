import Layout from '../components/Layout';
import Hero from '../components/Hero';
import AboutSection from '../components/AboutSection';
import HomeProjects from '../components/HomeProjects';
import HomeActivities from '../components/HomeActivities';

export default function Home() {
  return (
    <Layout>
      <Hero />
      <AboutSection />
      {/* 方案要求首页要有：热门 AI 项目、社团动态、招新入口。
          原来末尾还有一块 NewsSection 读静态 news.ts，与 HomeActivities 重复
          （活动成果已并入社团新闻，两块都从 posts 表来），所以去掉。 */}
      <HomeProjects />
      <HomeActivities />
    </Layout>
  );
}
