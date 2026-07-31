/**
 * 公开投稿的来源判定。
 *
 * 规则（社团定的）：邮箱是学校域名但人不在成员名单里 → 校友投稿；
 * 其他后缀 → 校外投稿。所以投稿表单里邮箱是必填的 —— 它不只是联系方式，
 * 还决定这条投稿归到哪一档、由谁来审。
 */
import { getMemberByEmail } from './store';
import type { SubmissionOrigin } from '../types';

/** 学校邮箱域名。包含子域（如 stu.zju.edu.cn）也算校内。 */
export const CAMPUS_EMAIL_DOMAIN = 'zju.edu.cn';

export function isCampusEmail(email: string): boolean {
  const addr = email.trim().toLowerCase();
  const at = addr.lastIndexOf('@');
  if (at < 0) return false;
  const host = addr.slice(at + 1);
  return host === CAMPUS_EMAIL_DOMAIN || host.endsWith(`.${CAMPUS_EMAIL_DOMAIN}`);
}

export interface ClassifyResult {
  origin: SubmissionOrigin;
  /**
   * 邮箱对上了在册成员。这种情况**不该走公开投稿** —— 让他登录后台提交，
   * 项目才会挂到他自己名下、出现在「我的项目」里。
   */
  isRegisteredMember: boolean;
}

export async function classifySubmission(email: string): Promise<ClassifyResult> {
  const member = await getMemberByEmail(email);
  if (member) return { origin: 'member', isRegisteredMember: true };
  return {
    origin: isCampusEmail(email) ? 'alumni' : 'external',
    isRegisteredMember: false,
  };
}
