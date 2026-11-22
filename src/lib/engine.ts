import { COURSE_BY_ID, COURSES, GROUPS, TERMS, type Course, type GroupId, type PlanEntry, type Profile, type Term, isCourseStatus, isTerm, termLabel } from './demo.ts';

export type Risk = {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
  action: string;
  courseIds: string[];
  ruleIds: string[];
};
export type GroupProgress = { id: GroupId; label: string; done: number; total: number; credits: number; earned: number };
export type Review = {
  risks: Risk[];
  groups: GroupProgress[];
  completed: number;
  total: number;
  creditsEarned: number;
  creditsRequired: number;
  projected: Term | null;
  targetMet: boolean;
  termCredits: Partial<Record<Term, number>>;
  unscheduled: number;
};
export const getEntry = (profile: Profile, id: string): PlanEntry => profile.entries[id] ?? { status: 'unplanned', term: null };
export const termIndex = (t: Term | null | undefined): number => t ? TERMS.indexOf(t) : -1;
export const compareTerms = (a: Term, b: Term): number => termIndex(a) - termIndex(b);
export const isFixed = (entry: PlanEntry): boolean => entry.status === 'completed' || entry.status === 'in-progress';
export function validateProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  if (typeof p.student !== 'string' || p.student.length > 80 || !p.student.trim() ||
      typeof p.program !== 'string' || p.program.length > 120 ||
      typeof p.catalogYear !== 'string' || p.catalogYear.length > 80 ||
      !isTerm(p.target) || !Number.isInteger(p.maxCredits) || Number(p.maxCredits) < 3 || Number(p.maxCredits) > 24 ||
      !p.entries || typeof p.entries !== 'object' || Array.isArray(p.entries)) return false;
  const entries = p.entries as Record<string, unknown>;
  if (Object.keys(entries).some(id => !Object.hasOwn(COURSE_BY_ID,id))) return false;
  return Object.values(entries).every(value => {
    if (!value || typeof value !== 'object') return false;
    const e = value as Record<string, unknown>;
    return isCourseStatus(e.status) && (e.term === null || isTerm(e.term)) &&
      (e.status === 'completed' || e.status === 'unplanned' ? e.term === null : isTerm(e.term));
  });
}
function risk(id:string,severity:Risk['severity'],title:string,detail:string,action:string,courseIds:string[],ruleIds:string[]):Risk {
  return {id,severity,title,detail,action,courseIds,ruleIds};
}
export function evaluate(profile: Profile): Review {
  const risks:Risk[]=[];
  const termCredits: Partial<Record<Term, number>> = {};
  let completed=0; let creditsEarned=0; let unscheduled=0;
  const creditsRequired=COURSES.reduce((n,c)=>n+c.credits,0);
  for(const c of COURSES) {
    const e=getEntry(profile,c.id);
    if(e.status === 'completed') { completed++; creditsEarned+=c.credits; }
    if(e.status === 'unplanned' || (!e.term && e.status !== 'completed')) {
      unscheduled++;
      risks.push(risk('missing-'+c.id,'medium',c.id+' is not scheduled',
        c.name+' remains required by this fictional demo program and has no usable plan.',
        'Add the course to a semester after reviewing its prerequisites.',[c.id],[c.ruleId]));
    }
    if(e.term && (e.status === 'in-progress' || e.status === 'planned')) {
      termCredits[e.term]=(termCredits[e.term]??0)+c.credits;
      for(const pre of c.prerequisites) {
        const earlier=getEntry(profile,pre);
        const valid=earlier.status==='completed' || (earlier.term !== null &&
          (earlier.status==='in-progress'||earlier.status==='planned') && compareTerms(earlier.term,e.term)<0);
        if(!valid) {
          risks.push(risk('prereq-'+c.id+'-'+pre,'high','Prerequisite sequence needs attention',
            c.id+' requires '+pre+' before '+termLabel(e.term)+'. Your current plan does not establish an earlier completion.',
            'Move '+pre+' to an earlier term or reschedule '+c.id+'. Confirm the rule with an advisor.',[c.id,pre],[c.ruleId]));
        }
      }
    }
  }
  for(const t of TERMS) {
    const credits=termCredits[t]??0;
    if(credits>profile.maxCredits) risks.push(risk('overload-'+t,'medium','Workload exceeds your preference',
      termLabel(t)+' contains '+credits+' planned credits, above your '+profile.maxCredits+'-credit preference.',
      'Move a course to another semester or adjust your preferred limit.',[],['DEMO-PLAN-LOAD']));
  }
  const plannedTerms=COURSES.map(c=>getEntry(profile,c.id)).filter(e=>e.status==='in-progress'||e.status==='planned').map(e=>e.term);
  const projected = unscheduled ? null : plannedTerms.reduce<Term|null>((latest,t)=>t && (!latest || compareTerms(t,latest)>0) ? t : latest,null);
  const targetMet=!!projected && compareTerms(projected,profile.target)<=0 && risks.every(r=>r.severity!=='high');
  if(projected && compareTerms(projected,profile.target)>0) {
    risks.push(risk('grad-target','high','Target graduation may be affected',
      'Your current sequence extends through '+termLabel(projected)+', after your '+termLabel(profile.target)+' target.',
      'Compare the summer or revised-load scenarios. Course availability remains unverified.',[],['DEMO-PLAN-TARGET']));
  }
  risks.sort((a,b)=>({high:0,medium:1,info:2}[a.severity]-{high:0,medium:1,info:2}[b.severity]));
  const groups=(Object.keys(GROUPS) as GroupId[]).map(id=>{
    const list=COURSES.filter(c=>c.group===id);
    return {id,label:GROUPS[id].label,total:list.length,done:list.filter(c=>getEntry(profile,c.id).status==='completed').length,credits:list.reduce((n,c)=>n+c.credits,0),earned:list.filter(c=>getEntry(profile,c.id).status==='completed').reduce((n,c)=>n+c.credits,0)};
  });
  return {risks,groups,completed,total:COURSES.length,creditsEarned,creditsRequired,projected,targetMet,termCredits,unscheduled};
}
export function updateCourse(profile:Profile,id:string,entry:PlanEntry):Profile {
  if(!Object.hasOwn(COURSE_BY_ID,id) || !isCourseStatus(entry.status) ||
     (entry.term!==null && !isTerm(entry.term))) return profile;
  return {...profile,entries:{...profile.entries,[id]:entry}};
}
export type Scenario = {id:string; title:string; subtitle:string; profile:Profile; review:Review; note:string; changed:number; kind:'baseline'|'alternative'};
export type ScenarioConfig = {includeSummer:boolean; creditCap:number};
export function generatePlan(profile:Profile,config:ScenarioConfig):Profile {
  const entries:Record<string,PlanEntry>={};
  const loads:Partial<Record<Term,number>>={};
  const pending=new Map<string,Course>();
  for(const c of COURSES) {
    const e=getEntry(profile,c.id);
    if(isFixed(e)) {
      entries[c.id]={...e};
      if(e.term)loads[e.term]=(loads[e.term]??0)+c.credits;
    } else pending.set(c.id,c);
  }
  let rounds=0;
  while(pending.size && rounds++<COURSES.length+1) {
    let progressed=false;
    for(const [id,c] of [...pending]) {
      if(!c.prerequisites.every(pre=>!!entries[pre] && entries[pre].status!=='unplanned'))continue;
      const candidates=TERMS.filter(t=> compareTerms(t,'2026-Fall')>0 &&
        (config.includeSummer || !t.includes('Summer')) &&
        (loads[t]??0)+c.credits<=config.creditCap &&
        c.prerequisites.every(pre=>{
          const e=entries[pre];
          return e.status==='completed' || (e.term!==null && compareTerms(e.term,t)<0);
        }));
      const term=candidates[0]??null;
      entries[id]={status:term?'planned':'unplanned',term};
      if(term)loads[term]=(loads[term]??0)+c.credits;
      pending.delete(id);progressed=true;
    }
    if(!progressed)break;
  }
  for(const id of pending.keys())entries[id]={status:'unplanned',term:null};
  return {...profile,entries};
}
export function getScenarios(profile:Profile):Scenario[] {
  const baseline=evaluate(profile);
  const balanced=generatePlan(profile,{includeSummer:false,creditCap:profile.maxCredits});
  const fast=generatePlan(profile,{includeSummer:true,creditCap:Math.min(18,Math.max(profile.maxCredits,15))});
  return [
    {id:'current',title:'Your current plan',subtitle:'The schedule you have drafted',profile,review:baseline,changed:0,note:'Reflects your current inputs. No future course offerings are verified.',kind:'baseline'},
    {id:'balanced',title:'Balanced semesters',subtitle:'Respect your course-load preference',profile:balanced,review:evaluate(balanced),changed:countMoves(profile,balanced),note:'Rearranges future courses while preserving completed and in-progress courses. Assumes all proposed offerings exist.',kind:'alternative'},
    {id:'accelerated',title:'Summer pathway',subtitle:'Explore an earlier conditional sequence',profile:fast,review:evaluate(fast),changed:countMoves(profile,fast),note:'Allows summer terms and up to 15 credits per term. Availability, workload suitability and institutional approval are unverified.',kind:'alternative'}
  ];
}
function countMoves(a:Profile,b:Profile):number {
  return COURSES.filter(c=>!isFixed(getEntry(a,c.id)) && (getEntry(a,c.id).term!==getEntry(b,c.id).term)).length;
}
export function explainQuestion(question:string,profile:Profile):{heading:string;body:string;refs:string[]} {
  const q=question.toLowerCase();
  const rev=evaluate(profile);
  const prereq=rev.risks.filter(r=>r.id.startsWith('prereq-'));
  if(/prereq|sequence|blocked|bottleneck/.test(q)) {
    return {heading:'The prerequisite chain',body:prereq.length ?
      'I found '+prereq.length+' sequencing conflict(s) in your draft. '+prereq.map(r=>r.detail).join(' ')+' Move the prerequisite earlier or the dependent course later. These are synthetic rules, not university determinations.' :
      'I do not see a prerequisite-order conflict in this draft. That does not prove the schedule is valid: future offerings and exceptions have not been verified.',
      refs:prereq.flatMap(r=>r.ruleIds).length?prereq.flatMap(r=>r.ruleIds):['DEMO-M-330','DEMO-M-490']};
  }
  if(/graduate|graduation|target|delay|on.track|timeline/.test(q)) {
    return {heading:'Your graduation outlook',body:rev.projected ?
      'Your draft extends through '+termLabel(rev.projected)+', compared with a target of '+termLabel(profile.target)+'. '+(rev.targetMet?'The computed plan meets the target under the demo rules.':'It does not currently establish a valid on-time path.')+' The result is conditional; it cannot verify course availability or official degree eligibility.' :
      'Your current draft has unscheduled requirements, so a credible completion term cannot be calculated. Schedule missing courses before comparing timelines.',
      refs:['DEMO-PLAN-TARGET',...rev.risks.filter(r=>r.severity==='high').flatMap(r=>r.ruleIds)]};
  }
  if(/credit|requirement|missing|progress|complete/.test(q)) {
    return {heading:'Your requirements',body:'You have marked '+rev.creditsEarned+' of '+rev.creditsRequired+' example credits completed ('+rev.completed+' of '+rev.total+' courses). '+(rev.unscheduled?rev.unscheduled+' requirements lack a proposed semester. ':'')+' Credits earned alone do not confirm graduation eligibility; individual requirements and prerequisite ordering matter.',
      refs:['DEMO-F-101','DEMO-M-490']};
  }
  if(/summer|what.if|alternative|scenario|lighter|12/.test(q)) {
    const scenarios=getScenarios(profile); const a=scenarios[2];
    return {heading:'Compare your options',body:'An accelerated, summer-enabled arrangement produces a conditional endpoint of '+(a.review.projected?termLabel(a.review.projected):'unknown')+'. It changes '+a.changed+' future course placements. This is a constraint-based estimate, not a verified timetable. Open What-if Studio to review and apply it.',
      refs:['DEMO-PLAN-TARGET','DEMO-PLAN-LOAD']};
  }
  if(/advisor|transfer|exception|policy|source/.test(q)) {
    return {heading:'What to confirm with an advisor',body:'Ask your advisor to verify: (1) which catalog applies, (2) the prerequisites and minimum grades for high-risk courses, (3) whether the proposed courses will be offered, and (4) any transfer equivalency or exception. Pathwise cannot grant academic approvals.',refs:['DEMO-PLAN-TARGET','DEMO-PLAN-LOAD']};
  }
  return {heading:'Here is what the plan tells us',body:'The demo rule checker found '+rev.risks.filter(r=>r.severity==='high').length+' high-priority warning(s). Try asking about prerequisites, graduation timing, missing requirements, summer plans, or advisor questions. This guided explainer uses deterministic rules—not a live language model.',refs:['DEMO-PLAN-TARGET']};
}
export function advisorText(profile:Profile):string {
  const r=evaluate(profile);
  const lines=[
    'PATHWISE | ADVISOR PREPARATION BRIEF',
    'DEMONSTRATION DATA — NOT AN OFFICIAL DEGREE AUDIT',
    '',
    'Student: '+profile.student,
    'Program: '+profile.program,
    'Catalog: '+profile.catalogYear,
    'Target: '+termLabel(profile.target),
    'Draft endpoint: '+(r.projected?termLabel(r.projected):'Unresolved'),
    'Example credits completed: '+r.creditsEarned+' / '+r.creditsRequired,
    '',
    'ITEMS TO REVIEW'
  ];
  if(!r.risks.length)lines.push('No deterministic warnings in the selected demo rules. Official validation still required.');
  r.risks.forEach((risk,i)=>lines.push(String(i+1)+'. '+risk.title+' — '+risk.detail+' Next: '+risk.action+' [Rule: '+risk.ruleIds.join(', ')+']'));
  lines.push('', 'QUESTIONS FOR MY ADVISOR',
    '1. Which catalog rules and program requirements apply to me?',
    '2. Are my prerequisites and credit allocations correct?',
    '3. Which proposed future offerings are confirmed?',
    '4. Do any transfer credits, substitutions, or exceptions need approval?',
    '', 'LIMITATIONS',
    'This brief uses fictional course requirements and student-controlled inputs. It does not confirm university enrollment, course availability, completion eligibility, policy exceptions, or adviser approval.');
  return lines.join('\n');
}
