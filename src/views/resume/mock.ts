/**
 * 简历模块 - 模拟数据（调试用）
 * ------------------------------------------------------------------
 * 提供一份内容完整、格式丰富的虚构简历示例数据，用于：
 *   - 调试模板渲染效果（多条目 / 多行描述转圆点列表 / 熟练度圆点 / 空字段隐藏）
 *   - 测试页面交互（填充示例 → 预览联动 → 保存 / 导出）
 * 内容全部为虚构人物，不涉及真实信息。
 */

import type { ResumeData } from './types'

/**
 * 生成一份模拟简历数据（每次调用返回全新副本，避免调用方互相污染）
 * @returns 完整的虚构简历数据
 */
export function createMockResumeData(): ResumeData {
  return {
    basics: {
      name: '李思远',
      jobIntent: '高级前端开发工程师',
      phone: '158****6688',
      email: 'lisiyuan.dev@163.com',
      gender: '男',
      age: '27',
      city: '杭州',
    },
    education: [
      {
        school: '浙江大学',
        major: '软件工程',
        degree: '硕士',
        startTime: '2020.09',
        endTime: '2023.06',
        description: '研究方向为可视化与智能交互\n获校级一等奖学金两次\n参与省级实验室开放课题一项',
      },
      {
        school: '武汉理工大学',
        major: '计算机科学与技术',
        degree: '本科',
        startTime: '2016.09',
        endTime: '2020.06',
        description: 'GPA 3.7 / 4.0，专业排名前 10%\n全国大学生数学建模竞赛省一等奖',
      },
    ],
    work: [
      {
        company: '杭州星图科技有限公司',
        position: '高级前端开发工程师',
        startTime: '2023.07',
        endTime: '至今',
        description: '负责数据可视化平台前端架构设计与核心模块开发，支撑日均百万级查询\n主导编辑器性能优化专项，首屏时间由 4.2s 降至 1.3s\n搭建前端工程化体系（构建提速 60%、ESLint 规范全覆盖）\n带领 3 人小组完成双周迭代，需求按时交付率 100%',
      },
      {
        company: '字节跳动（实习）',
        position: '前端开发实习生',
        startTime: '2022.06',
        endTime: '2022.12',
        description: '参与抖音创作者中台需求迭代，独立交付 12 个页面组件\n修复线上疑难缺陷 8 个，获季度优秀实习生',
      },
    ],
    project: [
      {
        name: '星图可视化编辑器',
        role: '前端负责人',
        startTime: '2024.03',
        endTime: '至今',
        description: '基于 Vue3 + Canvas 实现拖拽式大屏编辑器，支持 50+ 图表组件\n设计撤销/重做引擎与协同编辑数据协议\n沉淀组件开发规范，第三方组件接入成本降低 70%',
      },
      {
        name: '开源组件库 NovaUI',
        role: '核心贡献者',
        startTime: '2023.10',
        endTime: '2024.08',
        description: '从 0 到 1 参与开源 Vue3 组件库建设，贡献 20+ 组件\n编写单元测试 300+ 用例，覆盖率 92%',
      },
      {
        name: '毕业设计：流程图智能布局算法',
        role: '独立开发',
        startTime: '2022.09',
        endTime: '2023.05',
        description: '实现基于力导向与分层拓扑混合的自动布局算法\n论文获校级优秀毕业设计',
      },
    ],
    skills: [
      { name: 'Vue3 / TypeScript', level: 5 },
      { name: 'React', level: 4 },
      { name: 'Vite / 工程化', level: 4 },
      { name: 'Canvas / SVG 可视化', level: 4 },
      { name: 'Node.js', level: 3 },
    ],
    evaluation:
      '五年前端经验，深耕数据可视化与工程化方向\n具备从 0 到 1 的架构能力与跨团队协作经验\n持续输出技术博客与开源贡献，自驱力强',
    customSections: [
      {
        id: 'mock-honor',
        title: '获奖荣誉',
        rows: [
          {
            id: 'h-r1',
            blocks: [
              { id: 'h-b1', type: 'heading', span: 'left', text: '国家奖学金' },
              { id: 'h-b2', type: 'text', span: 'left', text: '教育部' },
              { id: 'h-b3', type: 'text', span: 'right', text: '2022.10' },
            ],
          },
          {
            id: 'h-r2',
            blocks: [{ id: 'h-b4', type: 'list', span: 'full', text: '综合评分专业第一\n全校仅 5 个名额' }],
          },
          {
            id: 'h-r3',
            blocks: [
              { id: 'h-b5', type: 'heading', span: 'left', text: 'ACM 区域赛银牌' },
              { id: 'h-b6', type: 'text', span: 'right', text: '2021.11' },
            ],
          },
        ],
      },
      {
        id: 'mock-hobby',
        title: '兴趣爱好',
        rows: [
          {
            id: 'hb-r1',
            blocks: [
              { id: 'hb-b1', type: 'textbox', span: 'full', text: '长跑：已完成 3 次半程马拉松\n摄影：专注城市纪实方向\n开源：活跃贡献者，累计 Star 500+' },
            ],
          },
        ],
      },
    ],
  }
}
