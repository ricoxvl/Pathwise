import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays,
  Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, ClipboardList,
  Clock3, Compass, Download, FileDown, FileText, GraduationCap, HelpCircle, Info,
  Layers3, LayoutDashboard, LockKeyhole, Menu, MessageCircle, MoveRight, Network,
  RotateCcw, Route, Search, Send, Settings2, ShieldCheck, Sparkles, Target, Upload,
  WandSparkles, X, type LucideIcon
} from 'lucide-react';
import {
  COURSES, COURSE_BY_ID, GROUPS, TERMS, cloneDemo, DEMO_NOTICE,
  type Course, type CourseStatus, type GroupId, type PlanEntry, type Profile, type Term, termLabel
} from './lib/demo';
import {
  advisorText, evaluate, explainQuestion, getEntry, getScenarios,
  updateCourse, validateProfile, type Review, type Risk, type Scenario
} from './lib/engine';

type Page = 'overview' | 'requirements' | 'planner' | 'scenarios' | 'assistant' | 'advisor' | 'settings';
const STORAGE_KEY = 'pathwise.local.plan.v1';
const NAV_ITEMS: { id: Page; label: string; icon: LucideIcon; group: 'primary' | 'tools' }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'primary' },
  { id: 'requirements', label: 'Degree requirements', icon: BookOpen, group: 'primary' },
  { id: 'planner', label: 'Semester planner', icon: CalendarDays, group: 'primary' },
  { id: 'scenarios', label: 'What-if studio', icon: Route, group: 'primary' },
  { id: 'assistant', label: 'Ask Pathwise', icon: Sparkles, group: 'tools' },
  { id: 'advisor', label: 'Advisor brief', icon: ClipboardList, group: 'tools' },
  { id: 'settings', label: 'Data & preferences', icon: Settings2, group: 'tools' }
];
const PAGE_META: Record<Page, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'THE BIG PICTURE', title: 'A clearer path to graduation.', description: 'See what is complete, what is coming up, and where your plan needs attention.' },
  requirements: { eyebrow: 'YOUR DEGREE, DECODED', title: 'Every requirement, in context.', description: 'See completion status, prerequisite rules, and the source behind each demo requirement.' },
  planner: { eyebrow: 'BUILD YOUR NEXT CHAPTER', title: 'Plan semesters with confidence.', description: 'Move courses, adjust the workload, and see constraints update as you make decisions.' },
  scenarios: { eyebrow: 'COMPARE YOUR OPTIONS', title: 'What if you took a different path?', description: 'Explore rule-based alternatives and understand the trade-offs before making a change.' },
  assistant: { eyebrow: 'GROUNDED ANSWERS', title: 'Questions, meet clarity.', description: 'Get guided explanations of your current plan, with transparent demo rule references.' },
  advisor: { eyebrow: 'FROM INSIGHT TO ACTION', title: 'Walk into advising prepared.', description: 'Turn concerns and unresolved assumptions into a structured discussion.' },
  settings: { eyebrow: 'YOUR INFORMATION, YOUR CHOICE', title: 'Keep control of your plan.', description: 'Customize the demo and manage data stored only in your browser.' }
};
const examples = [
  'Why is my graduation plan delayed?',
  'Which prerequisite is blocking me?',
  'What changes if I take summer classes?',
  'What should I ask my advisor?'
];

function initialProfile(): Profile {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (validateProfile(parsed)) return parsed;
    }
  } catch { /* malformed or unavailable localStorage; use demo */ }
  return cloneDemo();
}
function initialPage(): Page {
  const part = window.location.hash.replace('#/', '');
  return NAV_ITEMS.some(item => item.id === part) ? part as Page : 'overview';
}
function percent(done: number, total: number): number { return total ? Math.round(done / total * 100) : 0; }
function riskCounts(r: Review) { return { high: r.risks.filter(x=>x.severity==='high').length, medium: r.risks.filter(x=>x.severity==='medium').length }; }
function statusLabel(s: CourseStatus): string {
  return { completed: 'Completed', 'in-progress': 'In progress', planned: 'Planned', unplanned: 'Not planned' }[s];
}
function displayStudent(student:string): string { return student.split(' ')[0] || 'Student'; }

