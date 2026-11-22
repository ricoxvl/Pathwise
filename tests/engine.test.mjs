import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloneDemo, COURSES } from '../src/lib/demo.ts';
import { advisorText, compareTerms, evaluate, explainQuestion, generatePlan, getScenarios, updateCourse, validateProfile } from '../src/lib/engine.ts';

test('fictional demo profile validates, unknown courses and invalid limits do not',()=>{
  const p=cloneDemo();
  assert.equal(validateProfile(p),true);
  assert.equal(validateProfile({...p,maxCredits:0}),false);
  assert.equal(validateProfile({...p,entries:{...p.entries,'FAKE999':{status:'completed',term:null}}}),false);
});
test('flags same-term prerequisites and late target',()=>{
  const review=evaluate(cloneDemo());
  assert.ok(review.risks.some(r=>r.id==='prereq-MIN300-ANAL310'));
  assert.ok(review.risks.some(r=>r.id==='grad-target'));
  assert.equal(review.projected,'2028-Spring');
});
test('counts only completed credits as earned',()=>{
  const r=evaluate(cloneDemo());
  assert.equal(r.completed,6);
  assert.equal(r.creditsEarned,18);
  assert.equal(r.creditsRequired,COURSES.length*3);
});
test('flags missing courses and withholds a projection',()=>{
  const p=updateCourse(cloneDemo(),'CAP490',{status:'unplanned',term:null});
  const r=evaluate(p);
  assert.equal(r.unscheduled,1);
  assert.equal(r.projected,null);
});
test('warns on overloaded terms',()=>{
  const p=cloneDemo();p.maxCredits=6;
  assert.ok(evaluate(p).risks.some(r=>r.id==='overload-2027-Fall'));
});
test('scenario solver preserves fixed coursework and prerequisites',()=>{
  const p=cloneDemo(), solved=generatePlan(p,{includeSummer:true,creditCap:15});
  assert.deepEqual(solved.entries.WRIT101,p.entries.WRIT101);
  assert.deepEqual(solved.entries['ANAL220'],p.entries['ANAL220']);
  assert.equal(evaluate(solved).risks.filter(r=>r.id.startsWith('prereq-')).length,0);
});
test('summer-enabled scenario does not forecast later than existing draft',()=>{
  const s=getScenarios(cloneDemo());
  assert.equal(s.length,3);
  assert.ok(s[2].review.projected);
  assert.ok(s[0].review.projected);
  assert.ok(compareTerms(s[2].review.projected,s[0].review.projected)<=0);
});
test('advisor brief and explanation identify their synthetic provenance',()=>{
  const p=cloneDemo();
  assert.match(advisorText(p),/DEMONSTRATION DATA/);
  assert.ok(explainQuestion('Why is my prerequisite blocked?',p).refs.includes('DEMO-B-300'));
  assert.ok(compareTerms('2027-Summer','2027-Fall')<0);
});
