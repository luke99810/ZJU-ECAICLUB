/**
 * 留言种子数据 —— 让后台的留言管理页一打开就有东西可看，不是一片空白。
 *
 * 三条覆盖三种状态，顺便也覆盖三类典型来源：校内同学问招新、校外单位谈合作、
 * 已经处理完的旧留言。上线前替换或清空即可。
 */
import type { Message } from '../types';

const AT = (d: string) => new Date(d).toISOString();

export const seedMessages: Message[] = [
  {
    id: 'msg-1',
    name: '周同学',
    email: 'zhou@zju.edu.cn',
    body: '想问一下秋季纳新什么时候开始？我是机械专业的研一，没有 AI 基础，能报技术部吗？',
    status: 'new',
    created_at: AT('2026-07-28'),
  },
  {
    id: 'msg-2',
    name: '李经理',
    email: 'li@example.com',
    body: '我们是做工业质检的公司，想和贵社团聊一聊校企合作，能否安排一次线上沟通？',
    status: 'new',
    created_at: AT('2026-07-25'),
  },
  {
    id: 'msg-3',
    name: '王同学',
    email: 'wang@zju.edu.cn',
    body: '官网的 AI 工具导航里能不能加上 NotebookLM？我们组读文献一直在用。',
    status: 'handled',
    handled_by: '李伟',
    handled_at: AT('2026-07-20'),
    created_at: AT('2026-07-18'),
  },
];