function Button({ children, onClick, variant='primary', className='', icon:Icon, disabled=false, type='button' }: {
  children: ReactNode; onClick?:()=>void; variant?:'primary'|'outline'|'ghost'; className?:string;
  icon?:LucideIcon; disabled?:boolean; type?:'button'|'submit'
}) {
  return <button type={type} onClick={onClick} disabled={disabled} className={'btn btn-'+variant+' '+className}>
    {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true"/>}<span>{children}</span>
  </button>;
}
function SectionHead({ kicker, title, linkText, onLink }: {kicker?:string;title:string;linkText?:string;onLink?:()=>void}) {
  return <div className="section-head">
    <div>{kicker && <p className="eyebrow micro-eyebrow">{kicker}</p>}<h2>{title}</h2></div>
    {linkText && onLink && <button className="section-link" onClick={onLink}>{linkText}<ArrowRight size={15}/></button>}
  </div>;
}
function Panel({ children, className='' }: {children:ReactNode;className?:string}) {return <section className={'panel '+className}>{children}</section>;}
function Disclaimer({ short=false }: {short?:boolean}) {
  return <div className={'demo-banner '+(short?'compact':'')}><Info size={16} aria-hidden="true"/><p><strong>Demo environment.</strong> {short?'Fictional academic rules. Not an official degree audit.':DEMO_NOTICE}</p></div>;
}
function StatusPill({ status }: {status:CourseStatus}) {
  return <span className={'status-pill status-'+status}><span className="status-dot"/>{statusLabel(status)}</span>;
}
function ProgressBar({ value, color='ink' }: {value:number;color?:'ink'|'blue'|'amber'}) {
  return <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div className={'progress-fill '+color} style={{width: value+'%'}}/>
  </div>;
}
function RiskIcon({ severity }: {severity:Risk['severity']}) {
  return <span className={'risk-icon severity-'+severity} aria-hidden="true">
    {severity==='high'?<CircleAlert size={19}/>:severity==='medium'?<Clock3 size={19}/>:<Info size={19}/>}
  </span>;
}
function RiskRow({risk, expanded, onToggle}:{risk:Risk;expanded:boolean;onToggle:()=>void}) {
  return <div className={'risk-row '+(expanded?'is-open':'')}>
    <button type="button" onClick={onToggle} className="risk-toggle" aria-expanded={expanded}>
      <RiskIcon severity={risk.severity}/>
      <span className="risk-main"><strong>{risk.title}</strong><span>{risk.detail}</span></span>
      <ChevronDown size={17} className="risk-chevron"/>
    </button>
    {expanded && <div className="risk-expanded">
      <p><strong>What to do:</strong> {risk.action}</p>
      <div className="risk-refs">{risk.ruleIds.map(x=><span key={x}>{x}</span>)}<span>Fictional rule source</span></div>
    </div>}
  </div>;
}
function NavBrand() {
  return <div className="brand-wrap">
    <div className="brand-icon"><svg viewBox="0 0 34 34" width="29" height="29" fill="none" aria-hidden="true">
      <path d="M6 25.5 13.3 9l6.2 13.5L27 9" stroke="#F0BC88" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg></div><span>pathwise<span className="brand-period">.</span></span>
  </div>;
}
export default function App() {
  const [profile,setProfile] = useState<Profile>(initialProfile);
  const [page,setPage] = useState<Page>(initialPage);
  const [mobileNav,setMobileNav] = useState(false);
  const [expandedRisk,setExpandedRisk] = useState<string|null>(null);
  const [selectedCourse,setSelectedCourse] = useState<string>('MIN300');
  const [search,setSearch] = useState('');
  const [question,setQuestion] = useState('');
  const [answer,setAnswer] = useState<ReturnType<typeof explainQuestion>|null>(null);
  const [importMessage,setImportMessage] = useState('');
  const [notice,setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement|null>(null);
  const review = useMemo(()=>evaluate(profile),[profile]);
  const scenarios = useMemo(()=>getScenarios(profile),[profile]);
  const issues = riskCounts(review);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(profile));}catch{/* browser storage may be disabled */}},[profile]);
  useEffect(()=>{
    const handler=()=>{setPage(initialPage());setMobileNav(false);window.scrollTo({top:0,behavior:'instant'});};
    window.addEventListener('hashchange',handler);
    return ()=>window.removeEventListener('hashchange',handler);
  },[]);
  function go(destination:Page) {
    setPage(destination);
    setMobileNav(false);
    window.location.hash='/'+destination;
    window.scrollTo({top:0,behavior:'instant'});
  }
  function update(id:string,entry:PlanEntry) {setProfile(p=>updateCourse(p,id,entry));}
  function selectStatus(id:string,status:CourseStatus) {
    const old=getEntry(profile,id);
    update(id,{status,term:status==='completed'||status==='unplanned'?null:old.term??(status==='in-progress'?'2026-Fall':'2027-Spring')});
  }
  function selectTerm(id:string,term:Term) {update(id,{status:getEntry(profile,id).status==='in-progress'?'in-progress':'planned',term});}
  function showNotice(message:string) {setNotice(message);window.setTimeout(()=>setNotice(''),4500);}
  function download(name:string,content:string,type='text/plain') {
    const url=URL.createObjectURL(new Blob([content],{type}));
    const link=document.createElement('a');link.href=url;link.download=name;link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importPlan(file:File|undefined) {
    if(!file)return;
    if(file.size>200000) {setImportMessage('File is too large. Import a Pathwise JSON plan under 200 KB.');return;}
    try {
      const parsed:unknown=JSON.parse(await file.text());
      if(!validateProfile(parsed)) {setImportMessage('This is not a valid Pathwise plan. Check the format and try again.');return;}
      setProfile(parsed);setImportMessage('Plan imported. All calculations have been refreshed.');
      showNotice('Your saved plan was imported successfully.');
    } catch {setImportMessage('Could not read that file as valid JSON.');}
    if(fileRef.current)fileRef.current.value='';
  }
  function reset() {
    if(!window.confirm('Replace your current local plan with the fictional example? Export any changes first.'))return;
    setProfile(cloneDemo());showNotice('Fictional demo restored.');
  }
  function erase() {
    if(!window.confirm('Delete the locally saved plan? The page will return to the fictional demo.'))return;
    try{localStorage.removeItem(STORAGE_KEY);}catch{/* storage disabled */}
    setProfile(cloneDemo());showNotice('Local data deleted. The sample demo is shown.');
  }
  function ask(q:string) {setQuestion(q);setAnswer(explainQuestion(q,profile));}
  async function copyBrief() {
    try {await navigator.clipboard.writeText(advisorText(profile));showNotice('Advisor brief copied.');}
    catch {download('pathwise-advisor-brief.txt',advisorText(profile));showNotice('Clipboard unavailable; downloaded a text brief instead.');}
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileNav && <button className="sidebar-scrim" aria-label="Close menu" onClick={()=>setMobileNav(false)}/>}
    <aside className={'sidebar '+(mobileNav?'sidebar-open':'')}>
      <div className="sidebar-top"><NavBrand/><button className="mobile-close" onClick={()=>setMobileNav(false)} aria-label="Close navigation"><X size={20}/></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">AM</span><div><strong>My academic plan</strong><small>Personal workspace <ChevronDown size={11}/></small></div><ChevronDown size={15} className="workspace-chevron"/></div>
      <div className="nav-stack">
        {(['primary','tools'] as const).map(group=><div className="nav-group" key={group}>
          <span className="nav-label">{group==='primary'?'WORKSPACE':'EXPLORE & PREPARE'}</span>
          {NAV_ITEMS.filter(x=>x.group===group).map(item=><button key={item.id} onClick={()=>go(item.id)} className={'nav-item '+(page===item.id?'active':'')} aria-current={page===item.id?'page':undefined}>
            <item.icon size={18} strokeWidth={page===item.id?2.15:1.8}/>{item.label}{item.id==='scenarios'&&<span className="nav-new">NEW</span>}
          </button>)}
        </div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <span className="sidebar-help-icon"><ShieldCheck size={19}/></span>
          <strong>Made for peace of mind.</strong>
          <p>Your plan stays in this browser. No university login. No hidden sync.</p>
          <button onClick={()=>go('settings')}>Privacy & data <ArrowUpRight size={13}/></button>
        </div>
        <div className="sidebar-footer"><span className="online-dot"/> LOCAL-FIRST DEMO <span>v1.0</span></div>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu size={23}/></button>
          <span className="breadcrumb-root">Workspace</span><ChevronRight size={14}/><strong>{NAV_ITEMS.find(x=>x.id===page)?.label}</strong>
        </div>
        <div className="topbar-right"><span className="top-demo"><span/> Demo mode</span><button className="top-help" title="About this demo" aria-label="About this demo" onClick={()=>go('settings')}><HelpCircle size={19}/></button><div className="top-avatar" title="Fictional demo student">AM</div></div>
      </header>
      <main id="main-content" tabIndex={-1} className="main-content">
        {page==='overview' && <Overview profile={profile} review={review} issues={issues} expandedRisk={expandedRisk} setExpandedRisk={setExpandedRisk} go={go}/>}
        {page==='requirements' && <Requirements profile={profile} review={review} search={search} setSearch={setSearch} selectedCourse={selectedCourse} setSelectedCourse={setSelectedCourse} go={go}/>}
        {page==='planner' && <Planner profile={profile} review={review} selectStatus={selectStatus} selectTerm={selectTerm} go={go}/>}
        {page==='scenarios' && <Scenarios scenarios={scenarios} profile={profile} onApply={s=>{setProfile(s.profile);showNotice('Scenario applied. Your plan and warnings were updated.');}} go={go}/>}
        {page==='assistant' && <Assistant question={question} setQuestion={setQuestion} answer={answer} ask={ask} review={review} go={go}/>}
        {page==='advisor' && <Advisor profile={profile} review={review} onCopy={copyBrief} onDownload={()=>download('pathwise-advisor-brief.txt',advisorText(profile))}/>}
        {page==='settings' && <Settings profile={profile} setProfile={setProfile} onReset={reset} onErase={erase} onExport={()=>download('pathwise-plan.json',JSON.stringify(profile,null,2),'application/json')} fileRef={fileRef} onImport={importPlan} importMessage={importMessage}/>}
        <footer className="main-footer"><span>© 2026 Pathwise · Independent student project</span><span>Built for clarity, not certainty. <span className="footer-sparkle">✳</span></span></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  </div>;
}
function PageIntro({page, eyebrowSuffix, actions}: {page:Page;eyebrowSuffix?:string;actions?:ReactNode}) {
  const meta=PAGE_META[page];
  return <div className="page-intro"><div><p className="eyebrow">{meta.eyebrow}{eyebrowSuffix?' / '+eyebrowSuffix:''}</p><h1>{meta.title}</h1><p className="page-subtitle">{meta.description}</p></div>{actions&&<div className="page-actions">{actions}</div>}</div>;
}
function Overview({profile,review,issues,expandedRisk,setExpandedRisk,go}:{
 profile:Profile;review:Review;issues:{high:number;medium:number};expandedRisk:string|null;setExpandedRisk:(v:string|null)=>void;go:(p:Page)=>void
}) {
  const last=review.projected?termLabel(review.projected):'Unresolved';
  const cardTerms=TERMS.filter(t=>review.termCredits[t]&&review.termCredits[t]!>0).slice(0,5);
  return <>
    <div className="welcome-strip"><div><p className="eyebrow">YOUR DEGREE HEALTH / NOVEMBER 2026 DEMO</p><h1>Good to see you, {displayStudent(profile.student)} <span className="wave">✳</span></h1><p>Here's where your academic journey stands today.</p></div><button className="welcome-action" onClick={()=>go('scenarios')}>Explore scenarios <ArrowUpRight size={16}/></button></div>
    <Disclaimer short/>
    <section className="health-hero">
      <div className="health-hero-left"><div className="health-badge"><span className="health-pulse"/> DEGREE HEALTH CHECK</div>
        <h2>{issues.high>0?issues.high+' things worth a closer look.':review.risks.length?review.risks.length+' items to review.':'Your demo plan has no blocking alerts.'}</h2>
        <p>{issues.high>0?'Your graduation target may be affected by a prerequisite sequence. Let’s make a plan before it becomes a surprise.':'Keep reviewing your course plan and assumptions. A green demo result is not official clearance.'}</p>
        <button onClick={()=>go('planner')} className="health-link">Review my plan <ArrowRight size={16}/></button>
      </div>
      <div className="health-hero-right"><div className="orbit-visual" aria-hidden="true"><div className="orbit-ring ring-outer"/><div className="orbit-ring ring-middle"/><div className="orbit-ring ring-inner"/><div className="orbit-center"><Route size={36} strokeWidth={1.5}/></div><span className="orbit-spot spot-a"/><span className="orbit-spot spot-b"/><span className="orbit-spot spot-c"/></div></div>
    </section>
    <div className="metric-grid">
      <div className="metric-card"><div className="metric-top"><span>Requirements completed</span><CheckCircle2 size={17}/></div><div className="metric-value">{review.completed}<span> / {review.total}</span></div><ProgressBar value={percent(review.completed,review.total)}/><p>From the sample program rules</p></div>
      <div className="metric-card"><div className="metric-top"><span>Credits earned</span><Layers3 size={17}/></div><div className="metric-value">{review.creditsEarned}<span> / {review.creditsRequired}</span></div><p className="metric-footer">Completed credits only</p></div>
      <div className="metric-card"><div className="metric-top"><span>Your graduation target</span><Target size={17}/></div><div className="metric-value metric-date">{termLabel(profile.target)}</div><p className="metric-footer">Student-selected goal</p></div>
      <div className="metric-card metric-projection"><div className="metric-top"><span>Draft projected term</span><CalendarDays size={17}/></div><div className="metric-value metric-date">{last}</div><p className="metric-footer">Conditional estimate · not guaranteed</p></div>
    </div>
    <div className="overview-columns">
      <Panel className="risk-panel">
        <SectionHead kicker="WHAT NEEDS ATTENTION" title="Your priority signals" linkText="Open the planner" onLink={()=>go('planner')}/>
        <div className="risk-summary"><span className="summary-count high"><CircleAlert size={13}/>{issues.high} high priority</span><span className="summary-count medium">{issues.medium} to review</span></div>
        <div className="risk-list">{review.risks.length?review.risks.slice(0,4).map(r=><RiskRow key={r.id} risk={r} expanded={expandedRisk===r.id} onToggle={()=>setExpandedRisk(expandedRisk===r.id?null:r.id)}/>):<p className="empty-copy">No deterministic warnings in the demo plan. Official checks are still needed.</p>}</div>
      </Panel>
      <Panel className="degree-panel"><SectionHead kicker="YOUR REQUIREMENTS" title="Making progress" linkText="See all" onLink={()=>go('requirements')}/>
        <div className="degree-stats">{review.groups.map((g,i)=><div className="degree-stat" key={g.id}>
          <div className="degree-stat-top"><span className={'group-glyph group-'+g.id}>{i===0?<BookOpen size={17}/>:i===1?<Network size={17}/>:<Compass size={17}/>}</span><strong>{g.label}</strong><span>{percent(g.done,g.total)}%</span></div>
          <ProgressBar value={percent(g.done,g.total)} color={i===1?'blue':i===2?'amber':'ink'}/><small>{g.done} of {g.total} course requirements complete</small>
        </div>)}</div>
        <button className="degree-tip" onClick={()=>go('requirements')}><div className="tip-icon"><Info size={18}/></div><span><strong>Credit hours ≠ graduation clearance.</strong> Individual requirements and prerequisite chains still matter.</span><ChevronRight size={16}/></button>
      </Panel>
    </div>
    <Panel className="timeline-panel"><SectionHead kicker="COMING INTO VIEW" title="Your semester roadmap" linkText="Edit semester plan" onLink={()=>go('planner')}/>
      <div className="roadmap"><div className="roadmap-line"/>
        {cardTerms.length?cardTerms.map((term,i)=><div key={term} className="roadmap-step"><span className={'roadmap-point '+(i===0?'current':'')}/><strong>{termLabel(term)}</strong><span>{review.termCredits[term]} planned credits</span><small>{COURSES.filter(c=>getEntry(profile,c.id).term===term).map(c=>c.id).slice(0,3).join(' · ')}</small></div>):<p>Schedule courses to see a term-by-term roadmap.</p>}
      </div>
      <p className="roadmap-note"><Info size={14}/> Future courses are not confirmed offerings. This timeline is built from your inputs only.</p>
    </Panel>
    <div className="next-step-panel"><span className="next-icon"><WandSparkles size={23}/></span><div><p className="eyebrow">NEXT BEST STEP</p><h3>Could a different schedule get you closer?</h3><p>Compare workload and prerequisite trade-offs with a conditional summer scenario.</p></div><Button icon={ArrowRight} onClick={()=>go('scenarios')}>Explore what-if studio</Button></div>
  </>;
}
function Requirements({profile,review,search,setSearch,selectedCourse,setSelectedCourse,go}:{
 profile:Profile;review:Review;search:string;setSearch:(s:string)=>void;selectedCourse:string;setSelectedCourse:(id:string)=>void;go:(p:Page)=>void
}) {
  const selected=COURSE_BY_ID[selectedCourse] ?? COURSES[0];
  const filtered=COURSES.filter(c=>[c.name,c.id,c.description,GROUPS[c.group].label].join(' ').toLowerCase().includes(search.toLowerCase()));
  const groups=(Object.keys(GROUPS) as GroupId[]);
  const entry=getEntry(profile,selected.id);
  return <><PageIntro page="requirements" actions={<Button onClick={()=>go('planner')} icon={CalendarDays}>Edit my semester plan</Button>}/><Disclaimer/>
    <div className="requirements-toolbar"><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search requirements or courses" aria-label="Search requirements"/></div><span className="toolbar-total">{review.completed} of {review.total} completed</span></div>
    <div className="requirements-layout"><div className="requirement-groups">
      {groups.map((g,i)=>{const items=filtered.filter(c=>c.group===g),status=review.groups.find(x=>x.id===g)!;return <Panel className="requirement-group" key={g}>
        <div className="requirement-group-head"><span className={'group-glyph large group-'+g}>{i===0?<BookOpen size={20}/>:i===1?<Network size={20}/>:<Compass size={20}/>}</span><div><h2>{GROUPS[g].label}</h2><p>{status.done} of {status.total} courses complete</p></div><span className="requirement-fraction">{percent(status.done,status.total)}%</span></div>
        <ProgressBar value={percent(status.done,status.total)} color={i===1?'blue':i===2?'amber':'ink'}/>
        <div className="requirements-list">
          {items.length?items.map(c=>{const e=getEntry(profile,c.id);return <button key={c.id} className={'requirement-line '+(selected.id===c.id?'selected':'')} onClick={()=>setSelectedCourse(c.id)}>
            <span className={'small-check '+(e.status==='completed'?'done':'')}>{e.status==='completed'?<Check size={13}/>:<span/>}</span><span className="requirement-line-main"><strong>{c.name}</strong><small>{c.id} · {c.credits} credits</small></span><StatusPill status={e.status}/><ChevronRight size={16} className="requirement-line-chevron"/></button>}):<p className="empty-search">No matching courses in this group.</p>}
        </div>
      </Panel>})}
    </div><aside className="detail-sidebar"><Panel className="detail-panel"><p className="eyebrow">REQUIREMENT DETAILS</p><div className="detail-title"><span className="detail-code">{selected.id}</span><h3>{selected.name}</h3><StatusPill status={entry.status}/></div><p>{selected.description}</p>
      <div className="detail-divider"/><dl><div><dt>Requirement group</dt><dd>{GROUPS[selected.group].label}</dd></div><div><dt>Credits</dt><dd>{selected.credits}</dd></div><div><dt>Planned term</dt><dd>{entry.term?termLabel(entry.term):statusLabel(entry.status)}</dd></div><div><dt>Source reference</dt><dd className="source-id">{selected.ruleId}</dd></div></dl>
      <h4>Prerequisite dependency</h4>{selected.prerequisites.length?<div className="prereq-chips">{selected.prerequisites.map(p=><button key={p} onClick={()=>setSelectedCourse(p)}>{p}<ArrowUpRight size={12}/></button>)}</div>:<p className="muted-small">No prerequisites in this fictional example.</p>}
      <div className="detail-trust"><ShieldCheck size={15}/><span>Rule comes from the versioned, fictional demonstration dataset—not a university catalog.</span></div>
      <Button variant="outline" onClick={()=>go('planner')} icon={CalendarDays} className="full-width">Edit this plan</Button></Panel>
    </aside></div>
  </>;
}
function Planner({profile,review,selectStatus,selectTerm,go}:{
 profile:Profile;review:Review;selectStatus:(id:string,s:CourseStatus)=>void;selectTerm:(id:string,t:Term)=>void;go:(p:Page)=>void
}) {
  const [filter,setFilter]=useState<'all'|'problem'>('all');
  const courseRisks=new Set(review.risks.filter(r=>r.severity==='high').flatMap(r=>r.courseIds));
  const planned=TERMS.map(term=>({term,courses:COURSES.filter(c=>getEntry(profile,c.id).term===term)})).filter(t=>t.courses.length||t.term==='2027-Summer'||t.term==='2028-Summer');
  const missing=COURSES.filter(c=>getEntry(profile,c.id).status==='unplanned');
  return <><PageIntro page="planner" actions={<Button onClick={()=>go('scenarios')} icon={Route}>Compare what-if plans</Button>}/><Disclaimer/>
    <div className="planner-guide"><div><span className="guide-icon"><Info size={19}/></span><div><strong>Move the pieces. See what changes.</strong><p>Use each course's semester and status menus. Prerequisite warnings and projections recalculate instantly.</p></div></div><span>Credit preference: {profile.maxCredits}/term</span></div>
    <div className="planner-toolbar"><div className="planner-tabs"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All planned courses</button><button className={filter==='problem'?'selected':''} onClick={()=>setFilter('problem')}>Flagged courses <span>{courseRisks.size}</span></button></div><span className="planner-meta">{COURSES.length-review.completed} requirements not yet complete</span></div>
    <div className="term-grid">{planned.map(({term,courses})=>{
      const visible=filter==='all'?courses:courses.filter(c=>courseRisks.has(c.id));
      const credits=review.termCredits[term]??0;
      return <section className="term-column" key={term}><div className="term-head"><div><span className="term-dot"/><h2>{termLabel(term)}</h2></div><span className={credits>profile.maxCredits?'over-limit':''}>{credits} / {profile.maxCredits} cr</span></div>
        <div className="term-courses">{visible.length?visible.map(c=><CoursePlannerCard key={c.id} course={c} entry={getEntry(profile,c.id)} hasRisk={courseRisks.has(c.id)} selectStatus={selectStatus} selectTerm={selectTerm}/>):<div className="term-empty">{filter==='problem'?'No high-priority course flags':'No courses scheduled'}<small>Future offerings not verified</small></div>}</div>
        <div className="term-bottom">{credits>profile.maxCredits?<span className="term-warning"><CircleAlert size={13}/> Over preferred load</span>:<span><Check size={13}/> {credits? 'Within preferred load':'Available for planning'}</span>}</div>
      </section>})}</div>
    {missing.length>0&&<Panel className="missing-panel"><SectionHead title="Not yet on your plan"/><div className="missing-list">{missing.map(c=><div key={c.id}><strong>{c.id} · {c.name}</strong><button onClick={()=>selectTerm(c.id,'2027-Spring')}>Add to Spring 2027 <ArrowRight size={14}/></button></div>)}</div></Panel>}
    <div className="planner-footer"><Info size={16}/><p>This planner checks only the known fictional prerequisite graph and your preferred credit load. It cannot confirm actual course offerings, minimum grades, substitutions, or eligibility.</p></div>
  </>;
}
function CoursePlannerCard({course,entry,hasRisk,selectStatus,selectTerm}:{
 course:Course;entry:PlanEntry;hasRisk:boolean;selectStatus:(id:string,s:CourseStatus)=>void;selectTerm:(id:string,t:Term)=>void
}) {
  return <article className={'planner-course '+(hasRisk?'flagged':'')}>
    <div className="planner-course-top"><span>{course.id}</span>{hasRisk?<CircleAlert size={16} className="flag-indicator"/>:<span className="course-credits">{course.credits} cr</span>}</div>
    <h3>{course.name}</h3><p>{GROUPS[course.group].short} · {course.prerequisites.length?course.prerequisites.join(' + ')+' first':'No prerequisites'}</p>
    <label>Status <select aria-label={'Status for '+course.name} value={entry.status} onChange={e=>selectStatus(course.id,e.target.value as CourseStatus)}>
      <option value="planned">Planned</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="unplanned">Not planned</option>
    </select></label>
    <label>Semester <select aria-label={'Semester for '+course.name} value={entry.term??''} disabled={entry.status==='completed'||entry.status==='unplanned'} onChange={e=>selectTerm(course.id,e.target.value as Term)}>
      {TERMS.map(t=><option key={t} value={t}>{termLabel(t)}</option>)}
    </select></label>
  </article>;
}
function Scenarios({scenarios,profile,onApply,go}:{scenarios:Scenario[];profile:Profile;onApply:(s:Scenario)=>void;go:(p:Page)=>void}) {
  const [expanded,setExpanded]=useState<string>('accelerated');
  return <><PageIntro page="scenarios" actions={<Button variant="outline" icon={ArrowLeft} onClick={()=>go('planner')}>Back to planner</Button>}/><Disclaimer/>
    <div className="scenario-intro-card"><span className="scenario-star"><WandSparkles size={24}/></span><div><strong>Three plans. One clearer decision.</strong><p>Explore alternatives calculated from fictional requirements and your current credit-load preference. These are planning scenarios, not course-availability guarantees.</p></div></div>
    <div className="scenario-grid">{scenarios.map((s,i)=>{const count=riskCounts(s.review);return <section className={'scenario-card '+(expanded===s.id?'highlighted':'')} key={s.id}>
      <div className="scenario-header"><span className="scenario-identifier">{String(i+1).padStart(2,'0')}</span>{s.id==='accelerated'?<span className="scenario-badge">Explore this option</span>:s.kind==='baseline'?<span className="scenario-baseline">CURRENT DRAFT</span>:null}</div>
      <h2>{s.title}</h2><p className="scenario-subtitle">{s.subtitle}</p>
      <div className="scenario-estimate"><span>Conditional endpoint</span><strong>{s.review.projected?termLabel(s.review.projected):'Unresolved'}</strong></div>
      <div className="scenario-facts"><div><span>Known high-priority warnings</span><strong>{count.high}</strong></div><div><span>Future course moves</span><strong>{s.changed}</strong></div><div><span>Target term</span><strong>{termLabel(profile.target)}</strong></div></div>
      <p className="scenario-caveat"><Info size={14}/>{s.note}</p>
      <button className="scenario-expand" onClick={()=>setExpanded(expanded===s.id?'':s.id)} aria-expanded={expanded===s.id}> {expanded===s.id?'Hide':'View'} course changes <ChevronDown size={16}/></button>
      {expanded===s.id&&<div className="scenario-course-details"><strong>Upcoming sequence</strong>{COURSES.filter(c=>getEntry(s.profile,c.id).status!=='completed').sort((a,b)=>(TERMS.indexOf(getEntry(s.profile,a.id).term as Term))-(TERMS.indexOf(getEntry(s.profile,b.id).term as Term))).slice(0,8).map(c=><div key={c.id}><span>{c.id}</span><span>{getEntry(s.profile,c.id).term?termLabel(getEntry(s.profile,c.id).term!):'Not scheduled'}</span></div>)}</div>}
      {s.kind==='alternative'?<Button className="full-width" onClick={()=>onApply(s)} icon={CheckCheck}>Use this plan</Button>:<Button className="full-width" variant="outline" onClick={()=>go('planner')} icon={CalendarDays}>Edit current plan</Button>}
    </section>})}</div>
    <Panel className="scenario-ethics"><div><LockKeyhole size={22}/><strong>A feasible draft is not a graduation promise.</strong></div><p>Our simple solver checks the supplied demo prerequisites and credit loads. It does not model verified term offerings, grade minimums, course eligibility, transfer equivalencies, advisor exceptions, or class capacity. Treat every result as conditional.</p></Panel>
  </>;
}
function Assistant({question,setQuestion,answer,ask,review,go}:{
 question:string;setQuestion:(s:string)=>void;answer:ReturnType<typeof explainQuestion>|null;ask:(q:string)=>void;review:Review;go:(p:Page)=>void
}) {
  const onSubmit=(e:FormEvent)=>{e.preventDefault();if(question.trim())ask(question.trim());};
  return <><PageIntro page="assistant"/><Disclaimer/>
    <div className="ask-layout"><Panel className="ask-main"><div className="ask-head"><span className="assistant-avatar"><Sparkles size={23}/></span><div><h2>Ask Pathwise</h2><p><span className="online-dot dark"/> Guided, rule-grounded explanations</p></div><span className="rules-only">NO GENERATIVE AI</span></div>
      <div className="chat-body"><div className="chat-opening"><span className="chat-orb"><Sparkles size={32}/></span><h3>Make sense of the next step.</h3><p>Ask about your graduation timeline, prerequisites, requirements, or advisor preparation. Every answer stays inside the rules we can explain.</p></div>
        {answer&&<div className="answer-card"><div className="answer-label"><Sparkles size={16}/> PATHWISE EXPLANATION</div><h3>{answer.heading}</h3><p>{answer.body}</p><div className="answer-sources"><span>Rule references</span>{[...new Set(answer.refs)].map(ref=><code key={ref}>{ref}</code>)}</div></div>}
        <div className="question-suggestions"><span>TRY A QUESTION</span>{examples.map(example=><button key={example} onClick={()=>ask(example)}>{example}<ArrowUpRight size={14}/></button>)}</div>
      </div>
      <form className="chat-form" onSubmit={onSubmit}><input value={question} onChange={e=>setQuestion(e.target.value)} aria-label="Ask about your plan" maxLength={300} placeholder="Ask a question about your plan…" required/><button type="submit" aria-label="Send question"><Send size={19}/></button></form>
      <p className="chat-honesty"><ShieldCheck size={14}/> Deterministic explanation templates. No LLM/API calls. No invented university policy.</p>
    </Panel>
    <aside className="ask-side"><Panel><p className="eyebrow">PLAN AT A GLANCE</p><h3>{review.risks.filter(x=>x.severity==='high').length} high-priority signals</h3><p>The guided explainer reads your current plan and references the same rule-engine output.</p><Button variant="outline" icon={ArrowRight} onClick={()=>go('planner')}>Inspect my plan</Button></Panel><Panel><span className="side-icon"><ShieldCheck size={21}/></span><h3>Know what is certain.</h3><p>Pathwise flags known demo constraints and is explicit about uncertainty. For official requirements, speak with your academic advisor.</p></Panel></aside>
    </div>
  </>;
}
function Advisor({profile,review,onCopy,onDownload}:{profile:Profile;review:Review;onCopy:()=>void;onDownload:()=>void}) {
  return <><PageIntro page="advisor" actions={<><Button variant="outline" icon={Download} onClick={onDownload}>Download .txt</Button><Button icon={FileDown} onClick={()=>window.print()}>Print / Save PDF</Button></>}/><Disclaimer/>
    <div className="advisor-layout"><section className="brief-paper"><div className="brief-header"><div><div className="brief-brand"><span>✳</span> pathwise.</div><p>ACADEMIC PLANNING BRIEF</p></div><span className="brief-tag">SYNTHETIC DEMONSTRATION</span></div>
      <h2>Better questions.<br/>More productive advising.</h2><p className="brief-intro">An organized snapshot of the draft plan, outstanding risks, and questions requiring institutional review.</p>
      <div className="brief-stats"><div><span>STUDENT</span><strong>{profile.student}</strong></div><div><span>DEGREE PROGRAM</span><strong>{profile.program}</strong></div><div><span>TARGET TERM</span><strong>{termLabel(profile.target)}</strong></div><div><span>CONDITIONAL ENDPOINT</span><strong>{review.projected?termLabel(review.projected):'Not determined'}</strong></div></div>
      <div className="brief-section"><h3><span>01</span> Items to discuss</h3>{review.risks.length?review.risks.slice(0,6).map((r,i)=><div className="brief-item" key={r.id}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{r.title}</strong><p>{r.detail}</p><small>Next step: {r.action}</small><code>{r.ruleIds.join(' · ')}</code></div></div>):<p>There are no deterministic warnings in the demo; independent official validation is still required.</p>}</div>
      <div className="brief-section"><h3><span>02</span> Questions for my advisor</h3><ol><li>Which official catalog rules apply to my program and cohort?</li><li>Are these prerequisite chains and completed credits correct?</li><li>Are future courses confirmed for the proposed semesters?</li><li>Do any substitutions, equivalencies, or exceptions need approval?</li></ol></div>
      <div className="brief-foot"><ShieldCheck size={15}/><p>Illustrative data. Not an official audit, advising record, degree clearance, or verified course schedule.</p></div>
    </section><aside className="advisor-side"><Panel><span className="side-icon"><FileText size={23}/></span><h3>Ready for your next conversation.</h3><p>Bring the questions, flagged dependencies, and assumptions—not just a progress percentage.</p><Button className="full-width" icon={CheckCheck} onClick={onCopy}>Copy complete brief</Button><p className="muted-small">No advisor account or university integration needed.</p></Panel><Panel><p className="eyebrow">PRIVACY FIRST</p><h3>Only share what you choose.</h3><p>This is a local report. Printing or copying it is initiated by you. No document is sent to our servers.</p></Panel></aside></div>
  </>;
}
function Settings({profile,setProfile,onReset,onErase,onExport,fileRef,onImport,importMessage}:{
 profile:Profile;setProfile:(p:Profile)=>void;onReset:()=>void;onErase:()=>void;onExport:()=>void;fileRef:React.RefObject<HTMLInputElement|null>;
 onImport:(file:File|undefined)=>void;importMessage:string
}) {
  return <><PageIntro page="settings"/><Disclaimer/>
    <div className="settings-grid"><Panel className="settings-panel"><span className="settings-head-icon"><GraduationCap size={22}/></span><h2>Academic preferences</h2><p>Adjust the fictional profile to explore how the rules respond.</p>
      <div className="field-grid"><label>Student display name<input value={profile.student} maxLength={80} onChange={e=>setProfile({...profile,student:e.target.value||'Demo student'})}/></label><label>Target graduation term<select value={profile.target} onChange={e=>setProfile({...profile,target:e.target.value as Term})}>{TERMS.map(t=><option value={t} key={t}>{termLabel(t)}</option>)}</select></label>
        <label className="field-wide">Preferred maximum credits / semester<select value={profile.maxCredits} onChange={e=>setProfile({...profile,maxCredits:Number(e.target.value)})}>{[6,9,12,15,18,21].map(n=><option value={n} key={n}>{n} credits</option>)}</select></label></div>
      <div className="settings-info"><Info size={16}/> The catalog and course names remain fictional in this release. A real program selector is not yet available.</div></Panel>
      <Panel className="settings-panel"><span className="settings-head-icon green"><LockKeyhole size={22}/></span><h2>Privacy & local data</h2><p>Your plan lives in this browser's localStorage. It is not encrypted, synced, or shared with any backend.</p>
        <div className="privacy-details"><div><CheckCircle2 size={18}/><span>No account or university credentials</span></div><div><CheckCircle2 size={18}/><span>No third-party AI requests</span></div><div><CheckCircle2 size={18}/><span>Export, replace or delete your local plan</span></div></div>
        <div className="settings-buttons"><Button variant="outline" icon={ArrowDownToLine} onClick={onExport}>Export JSON</Button><Button variant="outline" icon={Upload} onClick={()=>fileRef.current?.click()}>Import JSON</Button><input type="file" ref={fileRef} hidden accept=".json,application/json" onChange={e=>onImport(e.target.files?.[0])}/></div>
        {importMessage&&<p className="import-message" role="status">{importMessage}</p>}
        <div className="settings-danger"><button onClick={onReset}><RotateCcw size={16}/> Restore fictional demo</button><button onClick={onErase}><X size={16}/> Delete locally saved plan</button></div>
      </Panel>
      <Panel className="settings-panel sources-panel"><span className="settings-head-icon blue"><ShieldCheck size={22}/></span><h2>Transparency & sources</h2><p>This prototype draws rules from a documented, synthetic dataset. It never silently represents simulated academic constraints as real institutional policy.</p>
        <a href="https://github.com/ricoxvl/pathwise/blob/main/docs/DEMO_RULES.md" target="_blank" rel="noopener noreferrer">View the demo rules and limitations <ArrowUpRight size={15}/></a><a href="https://github.com/ricoxvl/pathwise/blob/main/docs/EVALUATION.md" target="_blank" rel="noopener noreferrer">Review the evaluation methodology <ArrowUpRight size={15}/></a>
      </Panel>
      <Panel className="settings-panel sources-panel"><span className="settings-head-icon amber"><Activity size={22}/></span><h2>What's next</h2><p>Before students can use Pathwise for consequential academic decisions, it needs verified catalog sources, minimum-grade/overlap modeling, offering confirmation, and an independent evaluation with qualified reviewers.</p>
        <span className="coming-soon"><Clock3 size={15}/> Verified-university catalog integration: not yet available</span>
      </Panel>
    </div>
  </>;
}
