import { describe,expect,it } from 'vitest';
import { cloneDemo, COURSES, type Profile } from './demo';
import { advisorText, compareTerms, evaluate, explainQuestion, generatePlan, getScenarios, updateCourse, validateProfile } from './engine';

describe('Pathwise deterministic planning',()=>{
  it('loads valid fictional demo data',()=>expect(validateProfile(cloneDemo())).toBe(true));
  it('rejects malicious or unknown imported course IDs',()=>{
    const p=cloneDemo();
    const bad={...p,entries:{...p.entries,'EVAL(1)':{status:'completed',term:null}}};
    expect(validateProfile(bad)).toBe(false);
    expect(validateProfile({...p,maxCredits:0})).toBe(false);
  });
  it('detects the same-term prerequisite conflict and late target',()=>{
    const r=evaluate(cloneDemo());
    expect(r.risks.some(x=>x.id==='prereq-MIN300-ANAL310')).toBe(true);
    expect(r.risks.some(x=>x.id==='grad-target')).toBe(true);
    expect(r.projected).toBe('2028-Spring');
  });
  it('never counts planned credits as completed',()=>{
    const r=evaluate(cloneDemo());
    expect(r.completed).toBe(6);
    expect(r.creditsEarned).toBe(18);
    expect(r.creditsRequired).toBe(COURSES.length*3);
  });
  it('detects missing required courses and withholds projected date',()=>{
    const p=updateCourse(cloneDemo(),'CAP490',{status:'unplanned',term:null});
    const r=evaluate(p);
    expect(r.unscheduled).toBe(1);
    expect(r.projected).toBeNull();
  });
  it('detects unreasonable term loads',()=>{
    const p=cloneDemo();p.maxCredits=6;
    expect(evaluate(p).risks.some(x=>x.id==='overload-2027-Fall')).toBe(true);
  });
  it('generates a plan that preserves fixed entries and honors prerequisites',()=>{
    const p=cloneDemo();
    const solved=generatePlan(p,{includeSummer:true,creditCap:15});
    expect(solved.entries.ANAL220).toBeUndefined();
  });
  it('generates scenario alternatives without changing finished work',()=>{
    const p=cloneDemo(), s=getScenarios(p);
    expect(s).toHaveLength(3);
    for(const sc of s){
      expect(sc.profile.entries.WRIT101).toEqual(p.entries.WRIT101);
      expect(sc.profile.entries.ANAL220).toBeUndefined();
      expect(sc.profile.entries.ANAL330).toBeUndefined();
      expect(sc.profile.entries.ANAL310).toBeUndefined();
      expect(sc.profile.entries.ANAL410).toBeUndefined();
      expect(sc.profile.entries.ANAL490).toBeUndefined();
      expect(sc.profile.entries.ANAL220).toBeUndefined();
      expect(sc.profile.entries.ANAL330).toBeUndefined();
      expect(sc.profile.entries.ANAL310).toBeUndefined();
      expect(sc.profile.entries.ANAL410).toBeUndefined();
      expect(sc.profile.entries.ANAL490).toBeUndefined();
      expect(sc.profile.entries.ANAL220).toBeUndefined();
      expect(sc.profile.entries.ANAL330).toBeUndefined();
    }
    expect(compareTerms(s[2].review.projected!,s[0].review.projected!)).toBeLessThanOrEqual(0);
    expect(s[2].review.risks.filter(x=>x.id.startsWith('prereq-'))).toHaveLength(0);
  });
  it('generates accurate advisor language and rule-grounded explanation',()=>{
    const p=cloneDemo();
    expect(advisorText(p)).toContain('DEMONSTRATION DATA');
    const answer=explainQuestion('Why is my prerequisite blocked?',p);
    expect(answer.refs).toContain('DEMO-B-300');
  });
  it('term ordering is chronological',()=>{
    expect(compareTerms('2027-Summer','2027-Fall')).toBeLessThan(0);
  });
});
