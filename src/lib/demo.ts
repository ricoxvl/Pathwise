/* DEMONSTRATION RULES ONLY. Not a UT Dallas catalog or institutional audit. */
export const TERMS = ['2026-Fall', '2027-Spring', '2027-Summer', '2027-Fall', '2028-Spring', '2028-Summer', '2028-Fall', '2029-Spring', '2029-Summer', '2029-Fall'] as const;
export type Term = typeof TERMS[number];
export type CourseStatus = 'completed' | 'in-progress' | 'planned' | 'unplanned';
export type GroupId = 'foundation' | 'major' | 'breadth';

export type Course = {
  id: string;
  name: string;
  credits: number;
  group: GroupId;
  prerequisites: string[];
  ruleId: string;
  description: string;
};
export type PlanEntry = { status: CourseStatus; term: Term | null };
export type Profile = {
  student: string;
  program: string;
  catalogYear: string;
  target: Term;
  maxCredits: number;
  entries: Record<string, PlanEntry>;
};
export const GROUPS: Record<GroupId, { label: string; short: string }> = {
  foundation: { label: 'Foundations', short: 'Core' },
  major: { label: 'Applied analytics major', short: 'Major' },
  breadth: { label: 'Business breadth', short: 'Breadth' }
};
export const COURSES: Course[] = [
  { id: 'WRIT101', name: 'Writing Studio', credits: 3, group: 'foundation', prerequisites: [], ruleId: 'DEMO-F-101', description: 'Communication foundation' },
  { id: 'MATH110', name: 'Quantitative Foundations', credits: 3, group: 'foundation', prerequisites: [], ruleId: 'DEMO-F-110', description: 'Foundational quantitative reasoning' },
  { id: 'DATA120', name: 'Data Literacy', credits: 3, group: 'foundation', prerequisites: [], ruleId: 'DEMO-F-120', description: 'Foundations of data interpretation' },
  { id: 'CS150', name: 'Programming Basics', credits: 3, group: 'foundation', prerequisites: [], ruleId: 'DEMO-F-150', description: 'Computational foundations' },
  { id: 'STAT210', name: 'Applied Statistics', credits: 3, group: 'major', prerequisites: ['MATH110'], ruleId: 'DEMO-M-210', description: 'Statistics for decision-making' },
  { id: 'ANAL220', name: 'Data Systems', credits: 3, group: 'major', prerequisites: ['CS150'], ruleId: 'DEMO-M-220', description: 'Structured data and systems' },
  { id: 'ANAL330', name: 'Data Modeling', credits: 3, group: 'major', prerequisites: ['ANAL220'], ruleId: 'DEMO-M-330', description: 'Data organization and modeling' },
  { id: 'ANAL310', name: 'Predictive Analytics', credits: 3, group: 'major', prerequisites: ['STAT210', 'ANAL220'], ruleId: 'DEMO-M-310', description: 'Prediction methods and validation' },
  { id: 'ANAL410', name: 'Advanced Applications', credits: 3, group: 'major', prerequisites: ['ANAL330'], ruleId: 'DEMO-M-410', description: 'Applied systems in context' },
  { id: 'DATA315', name: 'Visualization Lab', credits: 3, group: 'major', prerequisites: ['DATA120'], ruleId: 'DEMO-M-315', description: 'Decision-focused visual communication' },
  { id: 'CAP490', name: 'Analytics Capstone', credits: 3, group: 'major', prerequisites: ['ANAL410', 'ANAL310'], ruleId: 'DEMO-M-490', description: 'Integration of major requirements' },
  { id: 'ECON230', name: 'Business Decisions', credits: 3, group: 'breadth', prerequisites: [], ruleId: 'DEMO-B-230', description: 'Economic thinking for business' },
  { id: 'FIN240', name: 'Finance Fundamentals', credits: 3, group: 'breadth', prerequisites: [], ruleId: 'DEMO-B-240', description: 'Finance fundamentals' },
  { id: 'MIN300', name: 'Finance Analytics', credits: 3, group: 'breadth', prerequisites: ['FIN240', 'ANAL310'], ruleId: 'DEMO-B-300', description: 'Interdisciplinary applied finance' }
];
export const COURSE_BY_ID: Record<string, Course> = Object.fromEntries(COURSES.map(c => [c.id, c]));
export const DEMO_PROFILE: Profile = {
  student: 'Alex Morgan (fictional)',
  program: 'Applied Analytics / sample program',
  catalogYear: '2026 demo requirements',
  target: '2027-Fall',
  maxCredits: 12,
  entries: {
    WRIT101: {status:'completed',term:null},
    MATH110: {status:'completed',term:null},
    DATA120: {status:'completed',term:null},
    CS150: {status:'completed',term:null},
    STAT210: {status:'completed',term:null},
    ECON230: {status:'completed',term:null},
    ANAL220: {status:'in-progress',term:'2026-Fall'},
    ANAL330: {status:'planned',term:'2027-Spring'},
    FIN240: {status:'planned',term:'2027-Spring'},
    ANAL310: {status:'planned',term:'2027-Fall'},
    ANAL410: {status:'planned',term:'2027-Fall'},
    DATA315: {status:'planned',term:'2027-Fall'},
    MIN300: {status:'planned',term:'2027-Fall'},
    CAP490: {status:'planned',term:'2028-Spring'}
  }
};
export const cloneDemo = (): Profile => JSON.parse(JSON.stringify(DEMO_PROFILE)) as Profile;
export const termLabel = (term: Term): string => {
  const [year, season] = term.split('-');
  return season + ' ' + year;
};
export const isTerm = (value: unknown): value is Term => typeof value === 'string' && (TERMS as readonly string[]).includes(value);
export const isCourseStatus = (value: unknown): value is CourseStatus => ['completed','in-progress','planned','unplanned'].includes(String(value));
export const DEMO_NOTICE = 'Illustrative academic program and fictional student. Not an official university degree audit. Future offerings and exceptions require advisor verification.';
