/**
 * 中英文案 —— 词条直接内联在这里，不走 `public/locales/*.json`。
 *
 * 原因：站点只有两种语言、词条不多，内联能被 TS 检查到、也不会出现「上线后
 * 少传了一个 json 就整页空白」。`public/locales/` 下的文件已经不再使用。
 *
 * 只保留**代码里真的会用到**的词条。信息架构重排（活动成果并入社团新闻、
 * 项目共享并入开源社区、历任负责人删除）之后，一批词条已经没有引用方，
 * 留着会让人以为还有对应页面，所以一并清掉了。
 *
 * 另外：社区三个板块（学习资料 / 项目共享 / AI 论坛）和后台是中文单语页面，
 * 文案写在组件里，不进这份词表 —— 它们的领域名词（部门、标签、审核状态）
 * 本来就没有确定的英文说法，硬翻反而容易对不上。
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  zh: {
    translation: {
      home: '首页',
      about: '社团介绍',
      news: '社团新闻',
      community: '开源社区',
      contact: '联系我们',
      navTeam: '社团成员',
      navTools: 'AI 工具导航',
      navJoin: '加入我们',
      memberLogin: '成员登录',
      chinese: '中文',
      english: 'English',
      title: '浙江大学工程师学院人工智能俱乐部',
      hero: {
        // 用社团自己的战略定位当主标语：比「推动创新、培养领袖」这类通用口号更有信息量
        title: '从「会用」到「创用」',
        description:
          '浙江大学工程师学院人工智能俱乐部，聚焦最新 AI 技术与工具的落地应用，把 AI 嵌入学习与生活场景，提升效率、释放创造力。',
        cta: '加入我们',
      },
      aboutSection: {
        title: '关于我们',
        missionDesc:
          '成立于 2018 年，宗旨是求知 · 笃行 · 协作 · 创新；使命是学习前沿 · 探索工具 · 激发应用 · 创造价值。',
      },
      contactSection: {
        title: '联系我们',
        address: '地址',
        email: '邮箱',
        sendMessage: '发送消息',
        name: '姓名',
        message: '留言内容',
        submit: '提交',
      },
    },
  },
  en: {
    translation: {
      home: 'Home',
      about: 'About',
      news: 'News',
      community: 'Open Source Community',
      contact: 'Contact',
      navTeam: 'Members',
      navTools: 'AI Tool Directory',
      navJoin: 'Join Us',
      memberLogin: 'Member Login',
      chinese: '中文',
      english: 'English',
      title: 'AI Club, College of Engineering, Zhejiang University',
      hero: {
        title: 'From Using AI to Creating With It',
        description:
          'The AI Club of Zhejiang University College of Engineering focuses on putting the latest AI tools to practical use — bringing AI into study and daily work to save time and open up what students can build.',
        cta: 'Join Us',
      },
      aboutSection: {
        title: 'About Us',
        missionDesc:
          'Founded in 2018. Our creed: seek knowledge, act on it, work together, create. Our mission: follow the frontier, explore the tools, spark applications, create value.',
      },
      contactSection: {
        title: 'Contact Us',
        address: 'Address',
        email: 'Email',
        sendMessage: 'Send Message',
        name: 'Name',
        message: 'Message',
        submit: 'Submit',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
