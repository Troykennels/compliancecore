import React, { useId, useState } from 'react';

export type GuideSection = { id: string; title: string; why: string; where: string[]; steps: string[]; tips?: string[]; warn?: string };
export type GuideDepartment = { key: string; label: string; roles: string[]; sections: GuideSection[] };
export type GuideContent = { product: string; edition?: string; departments: GuideDepartment[] };

function Rich({ text }: { text: string }) {
  return <>{text.split(/(\[\[.+?\]\]|\*\*.+?\*\*)/g).map((part, i) => part.startsWith('[[') ? <mark key={i}>{part.slice(2, -2)}</mark> : part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</>;
}

export default function DepartmentGuide({ content, role = '', canTrain = false }: { content: GuideContent; role?: string; canTrain?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const first = content.departments[0] || { key: 'general', label: 'Getting started', roles: [], sections: [] };
  const own = content.departments.find(d => d.roles.includes(role))?.key || first.key;
  const [chosen, setChosen] = useState(own);
  const [query, setQuery] = useState('');
  // Guides contain instructions only. Browsing another department never changes permissions.
  const dept = content.departments.find(d => d.key === chosen) || first;
  const term = query.trim().toLowerCase();
  const shown = dept.sections.filter(s => [s.title, s.why, ...s.where, ...s.steps, ...(s.tips || []), s.warn || ''].join(' ').toLowerCase().includes(term));
  function choose(key: string) { setChosen(key); setQuery(''); }
  return <div className="odg" data-product={content.product}>
    <style>{CSS}</style>
    <header><div><p className="odg-brand">{content.product}{content.edition ? ` · ${content.edition}` : ''}</p><h1>My Guide</h1><p>How to use {content.product} in {dept.label}, one small step at a time.</p></div><button className="odg-no-print" type="button" onClick={() => window.print()}>Print guide</button></header>
    <div className="odg-chooser odg-no-print"><label htmlFor={`${uid}-dept`}>{canTrain ? 'Choose a department to train your team' : 'Your department / role'}</label><select id={`${uid}-dept`} value={dept.key} onChange={e => choose(e.target.value)}>{content.departments.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select><p>These are training instructions. Your account role still controls the pages and actions you can use.</p></div>
    <p><mark>Highlighted words</mark> are page names or labels to look for on your screen.</p>
    <label className="odg-search odg-no-print" htmlFor={`${uid}-search`}>Search this guide<input id={`${uid}-search`} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try payment, signature, report…" /></label>
    <nav className="odg-toc odg-no-print" aria-label="Guide chapters">{shown.map((s, i) => <button type="button" key={s.id} onClick={() => document.getElementById(`${uid}-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{i + 1}. {s.title}</button>)}</nav>
    <p role="status" className="odg-count">{shown.length} of {dept.sections.length} chapters</p>
    {!shown.length && <p>No matching chapter. Try a shorter word, or choose another department.</p>}
    {shown.map(s => <section key={s.id} id={`${uid}-${s.id}`}><h2>{s.title}</h2><p>{s.why}</p>{s.where.length > 0 && <p className="odg-where"><b>Where: </b>{s.where.map((w, i) => <React.Fragment key={w}>{i > 0 && ' → '}<mark>{w}</mark></React.Fragment>)}</p>}<ol>{s.steps.map((step, i) => <li key={i}><Rich text={step} /></li>)}</ol>{s.tips?.map((tip, i) => <p key={i} className="odg-tip"><b>Tip: </b><Rich text={tip} /></p>)}{s.warn && <p className="odg-warning"><b>Check before continuing: </b><Rich text={s.warn} /></p>}</section>)}
    <footer>Still stuck? Tell your administrator which page you opened and what happened. Do not send passwords or private records in a help message.</footer>
  </div>;
}

const CSS = `
.odg{background:var(--odg-surface,#fff);border-radius:12px;font-family:inherit;color:var(--sp-slate-900,var(--foreground,#172033));max-width:1100px;margin:0 auto;padding:20px;line-height:1.65;box-sizing:border-box;min-width:0}
.odg *{box-sizing:border-box}.odg header{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:20px}.odg h1{font-size:28px;margin:0;font-weight:800}.odg h2{font-size:19px;margin:0 0 8px;font-weight:750}.odg p{margin:8px 0;font-size:14px}.odg-brand{font-size:12px!important;font-weight:700;letter-spacing:.04em}.odg mark{background:#fef08a;color:#292524;padding:1px 5px;border-radius:4px;font-weight:600;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.odg button,.odg select,.odg input{font:inherit;font-size:14px}.odg button{cursor:pointer;border:1px solid #94a3b8;background:#f8fafc;color:#172033;border-radius:9px;padding:9px 13px;white-space:normal;text-align:left}.odg button:focus-visible,.odg input:focus-visible,.odg select:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.odg-chooser{padding:15px;background:var(--sp-surface,var(--odg-surface,#f1f5f9));border:1px solid #94a3b8;border-radius:12px}.odg-chooser label,.odg-search{display:block;font-size:14px;font-weight:600}.odg select,.odg input{display:block;width:100%;min-width:0;margin-top:7px;background:#fff;color:#172033;border:1px solid #94a3b8;border-radius:8px;padding:10px}.odg-search{margin:18px 0}.odg-toc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.odg-count{font-size:12px!important}.odg section{scroll-margin-top:80px;border:1px solid #94a3b8;background:var(--sp-surface,var(--odg-surface,#fff));border-radius:12px;padding:22px;margin:16px 0}.odg ol{padding-left:25px;margin:12px 0}.odg li{padding:3px 0 7px 5px;font-size:14px}.odg-where{font-size:13px!important}.odg-tip,.odg-warning{padding:12px;border-radius:8px;color:#172033}.odg-tip{background:#eff6ff}.odg-warning{background:#fff7ed}.odg footer{font-size:12px;text-align:center;padding:18px 0}.dark .odg,[data-theme="dark"] .odg{--odg-surface:#172033;color:#e2e8f0}.odg-no-print p{font-weight:400}.odg section p,.odg li{overflow-wrap:anywhere}
@media(max-width:600px){.odg{padding:12px}.odg section{padding:16px}.odg h1{font-size:25px}}
@media print{body:has(.odg) *:not(:has(.odg)):not(.odg):not(.odg *){display:none!important}body:has(.odg) *:has(.odg){display:block!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;position:static!important;transform:none!important}.odg{position:static;width:100%;max-width:none;padding:0;background:#fff;color:#000}.odg-no-print{display:none!important}.odg section{break-inside:avoid;border-color:#ccc;background:#fff}.odg h2{break-after:avoid}.odg mark{background:#eee;color:#000}.odg footer{display:none}}
`;
