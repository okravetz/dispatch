import { useState, useMemo, useEffect, useCallback } from "react";

if (!document.getElementById("dsp-font")) {
  const l = document.createElement("link");
  l.id = "dsp-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
}
if (!document.getElementById("dsp-css")) {
  const s = document.createElement("style"); s.id = "dsp-css";
  s.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#070b16;color:#f8fafc;font-size:15px;line-height:1.65;font-family:Inter,system-ui,sans-serif}
    button,input,textarea,select{font-family:inherit;color:#f8fafc}
    button{background:#111827;border:1px solid #1f2937;border-radius:8px}
    button:hover{background:#1f2a44}
    button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:3px solid #2563eb;outline-offset:3px}
    *[style*="color:#7986b0"]{color:#cbd5e1 !important}
    *[style*="color:#6a7b9c"]{color:#94a3b8 !important}
    *[style*="color:#2d3a58"]{color:#94a3b8 !important}
    *[style*="color:#4a5880"]{color:#94a3b8 !important}
    ::selection{background:#4f46e5;color:#ffffff}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1e2842;border-radius:2px}
    .tc:hover{background:#0d1628 !important}
    .nb:hover{background:#0d1628 !important}
    .nb.on{background:#0f1c38 !important;color:#f59e0b !important;border-left-color:#f59e0b !important}
    .sm-opt:hover{background:#1a2442 !important}
    @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    @keyframes si{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes bu{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes sp{to{transform:rotate(360deg)}}
    .fi{animation:fi 0.18s ease}.si{animation:si 0.2s ease}.bu{animation:bu 0.22s cubic-bezier(0.34,1.4,0.64,1)}
    .spn{animation:sp 0.7s linear infinite;display:inline-block}
    @keyframes st{from{transform:translateY(100%)}to{transform:translateY(0)}}
    .st{animation:st 0.22s cubic-bezier(0.22,1,0.36,1)}
    input,textarea,select{font-family:inherit;background:#070c1c;border:1px solid #1e2842;border-radius:7px;color:#f8fafc;outline:none;transition:border-color 0.12s}
    input:focus,textarea:focus,select:focus{border-color:#3b6bd6 !important}
    select option{background:#0d1628}
    @media(max-width:768px){.sidebar{display:none !important}.dpanel{display:none !important}.mobnav{display:flex !important}.mw{padding-bottom:72px !important}}
    @media(min-width:769px){.mobnav{display:none !important}}
  `;
  document.head.appendChild(s);
}

// ── Constants
const PLATFORMS = ["Slack","Gmail","Teams","WhatsApp","SMS","Phone","Email","In Person","Manual","Other"];

const SC = {
  inbox:       {l:"Inbox",        e:"📥", c:"#818cf8", g:"#4f46e5"},
  in_progress: {l:"In Progress",  e:"⚡", c:"#c084fc", g:"#9333ea"},
  responded:   {l:"Responded",    e:"↩",  c:"#fbbf24", g:"#d97706"},
  waiting:     {l:"Waiting",      e:"⏳", c:"#2dd4bf", g:"#0d9488"},
  done:        {l:"Done",         e:"✓",  c:"#4ade80", g:"#16a34a"},
};
const PC = {1:{l:"Low",c:"#6b7280"},2:{l:"Normal",c:"#6366f1"},3:{l:"Medium",c:"#eab308"},4:{l:"High",c:"#ef4444"},5:{l:"Urgent",c:"#dc2626"}};
const PE = {Slack:"💬",Gmail:"📧",Teams:"🔷",WhatsApp:"💚",SMS:"📱",Phone:"📞",Email:"📨",GitHub:"🐙",Manual:"✏️","In Person":"🤝",Other:"🔔"};
const TR = {
  inbox:       ["in_progress","responded","waiting","done"],
  in_progress: ["responded","waiting","done","inbox"],
  responded:   ["waiting","done","in_progress"],
  waiting:     ["inbox","in_progress","responded","done"],
  done:        ["inbox"],
};

// ── Utils
let _n = 1; const gid = () => `t${Date.now()}${_n++}`;
const ago = ts => { const s=(Date.now()-ts)/1000; if(s<60)return"just now"; if(s<3600)return`${Math.floor(s/60)}m`; if(s<86400)return`${Math.floor(s/3600)}h`; return`${Math.floor(s/86400)}d`; };
const pj = s => { try{return JSON.parse(s.replace(/```json|```/g,"").trim())}catch{return null} };
const fmtDate = d => { if(!d)return""; const dt=new Date(d+"T12:00:00"); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}); };
const isOverdue = t => !!(t.dueDate && new Date(t.dueDate+"T23:59:59") < new Date() && t.status!=="done");
const isNudgeDue = t => !!(t.followUpDate && new Date(t.followUpDate+"T23:59:59") < new Date());
const ageDays = t => Math.floor((Date.now()-t.createdAt)/86400000);
const todayStr = () => new Date().toISOString().slice(0,10);
const offsetDate = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);

// ── Sample data
const mkTask = (o) => ({id:gid(),subtasks:[],aiGroup:null,createdAt:Date.now(),...o});
const INIT = [
  mkTask({title:"Review Q2 budget proposal and send feedback",source:"Email",contact:"Sarah Chen",notes:"Needs response by EOW. Has headcount implications for our team.",status:"inbox",priority:4,dueDate:offsetDate(1),subtasks:[{id:"s1",title:"Read the proposal",done:true},{id:"s2",title:"Flag budget concerns",done:false},{id:"s3",title:"Reply with comments",done:false}],aiGroup:"Finance & Planning",createdAt:Date.now()-172800000}),
  mkTask({title:"Respond to Slack thread: design system token naming conventions",source:"Slack",contact:"Dev Team",notes:"Thread in #design-system — they need a decision before the sprint starts.",status:"inbox",priority:3,aiGroup:"Design Work",createdAt:Date.now()-18000000}),
  mkTask({title:"Koleinu: follow up with caterer on Shabbaton pricing",source:"Email",contact:"Green Garden Catering",notes:"Need pricing for 80–100 people. Event is 6 weeks out.",status:"waiting",priority:3,followUpDate:offsetDate(-1),aiGroup:"Koleinu",createdAt:Date.now()-259200000}),
  mkTask({title:"Bombas UX Director application — build portfolio deck",source:"Manual",contact:"",notes:"Focus on IA, dashboard, and healthcare/finance case studies.",status:"in_progress",priority:5,dueDate:offsetDate(5),subtasks:[{id:"s4",title:"Select 3 case studies",done:true},{id:"s5",title:"Write narrative for each",done:false},{id:"s6",title:"Design deck layout",done:false},{id:"s7",title:"Submit application",done:false}],aiGroup:"Career",createdAt:Date.now()-345600000}),
  mkTask({title:"Follow up: Dad's insurance claim status",source:"Phone",contact:"Blue Cross",notes:"Claim #BC-2024-8821. Called Tuesday, left voicemail.",status:"responded",priority:4,aiGroup:"Personal",createdAt:Date.now()-86400000}),
  mkTask({title:"Plan F1 race viewing with son — upcoming race",source:"Manual",contact:"",notes:"Check broadcast time and snack supply.",status:"inbox",priority:2,aiGroup:"Personal",createdAt:Date.now()-7200000}),
  mkTask({title:"Reply to Rachel about Pesach Seder plans",source:"SMS",contact:"Rachel",notes:"",status:"done",priority:2,aiGroup:"Personal",createdAt:Date.now()-36000000}),
  mkTask({title:"Code review: Blackboard editor PR",source:"GitHub",contact:"Dev",notes:"",status:"done",priority:2,aiGroup:"Design Work",createdAt:Date.now()-86400000}),
];

// ── Storage
const STORE_KEY = "dispatch-tasks-v1";
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sbHeaders = {"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`};

const storageSave = async (tasks) => {
  // Write to localStorage immediately (instant, works offline)
  try { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); } catch {}
  // Then sync to Supabase in background
  if(!SB_URL||!SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/store?id=eq.tasks`, {
      method:"PATCH",
      headers:{...sbHeaders,"Prefer":"return=minimal"},
      body:JSON.stringify({data:tasks}),
    });
  } catch {}
};

const storageLoad = async () => {
  // Try Supabase first (most up to date, cross-device)
  if(SB_URL && SB_KEY) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/store?id=eq.tasks&select=data`, {headers:sbHeaders});
      const d = await r.json();
      if(d?.[0]?.data?.length) {
        // Update localStorage cache while we're at it
        localStorage.setItem(STORE_KEY, JSON.stringify(d[0].data));
        return d[0].data;
      }
    } catch {}
  }
  // Fall back to localStorage (works offline)
  try { const v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
};

// ── API
async function callClaude(user, sys) {
  const r = await fetch("/.netlify/functions/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:sys,messages:[{role:"user",content:user}]}),
  });
  const d = await r.json().catch(()=>null);
  if (!r.ok) {
    const message = d?.error?.message || d?.message || JSON.stringify(d) || r.statusText;
    throw new Error(`Claude API error ${r.status}: ${message}`);
  }
  return d.content?.[0]?.text || "";
}
const apiParse = async raw => {
  const t = await callClaude(`Parse this into a task:\n\n${raw}`,
    `You extract tasks from messages. Return ONLY valid JSON (no markdown) with these exact fields:
{"title":"verb-first action title under 80 chars","source":"Slack|Gmail|Teams|WhatsApp|SMS|Phone|Email|Manual|Other","contact":"person or group name, or empty string","notes":"relevant context, deadline, or key details, or empty string","priority":3}
Priority 1-5 where 5=most urgent. Use urgency language, deadline mentions, and sender prominence as signals.`);
  return pj(t) || {title:raw.slice(0,80),source:"Manual",contact:"",notes:"",priority:3};
};
const apiPrioritize = async tasks => {
  const list = tasks.filter(t=>t.status!=="done")
    .map(t=>`ID:${t.id} "${t.title}" via ${t.source} from "${t.contact||"unknown"}" notes:"${t.notes||"none"}"`).join("\n");
  const t = await callClaude(`Prioritize these tasks for someone with ADHD:\n${list}`,
    `Assign priority 1-5 (5=most urgent). Consider: blocking others, mentioned deadlines, professional vs personal weight, how long waiting.
Return ONLY valid JSON array: [{"id":"...","priority":4,"reason":"brief one-sentence reason"}]`);
  return pj(t) || [];
};
const apiGroup = async tasks => {
  const list = tasks.filter(t=>t.status!=="done")
    .map(t=>`ID:${t.id} "${t.title}" ${t.source} "${t.contact||""}"`).join("\n");
  const t = await callClaude(`Group these tasks to minimize context switching for someone with ADHD:\n${list}`,
    `Create 3-7 named work context groups. Good group names: "Client Work","Admin","Koleinu","Personal","Career","Finance","Design","Dev" etc.
Return ONLY valid JSON: [{"groupName":"...","taskIds":["id1","id2"]}]`);
  return pj(t) || [];
};
const apiBreakdown = async task => {
  const t = await callClaude(`Break this task into subtasks:\nTitle: "${task.title}"\nContext: ${task.notes||"none"}`,
    `Give 2-6 concrete subtasks for someone with ADHD. Each is a single actionable step.
Return ONLY valid JSON array of strings: ["First step","Second step","Third step"]`);
  return pj(t) || [];
};
const apiBrainDump = async raw => {
  const t = await callClaude(`Extract every actionable task from this text:\n\n${raw}`,
    `The user has ADHD and is brain-dumping everything on their mind. Extract each distinct actionable item.
Return ONLY valid JSON array (2-12 items): [{"title":"verb-first action under 80 chars","source":"Slack|Gmail|Teams|WhatsApp|SMS|Phone|Email|Manual|Other","contact":"person name or empty string","notes":"brief context or deadline or empty string","priority":3}]
Priority 1-5 (5=most urgent). Skip vague thoughts that aren't actionable. Each task must have a clear next action.`);
  return pj(t) || [];
};
async function callClaudeVision(base64, mediaType, sys) {
  const r = await fetch("/.netlify/functions/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-6", max_tokens:1000, system:sys,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:mediaType,data:base64}},
        {type:"text",text:"Extract the actionable task from this notification or message screenshot."}
      ]}]
    }),
  });
  const d = await r.json().catch(()=>null);
  if(!r.ok){ const msg=d?.error?.message||r.statusText; throw new Error(`Claude API error ${r.status}: ${msg}`); }
  return d.content?.[0]?.text || "";
}
const apiParseImage = async (base64, mediaType) => {
  const t = await callClaudeVision(base64, mediaType,
    `You extract tasks from notification or message screenshots. Look at any visible text, sender names, app chrome, and urgency signals.
Return ONLY valid JSON (no markdown) with these exact fields:
{"title":"verb-first action title under 80 chars","source":"Slack|Gmail|Teams|WhatsApp|SMS|Phone|Email|Manual|Other","contact":"person or group name visible in image, or empty string","notes":"relevant context, deadline, or key details visible, or empty string","priority":3}
Priority 1-5 where 5=most urgent. Infer source from app UI if visible (e.g. Slack sidebar = Slack).`);
  return pj(t) || {title:"Task from image",source:"Manual",contact:"",notes:"",priority:3};
};

// ── Hooks
const useIsMobile = () => {
  const [m,setM] = useState(window.innerWidth<768);
  useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);
  return m;
};

// ── Micro components
const Spin = ({s=13}) => <span className="spn" style={{width:s,height:s,borderRadius:"50%",border:"2px solid #1e2842",borderTopColor:"#f59e0b",display:"inline-block",verticalAlign:"middle",flexShrink:0}}/>;
const PriDot = ({p}) => <span title={PC[p]?.l} style={{width:8,height:8,borderRadius:"50%",display:"inline-block",flexShrink:0,background:PC[p]?.c||"#6b7280",boxShadow:`0 0 5px ${PC[p]?.c||"#6b7280"}99`}}/>;
const StatBadge = ({status,onClick,sm}) => {
  const c=SC[status]; return (
    <button onClick={onClick} aria-label={onClick?`Status: ${c.l}. Click to change`:c.l} style={{fontSize:sm?10:11,fontFamily:"IBM Plex Mono,monospace",color:"#f8fafc",background:`${c.g}33`,border:`1px solid ${c.g}80`,borderRadius:4,padding:sm?"1px 5px":"2px 8px",cursor:onClick?"pointer":"default",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>
      <span aria-hidden="true">{c.e}</span> {c.l}
    </button>
  );
};
const StatMenu = ({task,onUpdate,onClose}) => (
  <div className="fi" onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:300,background:"#0b1220",border:"1px solid #1f2a44",borderRadius:8,padding:6,minWidth:170,boxShadow:"0 12px 28px #00000090"}}>
    <div style={{fontSize:9,color:"#cbd5e1",fontFamily:"IBM Plex Mono",padding:"2px 10px 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Change status</div>
    {(TR[task.status]||[]).map(s => { const c=SC[s]; return (
      <button key={s} className="sm-opt" onClick={()=>{onUpdate({status:s});onClose();}}
        style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",background:"#111827",border:"1px solid #1f2937",color:"#f8fafc",cursor:"pointer",borderRadius:5,fontSize:12,fontFamily:"IBM Plex Mono",textAlign:"left"}}>
        {c.e} {c.l}
      </button>
    );})}
  </div>
);

// ── Task Card
const TaskCard = ({task,isSelected,onClick,onUpdate}) => {
  const [showSM,setShowSM] = useState(false);
  const dSub=task.subtasks?.filter(s=>s.done).length||0, tSub=task.subtasks?.length||0;
  const age=ageDays(task), overdue=isOverdue(task), nudge=isNudgeDue(task);
  const aging = task.status!=="done" && age>=3;
  const ageBorder = overdue?"#ef4444":aging&&age>=7?"#d97706":aging?"#2d3a5800":"";
  return (
    <div className="tc fi" onClick={onClick} style={{display:"flex",gap:10,padding:"11px 13px",background:isSelected?"#0f1c38":overdue?"#1a0808":"#0b1020",border:`1px solid ${isSelected?"#1e3060":overdue?"#3d1010":"#141d35"}`,borderLeft:`3px solid ${overdue?"#ef4444":PC[task.priority]?.c||"#6b7280"}`,borderRadius:8,cursor:"pointer",marginBottom:5,position:"relative",transition:"background 0.1s"}}>
      <div style={{paddingTop:3,flexShrink:0}}><PriDot p={task.priority}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:700,color:task.status==="done"?"#7a8ca8":"#f8fafc",fontFamily:"Bricolage Grotesque,sans-serif",lineHeight:1.4,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"normal",textAlign:"left",textDecoration:task.status==="done"?"line-through":"none"}}>
          {task.title}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#e2e8f4",fontFamily:"IBM Plex Mono",display:"flex",alignItems:"center",gap:3}}>
            <span style={{fontSize:13}}>{PE[task.source]||"🔔"}</span>{task.contact||task.source}
          </span>
          {tSub>0 && <span style={{fontSize:10,color:"#cbd5e1",fontFamily:"IBM Plex Mono"}}>[{dSub}/{tSub}]</span>}
          {task.dueDate && <span style={{fontSize:10,fontFamily:"IBM Plex Mono",color:overdue?"#ffb3b3":"#a5c9ff",background:overdue?"#4b1218":"#101e37",borderRadius:4,display:"inline-flex",alignItems:"center",gap:4,padding:"2px 6px"}}>{overdue?"⚠":"📅"} {fmtDate(task.dueDate)}</span>}
          {nudge && <span style={{fontSize:10,fontFamily:"IBM Plex Mono",color:"#fbbf24",background:"#2e2c0d",borderRadius:4,padding:"2px 6px"}}>🔔 nudge due</span>}
          {aging && !overdue && task.status!=="done" && <span style={{fontSize:10,color:"#9ca3af",fontFamily:"IBM Plex Mono"}}>{age}d old</span>}
          {task.aiGroup && <span style={{fontSize:10,color:"#f8fafc",fontFamily:"IBM Plex Mono",border:"1px solid #4f46e5",background:"#1f1b3a",borderRadius:4,padding:"2px 6px"}}>{task.aiGroup}</span>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
        <div style={{position:"relative"}}>
          <StatBadge status={task.status} sm onClick={e=>{e.stopPropagation();setShowSM(v=>!v);}}/>
          {showSM && <StatMenu task={task} onUpdate={onUpdate} onClose={()=>setShowSM(false)}/>}
        </div>
        <span style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono"}}>{ago(task.createdAt)}</span>
      </div>
    </div>
  );
};

// ── Task Detail
const TaskDetail = ({task,onUpdate,onClose,isMob}) => {
  const [ns,setNs] = useState("");
  const [aiL,setAiL] = useState(false);
  const [editN,setEditN] = useState(false);
  const [nv,setNv] = useState(task.notes||"");
  const [showSM,setShowSM] = useState(false);
  useEffect(()=>{setNv(task.notes||"");setEditN(false);},[task.id]);

  const doBreakdown = async()=>{
    setAiL(true);
    const subs=await apiBreakdown(task);
    if(subs.length) onUpdate({subtasks:[...task.subtasks,...subs.map(t=>({id:gid(),title:t,done:false}))]});
    setAiL(false);
  };
  const addSub=()=>{ if(!ns.trim())return; onUpdate({subtasks:[...task.subtasks,{id:gid(),title:ns.trim(),done:false}]}); setNs(""); };
  const togSub=id=>onUpdate({subtasks:task.subtasks.map(s=>s.id===id?{...s,done:!s.done}:s)});
  const delSub=id=>onUpdate({subtasks:task.subtasks.filter(s=>s.id!==id)});

  const wrap = isMob ? {position:"fixed",inset:0,zIndex:400,background:"#070b16",display:"flex",flexDirection:"column",overflowY:"auto"}
    : {height:"100%",display:"flex",flexDirection:"column",background:"#070b16",borderLeft:"1px solid #141d35"};

  const inp = {width:"100%",padding:"7px 10px",fontSize:12,fontFamily:"IBM Plex Mono"};
  const doneCount = task.subtasks.filter(s=>s.done).length;

  return (
    <div className={isMob?"bu":""} style={wrap}>
      {/* Header */}
      <div style={{padding:"15px 17px",borderBottom:"1px solid #141d35",position:"sticky",top:0,background:"#070b16",zIndex:1}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:800,color:"#f8fafc",fontFamily:"Bricolage Grotesque",lineHeight:1.35,marginBottom:8,textAlign:"left"}}>{task.title}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{position:"relative"}}>
                <StatBadge status={task.status} onClick={()=>setShowSM(v=>!v)}/>
                {showSM && <StatMenu task={task} onUpdate={onUpdate} onClose={()=>setShowSM(false)}/>}
              </div>
              <span style={{fontSize:11,color:"#7986b0",fontFamily:"IBM Plex Mono",display:"flex",alignItems:"center",gap:3}}>
                <span style={{fontSize:12}}>{PE[task.source]||"🔔"}</span>{task.contact||task.source}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close task detail" style={{background:"none",border:"none",color:"#7986b0",fontSize:22,cursor:"pointer",lineHeight:1,flexShrink:0,padding:2}}>×</button>
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,padding:"16px 17px",display:"flex",flexDirection:"column",gap:18,overflowY:"auto"}}>

        {/* Priority */}
        <div>
          <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Priority</div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {[1,2,3,4,5].map(p=>(
              <button key={p} onClick={()=>onUpdate({priority:p})} aria-label={`Priority ${p} — ${PC[p].l}`} aria-pressed={task.priority===p} style={{width:27,height:27,borderRadius:"50%",border:"none",background:task.priority===p?PC[p].c:"#0e1628",color:task.priority===p?"#000":PC[p].c,cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:task.priority===p?`0 0 8px ${PC[p].c}70`:"none",transition:"all 0.12s"}}>{p}</button>
            ))}
            <span style={{fontSize:10,color:PC[task.priority]?.c,fontFamily:"IBM Plex Mono",marginLeft:5}}>{PC[task.priority]?.l}</span>
          </div>
        </div>

        {/* Due date */}
        <div>
          <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Due date</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="date" value={task.dueDate||""} onChange={e=>onUpdate({dueDate:e.target.value||null})}
              style={{padding:"5px 9px",fontSize:12,fontFamily:"IBM Plex Mono",flex:1,colorScheme:"dark"}}/>
            {task.dueDate && <button onClick={()=>onUpdate({dueDate:null})} style={{background:"none",border:"none",color:"#7986b0",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
          </div>
          {isOverdue(task) && <div style={{fontSize:10,color:"#ef4444",fontFamily:"IBM Plex Mono",marginTop:5}}>⚠ Overdue — was due {fmtDate(task.dueDate)}</div>}
        </div>

        {/* Notes */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em"}}>Notes</span>
            {!editN && <button onClick={()=>setEditN(true)} style={{background:"none",border:"none",color:"#7986b0",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono"}}>edit</button>}
          </div>
          {editN ? (
            <>
              <textarea value={nv} onChange={e=>setNv(e.target.value)} rows={3} style={{...inp,resize:"vertical"}}/>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button onClick={()=>{onUpdate({notes:nv});setEditN(false);}} style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Bricolage Grotesque"}}>Save</button>
                <button onClick={()=>{setNv(task.notes||"");setEditN(false);}} style={{background:"transparent",color:"#7986b0",border:"1px solid #1e2842",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11}}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{fontSize:12,fontFamily:"IBM Plex Mono",lineHeight:1.6,color:task.notes?"#7986b0":"#2d3a58",fontStyle:task.notes?"normal":"italic"}}>
              {task.notes||"No notes — tap edit to add context"}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em"}}>
              Subtasks {task.subtasks.length>0 && `${doneCount}/${task.subtasks.length}`}
            </span>
            <button onClick={doBreakdown} disabled={aiL} style={{background:"#120d24",color:"#a855f7",border:"1px solid #9333ea35",borderRadius:5,padding:"2px 8px",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono",display:"inline-flex",alignItems:"center",gap:4}}>
              {aiL?<><Spin s={10}/> working...</>:"🤖 AI breakdown"}
            </button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:8}}>
            {task.subtasks.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                <input type="checkbox" checked={s.done} onChange={()=>togSub(s.id)} style={{accentColor:"#f59e0b",cursor:"pointer",flexShrink:0,width:14,height:14}}/>
                <span style={{flex:1,fontSize:12,fontFamily:"IBM Plex Mono",color:s.done?"#2d3a58":"#7986b0",textDecoration:s.done?"line-through":"none"}}>{s.title}</span>
                <button onClick={()=>delSub(s.id)} style={{background:"none",border:"none",color:"#6a7b9c",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <input value={ns} onChange={e=>setNs(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSub()} placeholder="Add subtask…" style={{flex:1,padding:"6px 10px",fontSize:11,fontFamily:"IBM Plex Mono"}}/>
            <button onClick={addSub} style={{background:"#141d35",border:"1px solid #1e2842",color:"#7986b0",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:16,lineHeight:1}}>+</button>
          </div>
        </div>

        {/* Scenario helper — inbox / in_progress */}
        {(task.status==="inbox"||task.status==="in_progress") ? (
          <div style={{background:"#0d1628",border:"1px solid #1e2842",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Quick transitions</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>onUpdate({status:"responded"})} style={{background:"#1c1400",color:"#fbbf24",border:"1px solid #d9770640",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>↩ Responded</button>
              <button onClick={()=>onUpdate({status:"waiting"})} style={{background:"#042524",color:"#2dd4bf",border:"1px solid #0d948840",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>⏳ Waiting on them</button>
            </div>
            <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",marginTop:8,lineHeight:1.5}}>
              "Responded" = replied, but task still has open subtasks<br/>
              "Waiting" = ball is in their court; task parks here
            </div>
          </div>
        ) : null}

        {/* Scenario helper — waiting */}
        {task.status==="waiting" && (
          <div style={{background:"#042524",border:"1px solid #0d948835",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#0d9488",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Waiting on {task.contact||"them"}</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",marginBottom:5}}>NUDGE ME IF NO REPLY BY</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="date" value={task.followUpDate||""} onChange={e=>onUpdate({followUpDate:e.target.value||null})}
                  style={{padding:"5px 9px",fontSize:12,fontFamily:"IBM Plex Mono",flex:1,colorScheme:"dark",background:"#031c1b",border:"1px solid #0d948840"}}/>
                {task.followUpDate && <button onClick={()=>onUpdate({followUpDate:null})} style={{background:"none",border:"none",color:"#7986b0",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
              </div>
              {isNudgeDue(task) && <div style={{fontSize:10,color:"#f59e0b",fontFamily:"IBM Plex Mono",marginTop:5}}>🔔 Nudge date passed — time to follow up!</div>}
            </div>
            <div style={{borderTop:"1px solid #0d948825",paddingTop:10}}>
              <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",marginBottom:6}}>THEY RESPONDED?</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>onUpdate({status:"in_progress",notes:(task.notes?task.notes+"\n":"")+"[They responded — follow up needed]",followUpDate:null})}
                  style={{background:"#1a0e30",color:"#a855f7",border:"1px solid #9333ea35",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>💬 Opens new follow-up</button>
                <button onClick={()=>onUpdate({status:"done",followUpDate:null})}
                  style={{background:"#022c22",color:"#4ade80",border:"1px solid #16a34a35",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>✓ Fully resolved</button>
              </div>
            </div>
          </div>
        )}

        {/* Meta */}
        <div style={{borderTop:"1px solid #141d35",paddingTop:12}}>
          <div style={{fontSize:11,color:"#7986b0",fontFamily:"IBM Plex Mono",lineHeight:1.9}}>
            Added {ago(task.createdAt)} · via {task.source}
            {task.contact && <> · {task.contact}</>}
            {task.aiGroup && <><br/><span style={{color:"#6366f1"}}>🤖 {task.aiGroup}</span></>}
          </div>
        </div>
      </div>

      {/* Footer */}
      {task.status!=="done" && (
        <div style={{padding:"10px 17px",borderTop:"1px solid #141d35",display:"flex",gap:6,position:"sticky",bottom:0,background:"#070b16"}}>
          <button onClick={()=>onUpdate({status:"done"})} style={{flex:1,background:"#022c22",color:"#4ade80",border:"1px solid #16a34a35",borderRadius:8,padding:"9px",cursor:"pointer",fontSize:12,fontFamily:"Bricolage Grotesque",fontWeight:600}}>✓ Done</button>
          {task.status!=="waiting" && (
            <button onClick={()=>onUpdate({status:"waiting"})} style={{flex:1,background:"#042524",color:"#2dd4bf",border:"1px solid #0d948835",borderRadius:8,padding:"9px",cursor:"pointer",fontSize:12,fontFamily:"Bricolage Grotesque",fontWeight:600}}>⏳ Waiting</button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Add Modal
const AddModal = ({onClose,onAdd}) => {
  const [tab,setTab] = useState("quick");
  const [qt,setQt] = useState(""); const [qsrc,setQsrc] = useState("Manual");
  const [pt,setPt] = useState(""); const [parsing,setParsing] = useState(false); const [parsed,setParsed] = useState(null);
  const [ff,setFf] = useState({title:"",source:"Manual",contact:"",notes:"",priority:3});
  const [dump,setDump] = useState(""); const [dumping,setDumping] = useState(false);
  const [dumpTasks,setDumpTasks] = useState(null); const [dumpSel,setDumpSel] = useState({});
  const [imgFile,setImgFile] = useState(null); const [imgPreview,setImgPreview] = useState(null);
  const [imgParsing,setImgParsing] = useState(false); const [imgParsed,setImgParsed] = useState(null);
  const [imgDrag,setImgDrag] = useState(false);

  const loadImage = file => {
    if(!file||!file.type.startsWith("image/")) return;
    setImgFile(file); setImgParsed(null);
    const reader = new FileReader();
    reader.onload = e => setImgPreview(e.target.result);
    reader.readAsDataURL(file);
  };
  const doParseImage = async () => {
    if(!imgFile) return;
    setImgParsing(true);
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(",")[1];
      const mediaType = imgFile.type;
      try { setImgParsed(await apiParseImage(base64, mediaType)); }
      catch(err) { console.error(err); }
      setImgParsing(false);
    };
    reader.readAsDataURL(imgFile);
  };

  const doDump = async () => {
    if(!dump.trim()) return;
    setDumping(true);
    const extracted = await apiBrainDump(dump);
    if(extracted.length) {
      setDumpTasks(extracted);
      const sel={}; extracted.forEach((_,i)=>{sel[i]=true;}); setDumpSel(sel);
    }
    setDumping(false);
  };
  const confirmDump = () => {
    dumpTasks.forEach((t,i)=>{ if(dumpSel[i]) onAdd(t); });
    onClose();
  };

  const quickAdd=()=>{ if(!qt.trim())return; onAdd({title:qt.trim(),source:qsrc,contact:"",notes:"",priority:3}); onClose(); };
  const doParse=async()=>{ if(!pt.trim())return; setParsing(true); setParsed(await apiParse(pt)); setParsing(false); };

  const base = {width:"100%",padding:"9px 12px",fontSize:13,fontFamily:"Bricolage Grotesque"};
  const mono = {width:"100%",padding:"8px 10px",fontSize:12,fontFamily:"IBM Plex Mono"};
  const TABS = [{id:"quick",l:"⚡ Quick"},{id:"parse",l:"🤖 Paste & Parse"},{id:"snap",l:"📷 Snap"},{id:"dump",l:"🧠 Brain Dump"},{id:"full",l:"📝 Full Form"}];

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:500,background:"#00000088",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="bu" role="dialog" aria-modal="true" aria-labelledby="add-modal-title" style={{background:"#0d1420",border:"1px solid #1e2842",borderRadius:12,width:"100%",maxWidth:460,boxShadow:"0 24px 48px #00000090"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid #141d35"}}>
          <div id="add-modal-title" style={{fontSize:15,fontWeight:700,fontFamily:"Bricolage Grotesque",color:"#e2e8f4"}}>Add Task</div>
          <button onClick={onClose} aria-label="Close add task dialog" style={{background:"none",border:"none",color:"#7986b0",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #141d35"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px 4px",background:"none",border:"none",color:tab===t.id?"#f59e0b":"#4a5880",borderBottom:tab===t.id?"2px solid #f59e0b":"2px solid transparent",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono",transition:"color 0.1s"}}>{t.l}</button>
          ))}
        </div>

        <div style={{padding:18}}>
          {tab==="quick" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input autoFocus value={qt} onChange={e=>setQt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&quickAdd()} placeholder="What needs to get done?" style={{...base,fontWeight:600}}/>
              <div style={{display:"flex",gap:8}}>
                <select value={qsrc} onChange={e=>setQsrc(e.target.value)} style={{...mono,width:"auto",flex:1,color:"#7986b0"}}>
                  {PLATFORMS.map(p=><option key={p}>{p}</option>)}
                </select>
                <button onClick={quickAdd} disabled={!qt.trim()} style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,opacity:qt.trim()?1:0.35}}>Add →</button>
              </div>
              <div style={{fontSize:10,color:"#6a7b9c",fontFamily:"IBM Plex Mono"}}>Press Enter to add instantly · Priority and details settable after</div>
            </div>
          )}

          {tab==="parse" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {!parsed ? (
                <>
                  <textarea autoFocus value={pt} onChange={e=>setPt(e.target.value)} placeholder="Paste the raw message, email, or notification here — Claude will extract the task, source, contact, and priority…" rows={5} style={{...mono,resize:"vertical"}}/>
                  <button onClick={doParse} disabled={parsing||!pt.trim()} style={{background:parsing?"#1a1535":"#a855f7",color:"#fff",border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:!pt.trim()?0.4:1}}>
                    {parsing?<><Spin/> Parsing with Claude…</>:"🤖 Extract with Claude"}
                  </button>
                </>
              ) : (
                <div className="fi" style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:10,color:"#a855f7",fontFamily:"IBM Plex Mono",marginBottom:2}}>✓ AI extracted — edit if needed:</div>
                  <input value={parsed.title} onChange={e=>setParsed(d=>({...d,title:e.target.value}))} style={{...base,fontWeight:600}}/>
                  <div style={{display:"flex",gap:8}}>
                    <select value={parsed.source} onChange={e=>setParsed(d=>({...d,source:e.target.value}))} style={{...mono,width:"auto",flex:1,color:"#7986b0"}}>
                      {PLATFORMS.map(p=><option key={p}>{p}</option>)}
                    </select>
                    <input value={parsed.contact||""} onChange={e=>setParsed(d=>({...d,contact:e.target.value}))} placeholder="Contact" style={{...mono,width:"auto",flex:1}}/>
                  </div>
                  {parsed.notes && <div style={{fontSize:11,color:"#7986b0",fontFamily:"IBM Plex Mono",fontStyle:"italic",padding:"6px 0"}}>{parsed.notes}</div>}
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>setParsed(null)} style={{flex:1,background:"transparent",border:"1px solid #1e2842",borderRadius:8,padding:"8px",color:"#7986b0",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>← Redo</button>
                    <button onClick={()=>{onAdd(parsed);onClose();}} style={{flex:2,background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700}}>Confirm & Add →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="snap" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {!imgParsed ? (
                <>
                  <div
                    onDragOver={e=>{e.preventDefault();setImgDrag(true);}}
                    onDragLeave={()=>setImgDrag(false)}
                    onDrop={e=>{e.preventDefault();setImgDrag(false);loadImage(e.dataTransfer.files[0]);}}
                    onClick={()=>document.getElementById("img-upload").click()}
                    style={{border:`2px dashed ${imgDrag?"#a855f7":"#1e2842"}`,borderRadius:10,padding:"24px 16px",textAlign:"center",cursor:"pointer",background:imgDrag?"#1a0d30":"#070c1c",transition:"all 0.15s",position:"relative"}}>
                    <input id="img-upload" type="file" accept="image/*" capture="environment"
                      onChange={e=>loadImage(e.target.files[0])}
                      style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}
                      aria-label="Upload notification screenshot"/>
                    {imgPreview ? (
                      <img src={imgPreview} alt="Selected notification screenshot"
                        style={{maxHeight:160,maxWidth:"100%",borderRadius:6,objectFit:"contain",pointerEvents:"none"}}/>
                    ) : (
                      <>
                        <div style={{fontSize:32,marginBottom:8}} aria-hidden="true">📷</div>
                        <div style={{fontSize:12,fontFamily:"Bricolage Grotesque",fontWeight:600,color:"#c8d0e8",marginBottom:4}}>Drop a screenshot or tap to upload</div>
                        <div style={{fontSize:10,color:"#6a7b9c",fontFamily:"IBM Plex Mono"}}>Notification, email, Slack thread, SMS — anything with text</div>
                      </>
                    )}
                  </div>
                  {imgPreview && (
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setImgFile(null);setImgPreview(null);}} style={{flex:1,background:"transparent",border:"1px solid #1e2842",borderRadius:8,padding:"8px",color:"#7986b0",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>× Clear</button>
                      <button onClick={doParseImage} disabled={imgParsing} style={{flex:2,background:imgParsing?"#1a1535":"#a855f7",color:"#fff",border:"none",borderRadius:8,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                        {imgParsing?<><Spin/> Reading image…</>:"🤖 Extract Task"}
                      </button>
                    </div>
                  )}
                  <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",lineHeight:1.6}}>
                    On mobile, tap to open your camera and photograph a notification directly
                  </div>
                </>
              ) : (
                <div className="fi" style={{display:"flex",flexDirection:"column",gap:8}}>
                  {imgPreview && <img src={imgPreview} alt="Source screenshot" style={{maxHeight:80,maxWidth:"100%",borderRadius:5,objectFit:"contain",opacity:0.6}}/>}
                  <div style={{fontSize:10,color:"#a855f7",fontFamily:"IBM Plex Mono",marginBottom:2}}>✓ AI extracted — edit if needed:</div>
                  <input value={imgParsed.title} onChange={e=>setImgParsed(d=>({...d,title:e.target.value}))} style={{...base,fontWeight:600}}/>
                  <div style={{display:"flex",gap:8}}>
                    <select value={imgParsed.source} onChange={e=>setImgParsed(d=>({...d,source:e.target.value}))} style={{...mono,width:"auto",flex:1,color:"#7986b0"}}>
                      {PLATFORMS.map(p=><option key={p}>{p}</option>)}
                    </select>
                    <input value={imgParsed.contact||""} onChange={e=>setImgParsed(d=>({...d,contact:e.target.value}))} placeholder="Contact" style={{...mono,width:"auto",flex:1}}/>
                  </div>
                  {imgParsed.notes && <div style={{fontSize:11,color:"#7986b0",fontFamily:"IBM Plex Mono",fontStyle:"italic",padding:"4px 0"}}>{imgParsed.notes}</div>}
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>setImgParsed(null)} style={{flex:1,background:"transparent",border:"1px solid #1e2842",borderRadius:8,padding:"8px",color:"#7986b0",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono"}}>← Redo</button>
                    <button onClick={()=>{onAdd(imgParsed);onClose();}} style={{flex:2,background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700}}>Confirm & Add →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="dump" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {!dumpTasks ? (
                <>
                  <div style={{fontSize:10,color:"#7986b0",fontFamily:"IBM Plex Mono",lineHeight:1.6}}>
                    Paste anything — meeting notes, a wall of texts, a rambling email, your unorganized thoughts. Claude will pull out every actionable task.
                  </div>
                  <textarea autoFocus value={dump} onChange={e=>setDump(e.target.value)} placeholder="Just start typing or pasting. Don't organize it. That's the point." rows={6} style={{...mono,resize:"vertical"}}/>
                  <button onClick={doDump} disabled={dumping||!dump.trim()} style={{background:dumping?"#1a1535":"#7c3aed",color:"#fff",border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:!dump.trim()?0.4:1}}>
                    {dumping?<><Spin/> Extracting tasks…</>:"🧠 Extract All Tasks"}
                  </button>
                </>
              ) : (
                <div className="fi" style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:10,color:"#a855f7",fontFamily:"IBM Plex Mono"}}>✓ {dumpTasks.length} tasks found — uncheck any to skip:</span>
                    <button onClick={()=>setDumpTasks(null)} style={{background:"none",border:"none",color:"#7986b0",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono"}}>← Redo</button>
                  </div>
                  <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {dumpTasks.map((t,i)=>(
                      <div key={i} onClick={()=>setDumpSel(s=>({...s,[i]:!s[i]}))} style={{display:"flex",gap:8,padding:"7px 9px",background:dumpSel[i]?"#0f1c38":"#0a0d18",border:`1px solid ${dumpSel[i]?"#1e3060":"#141d35"}`,borderLeft:`3px solid ${PC[t.priority]?.c||"#6b7280"}`,borderRadius:6,cursor:"pointer",opacity:dumpSel[i]?1:0.45,transition:"all 0.1s"}}>
                        <input type="checkbox" checked={!!dumpSel[i]} onChange={()=>{}} style={{accentColor:"#a855f7",flexShrink:0,cursor:"pointer",marginTop:2}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:"#dce1f4",fontFamily:"Bricolage Grotesque",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</div>
                          <div style={{fontSize:9,color:"#7986b0",fontFamily:"IBM Plex Mono",display:"flex",gap:6}}>
                            <span>{PE[t.source]||"✏️"} {t.source}</span>
                            {t.contact&&<span>· {t.contact}</span>}
                            <span style={{color:PC[t.priority]?.c}}>P{t.priority}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={confirmDump} style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,marginTop:2}}>
                    Add {Object.values(dumpSel).filter(Boolean).length} Tasks →
                  </button>
                </div>
              )}
            </div>
          )}

          {tab==="full" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input autoFocus value={ff.title} onChange={e=>setFf(f=>({...f,title:e.target.value}))} placeholder="Task title (start with a verb)" style={{...base,fontWeight:600}}/>
              <div style={{display:"flex",gap:8}}>
                <select value={ff.source} onChange={e=>setFf(f=>({...f,source:e.target.value}))} style={{...mono,width:"auto",flex:1,color:"#7986b0"}}>
                  {PLATFORMS.map(p=><option key={p}>{p}</option>)}
                </select>
                <input value={ff.contact} onChange={e=>setFf(f=>({...f,contact:e.target.value}))} placeholder="Contact / person" style={{...mono,width:"auto",flex:1}}/>
              </div>
              <textarea value={ff.notes} onChange={e=>setFf(f=>({...f,notes:e.target.value}))} placeholder="Context, deadlines, relevant details…" rows={3} style={{...mono,resize:"vertical"}}/>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:"#7986b0",fontFamily:"IBM Plex Mono",flexShrink:0}}>Due:</span>
                <input type="date" value={ff.dueDate||""} onChange={e=>setFf(f=>({...f,dueDate:e.target.value||null}))} style={{...mono,width:"auto",flex:1,colorScheme:"dark"}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:"#7986b0",fontFamily:"IBM Plex Mono",flexShrink:0}}>Priority:</span>
                {[1,2,3,4,5].map(p=>(
                  <button key={p} onClick={()=>setFf(f=>({...f,priority:p}))} style={{width:27,height:27,borderRadius:"50%",border:"none",background:ff.priority===p?PC[p].c:"#0e1628",color:ff.priority===p?"#000":PC[p].c,cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:ff.priority===p?`0 0 7px ${PC[p].c}70`:"none",transition:"all 0.12s"}}>{p}</button>
                ))}
              </div>
              <button onClick={()=>{if(ff.title.trim()){onAdd(ff);onClose();}}} disabled={!ff.title.trim()} style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,opacity:ff.title.trim()?1:0.35}}>Add Task →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Nav config
const NAV = [
  {id:"focus",l:"Focus Mode",e:"🎯"},
  null,
  {id:"inbox",l:"Inbox",e:"📥",bc:"inbox"},
  {id:"all",l:"All Active",e:"📋"},
  {id:"responded",l:"Responded",e:"↩"},
  {id:"waiting",l:"Waiting",e:"⏳",bc:"waiting"},
  {id:"done",l:"Done",e:"✓"},
  null,
  {id:"by-platform",l:"By Platform",e:"🔷"},
  {id:"by-person",l:"By Person",e:"👤"},
  {id:"ai-groups",l:"AI Groups",e:"🤖"},
  null,
  {id:"calendar",l:"Calendar",e:"📅"},
];
const MOB_NAV = [{id:"focus",e:"🎯",l:"Focus"},{id:"inbox",e:"📥",l:"Inbox"},{id:"waiting",e:"⏳",l:"Wait"},{id:"all",e:"📋",l:"All"}];
const MORE_NAV = [
  {id:"done",e:"✓",l:"Done"},
  {id:"responded",e:"↩",l:"Responded"},
  {id:"by-platform",e:"🔷",l:"By Platform"},
  {id:"by-person",e:"👤",l:"By Person"},
  {id:"ai-groups",e:"🤖",l:"AI Groups"},
  {id:"calendar",e:"📅",l:"Calendar"},
];

// ── Main App
export default function App() {
  const isMob = useIsMobile();
  const [tasks,setTasks] = useState(INIT);
  const [loaded,setLoaded] = useState(false);
  const [view,setView] = useState("inbox");
  const [selId,setSelId] = useState(null);
  const [showAdd,setShowAdd] = useState(false);
  const [aiGroups,setAiGroups] = useState(null);
  const [loadPri,setLoadPri] = useState(false);
  const [loadGrp,setLoadGrp] = useState(false);
  const [q,setQ] = useState("");
  const [flash,setFlash] = useState("");
  const [showMore,setShowMore] = useState(false);
  const [calMonth,setCalMonth] = useState(()=>new Date());
  const [calSelDay,setCalSelDay] = useState(null);

  // Load from storage on mount
  useEffect(()=>{
    storageLoad().then(saved=>{ if(saved?.length) setTasks(saved); setLoaded(true); });
  },[]);

  // Save to storage when tasks change
  useEffect(()=>{ if(!loaded) return; const t=setTimeout(()=>storageSave(tasks),600); return()=>clearTimeout(t); },[tasks,loaded]);

  const selTask = tasks.find(t=>t.id===selId);
  const upd = useCallback((id,u)=>setTasks(ts=>ts.map(t=>t.id===id?{...t,...u}:t)),[]);
  const add = useCallback(d=>{
    const t={id:gid(),status:"inbox",subtasks:[],aiGroup:null,createdAt:Date.now(),priority:3,...d};
    setTasks(ts=>[t,...ts]);
  },[]);

  const inboxCt = tasks.filter(t=>t.status==="inbox"||t.status==="in_progress").length;
  const waitCt = tasks.filter(t=>t.status==="waiting").length;

  const vTasks = useMemo(()=>{
    let r=tasks;
    if(q){const ql=q.toLowerCase();r=r.filter(t=>t.title.toLowerCase().includes(ql)||(t.contact||"").toLowerCase().includes(ql)||(t.source||"").toLowerCase().includes(ql)||(t.aiGroup||"").toLowerCase().includes(ql));}
    switch(view){
      case"inbox": return r.filter(t=>t.status==="inbox"||t.status==="in_progress").sort((a,b)=>b.priority-a.priority);
      case"all": return r.filter(t=>t.status!=="done").sort((a,b)=>b.priority-a.priority);
      case"responded": return r.filter(t=>t.status==="responded");
      case"waiting": return r.filter(t=>t.status==="waiting");
      case"done": return r.filter(t=>t.status==="done");
      default: return r;
    }
  },[tasks,view,q]);

  const byPlatform = useMemo(()=>{ const g={}; tasks.filter(t=>t.status!=="done").forEach(t=>{const k=t.source||"Other";(g[k]=g[k]||[]).push(t);}); return g; },[tasks]);
  const byPerson   = useMemo(()=>{ const g={}; tasks.filter(t=>t.status!=="done").forEach(t=>{const k=t.contact||"(no contact)";(g[k]=g[k]||[]).push(t);}); return g; },[tasks]);

  const showFlash = m=>{ setFlash(m); setTimeout(()=>setFlash(""),3500); };

  const doPrioritize = async()=>{
    setLoadPri(true);
    const res=await apiPrioritize(tasks);
    if(res.length){ setTasks(ts=>ts.map(t=>{const r=res.find(r=>r.id===t.id); return r?{...t,priority:r.priority}:t;})); showFlash(`✓ Reprioritized ${res.length} tasks`); }
    setLoadPri(false);
  };
  const doGroup = async()=>{
    setLoadGrp(true);
    try {
      const groups=await apiGroup(tasks);
      if(groups.length){
        const mp={}; groups.forEach(g=>g.taskIds.forEach(id=>{mp[id]=g.groupName;}));
        setTasks(ts=>ts.map(t=>mp[t.id]?{...t,aiGroup:mp[t.id]}:t));
        setAiGroups(groups); setView("ai-groups");
        showFlash(`✓ Grouped into ${groups.length} contexts`);
      } else {
        showFlash("No groups returned from Claude.");
      }
    } catch (err) {
      showFlash(`AI grouping failed: ${err.message}`);
    } finally {
      setLoadGrp(false);
    }
  };

  const renderGroup = groups => (
    <>
      {Object.entries(groups).map(([name,gt])=>(
        <div key={name} style={{marginBottom:18}}>
          <div style={{fontSize:9,color:"#7986b0",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.09em",padding:"3px 0 5px",marginBottom:5,borderBottom:"1px solid #141d35",display:"flex",justifyContent:"space-between"}}>
            {name}<span style={{color:"#6a7b9c"}}>{gt.length}</span>
          </div>
          {gt.map(t=><TaskCard key={t.id} task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>)}
        </div>
      ))}
    </>
  );

  const renderAI = ()=>{
    if(!aiGroups) return (
      <div style={{textAlign:"center",padding:"60px 20px",color:"#7986b0"}}>
        <div style={{fontSize:36,marginBottom:12}}>🤖</div>
        <div style={{fontFamily:"Bricolage Grotesque",fontSize:15,marginBottom:6,color:"#7986b0",fontWeight:600}}>No AI groups yet</div>
        <div style={{fontFamily:"IBM Plex Mono",fontSize:11,color:"#6a7b9c",marginBottom:20,lineHeight:1.6}}>Let Claude organize your tasks by work context<br/>to minimize context-switching overhead</div>
        <button onClick={doGroup} disabled={loadGrp} style={{background:"#120d24",color:"#a855f7",border:"1px solid #9333ea40",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontSize:12,fontFamily:"Bricolage Grotesque",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6}}>
          {loadGrp?<><Spin s={12}/> Grouping…</>:"🤖 Group My Tasks"}
        </button>
      </div>
    );
    const gm={}; aiGroups.forEach(g=>{gm[g.groupName]=tasks.filter(t=>g.taskIds.includes(t.id)&&t.status!=="done");});
    return renderGroup(gm);
  };

  const renderFocus = () => {
    const active = tasks.filter(t=>t.status==="inbox"||t.status==="in_progress").sort((a,b)=>b.priority-a.priority);
    const top3 = active.slice(0,3);
    const rest = active.slice(3);
    const overdues = tasks.filter(t=>isOverdue(t)&&t.status!=="done");
    return (
      <div style={{padding:"4px 0"}}>
        <div style={{background:"#0a0d1a",border:"1px solid #1e3060",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:"#818cf8",fontFamily:"Bricolage Grotesque",marginBottom:3}}>🎯 Focus on these {top3.length}</div>
          <div style={{fontSize:10,color:"#6a7b9c",fontFamily:"IBM Plex Mono",lineHeight:1.5}}>Everything else is hidden. Finish one, then reassess.</div>
        </div>
        {top3.length===0 && (
          <div style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:32,marginBottom:8}}>🎉</div>
            <div style={{fontFamily:"Bricolage Grotesque",fontSize:14,color:"#4ade80",fontWeight:600}}>Inbox clear — nothing to focus on</div>
          </div>
        )}
        {top3.map((t,i)=>(
          <div key={t.id} style={{marginBottom:10}}>
            <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",marginBottom:4,letterSpacing:"0.06em"}}>#{i+1}</div>
            <TaskCard task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>
          </div>
        ))}
        {overdues.length>0 && (
          <div style={{marginTop:16,background:"#1a0808",border:"1px solid #3d1010",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#ef4444",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>⚠ Overdue — needs attention</div>
            {overdues.map(t=><TaskCard key={t.id} task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>)}
          </div>
        )}
        {rest.length>0 && (
          <div style={{marginTop:16,opacity:0.35}}>
            <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Parked — do these after</div>
            {rest.map(t=><TaskCard key={t.id} task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>)}
          </div>
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const yr=calMonth.getFullYear(), mo=calMonth.getMonth();
    const firstDay=new Date(yr,mo,1).getDay(), dim=new Date(yr,mo+1,0).getDate();
    const now=new Date(), todayDs=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
    const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const byDate={};
    tasks.forEach(t=>{ if(t.dueDate&&t.status!=="done")(byDate[t.dueDate]=byDate[t.dueDate]||[]).push(t); });
    const cells=[];
    for(let i=0;i<firstDay;i++) cells.push(null);
    for(let d=1;d<=dim;d++){const ds=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;cells.push({d,ds,tasks:byDate[ds]||[]});}
    while(cells.length%7!==0) cells.push(null);
    const selTasks=calSelDay?(byDate[calSelDay]||[]):[];
    const noDate=tasks.filter(t=>!t.dueDate&&t.status!=="done").sort((a,b)=>b.priority-a.priority);
    const prevMonth=()=>{setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1));setCalSelDay(null);};
    const nextMonth=()=>{setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1));setCalSelDay(null);};
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button onClick={prevMonth} style={{background:"#0d1628",border:"1px solid #1e2842",borderRadius:7,color:"#7986b0",width:30,height:30,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <div>
            <span style={{fontFamily:"Bricolage Grotesque",fontWeight:700,fontSize:15,color:"#c8d0e8"}}>{MONTHS[mo]} {yr}</span>
            <button onClick={()=>{setCalMonth(new Date());setCalSelDay(null);}} style={{marginLeft:8,background:"none",border:"1px solid #1e2842",borderRadius:5,color:"#7986b0",padding:"1px 7px",cursor:"pointer",fontSize:9,fontFamily:"IBM Plex Mono"}}>today</button>
          </div>
          <button onClick={nextMonth} style={{background:"#0d1628",border:"1px solid #1e2842",borderRadius:7,color:"#7986b0",width:30,height:30,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
          {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:8,color:"#6a7b9c",fontFamily:"IBM Plex Mono",padding:"2px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {cells.map((cell,i)=>{
            if(!cell) return <div key={i} style={{minHeight:42}}/>;
            const isTdy=cell.ds===todayDs, isSel=cell.ds===calSelDay;
            const hasPast=cell.tasks.some(t=>isOverdue(t)), hasTasks=cell.tasks.length>0;
            return (
              <div key={i} onClick={()=>hasTasks&&setCalSelDay(isSel?null:cell.ds)}
                style={{minHeight:42,background:isSel?"#0f1c38":isTdy?"#0a1020":"#080c18",border:`1px solid ${isSel?"#1e3060":isTdy?"#1e2842":"#111827"}`,borderTop:isTdy?"2px solid #f59e0b":hasPast?"2px solid #ef4444":"1px solid #111827",borderRadius:5,padding:"3px 4px",cursor:hasTasks?"pointer":"default",transition:"background 0.1s"}}>
                <div style={{fontSize:9,fontFamily:"IBM Plex Mono",color:isTdy?"#f59e0b":hasPast?"#ef4444":"#3d4d72",fontWeight:isTdy?700:400,marginBottom:3}}>{cell.d}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                  {cell.tasks.slice(0,6).map((t,ti)=>(
                    <div key={ti} title={t.title} style={{width:5,height:5,borderRadius:"50%",background:isOverdue(t)?"#ef4444":PC[t.priority]?.c||"#6b7280",flexShrink:0}}/>
                  ))}
                  {cell.tasks.length>6&&<span style={{fontSize:6,color:"#7986b0",fontFamily:"IBM Plex Mono",lineHeight:"5px",alignSelf:"center"}}>+{cell.tasks.length-6}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          {[5,4,3,2,1].map(p=>(
            <div key={p} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:PC[p].c}}/>{PC[p].l}
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#ef4444"}}/>Overdue
          </div>
        </div>

        {/* Selected day */}
        {calSelDay && selTasks.length>0 && (
          <div style={{marginTop:16}} className="fi">
            <div style={{fontSize:9,color:"#818cf8",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              <span>📅 {fmtDate(calSelDay)} · {selTasks.length} task{selTasks.length>1?"s":""}</span>
              <button onClick={()=>setCalSelDay(null)} style={{background:"none",border:"none",color:"#7986b0",cursor:"pointer",fontSize:12}}>×</button>
            </div>
            {selTasks.sort((a,b)=>b.priority-a.priority).map(t=><TaskCard key={t.id} task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>)}
          </div>
        )}

        {/* No due date */}
        {noDate.length>0 && (
          <div style={{marginTop:20,borderTop:"1px solid #141d35",paddingTop:14}}>
            <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>No due date · {noDate.length}</div>
            {noDate.map(t=><TaskCard key={t.id} task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>)}
          </div>
        )}
      </div>
    );
  };

  const renderMain = ()=>{
    if(view==="focus") return renderFocus();
    if(view==="calendar") return renderCalendar();
    if(view==="by-platform") return renderGroup(byPlatform);
    if(view==="by-person") return renderGroup(byPerson);
    if(view==="ai-groups") return renderAI();
    if(vTasks.length===0) return (
      <div style={{textAlign:"center",padding:"60px 20px"}}>
        <div style={{fontSize:36,marginBottom:10}}>{view==="done"?"🎉":view==="waiting"?"⏳":view==="responded"?"↩":"📥"}</div>
        <div style={{fontFamily:"Bricolage Grotesque",fontSize:14,color:"#7986b0",fontWeight:600}}>
          {view==="done"?"Nothing marked done yet":view==="waiting"?"Not waiting on anything right now":view==="responded"?"No responded tasks":"Inbox is clear!"}
        </div>
      </div>
    );
    return vTasks.map(t=><TaskCard key={t.id} task={t} isSelected={t.id===selId} onClick={()=>setSelId(t.id===selId?null:t.id)} onUpdate={u=>upd(t.id,u)}/>);
  };

  const curNav = NAV.find(n=>n&&n.id===view);
  const navBtn = (item) => {
    const on=view===item.id, badge=item.bc==="inbox"?inboxCt:item.bc==="waiting"?waitCt:0;
    return (
      <button key={item.id} onClick={()=>{setView(item.id);setSelId(null);}} className={`nb${on?" on":""}`}
        aria-current={on?"page":undefined}
        style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 14px",background:"transparent",border:"none",borderLeft:"2px solid transparent",color:on?"#f59e0b":"#7986b0",cursor:"pointer",fontSize:12,fontFamily:"Bricolage Grotesque",fontWeight:on?600:400,textAlign:"left",transition:"color 0.1s"}}>
        <span style={{fontSize:13}} aria-hidden="true">{item.e}</span>
        <span style={{flex:1}}>{item.l}</span>
        {badge>0 && <span aria-label={`${badge} items`} style={{background:item.bc==="waiting"?"#0d9488":"#f59e0b",color:item.bc==="waiting"?"#fff":"#000",fontSize:9,fontWeight:700,borderRadius:9,padding:"1px 5px",fontFamily:"IBM Plex Mono"}}>{badge}</span>}
      </button>
    );
  };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:"#060b16",fontFamily:"Bricolage Grotesque,system-ui,sans-serif",color:"#e2e8f4"}}>

      {/* SIDEBAR */}
      <div className="sidebar" style={{width:210,flexShrink:0,background:"#07090e",borderRight:"1px solid #141d35",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 16px 14px",borderBottom:"1px solid #141d35"}}>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.03em",background:"linear-gradient(135deg,#f59e0b,#f43f5e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DISPATCH</div>
          <div style={{fontSize:9,color:"#6a7b9c",fontFamily:"IBM Plex Mono",marginTop:1,letterSpacing:"0.05em"}}>ADHD INBOX MANAGER</div>
        </div>
        <nav role="navigation" aria-label="Primary navigation" style={{flex:1,padding:"6px 0",overflowY:"auto"}}>
          {NAV.map((item,i)=>!item ? <div key={i} style={{height:1,background:"#141d35",margin:"5px 0"}} role="separator"/> : navBtn(item))}
        </nav>
        <div style={{padding:"10px 12px",borderTop:"1px solid #141d35"}}>
          <div style={{fontSize:9,color:"#7986b0",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}} aria-hidden="true">AI Actions</div>
          <div role="status" aria-live="polite" aria-atomic="true" style={{fontSize:10,color:"#a855f7",fontFamily:"IBM Plex Mono",marginBottom:flash?6:0,lineHeight:1.5,minHeight:0}}>{flash||""}</div>
          <button onClick={doPrioritize} disabled={loadPri} className="ai-btn" style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#0a0e1c",border:"1px solid #1e2842",borderRadius:6,color:"#f59e0b",padding:"6px 8px",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono",marginBottom:5,transition:"opacity 0.12s"}}>
            {loadPri?<><Spin s={10}/> Prioritizing…</>:"⚡ Prioritize All"}
          </button>
          <button onClick={doGroup} disabled={loadGrp} className="ai-btn" style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#0a0e1c",border:"1px solid #1e2842",borderRadius:6,color:"#a855f7",padding:"6px 8px",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono",transition:"opacity 0.12s"}}>
            {loadGrp?<><Spin s={10}/> Grouping…</>:"🤖 Group Tasks"}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <main role="main" style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #141d35",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"#090d1c",border:"1px solid #141d35",borderRadius:8,padding:"7px 10px"}}>
            <span style={{color:"#6a7b9c",fontSize:12}}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search tasks…" style={{flex:1,background:"transparent",border:"none",color:"#e2e8f4",fontSize:13,fontFamily:"Bricolage Grotesque",outline:"none",borderRadius:0}}/>
            {q && <button onClick={()=>setQ("")} style={{background:"none",border:"none",color:"#7986b0",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
          </div>
          <button onClick={()=>setShowAdd(true)}
            style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontFamily:"Bricolage Grotesque",fontWeight:700,flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.1)"}
            onMouseLeave={e=>e.currentTarget.style.filter=""}>
            + Add
          </button>
        </div>

        <div style={{padding:"10px 14px 6px",flexShrink:0}}>
          <h1 style={{fontSize:16,fontWeight:800,color:"#c8d0e8",fontFamily:"Bricolage Grotesque"}}>
            {curNav?.e} {curNav?.l}
            {["inbox","all"].includes(view)&&vTasks.length>0 && <span style={{fontSize:11,color:"#6a7b9c",fontWeight:400,marginLeft:6,fontFamily:"IBM Plex Mono"}}>{vTasks.length}</span>}
          </h1>
        </div>

        <div className="mw" style={{flex:1,overflowY:"auto",padding:"4px 14px 14px"}}>
          {renderMain()}
        </div>
      </main>

      {/* DETAIL PANEL — desktop */}
      {selTask && !isMob && (
        <div className="dpanel si" style={{width:340,flexShrink:0}}>
          <TaskDetail task={selTask} onUpdate={u=>upd(selTask.id,u)} onClose={()=>setSelId(null)} isMob={false}/>
        </div>
      )}

      {/* DETAIL — mobile overlay */}
      {selTask && isMob && (
        <TaskDetail task={selTask} onUpdate={u=>upd(selTask.id,u)} onClose={()=>setSelId(null)} isMob={true}/>
      )}

      {/* ADD MODAL */}
      {showAdd && <AddModal onClose={()=>setShowAdd(false)} onAdd={add}/>}

      {/* MOBILE FAB */}
      {!showAdd && isMob && !selTask && (
        <button onClick={()=>setShowAdd(true)} aria-label="Add new task" style={{position:"fixed",bottom:80,right:18,zIndex:200,width:52,height:52,borderRadius:"50%",border:"none",background:"#f59e0b",color:"#000",fontSize:24,cursor:"pointer",boxShadow:"0 4px 20px #f59e0b60",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>+</button>
      )}

      {/* MOBILE MORE TRAY */}
      {showMore && (
        <div onClick={()=>setShowMore(false)} role="dialog" aria-modal="true" aria-label="More navigation options"
          style={{position:"fixed",inset:0,zIndex:200,background:"#00000075"}}>
          <div className="st" onClick={e=>e.stopPropagation()}
            style={{position:"absolute",bottom:64,left:0,right:0,background:"#0d1420",borderTop:"1px solid #1e2842",borderRadius:"16px 16px 0 0",paddingBottom:8}}>
            <div style={{width:36,height:3,borderRadius:2,background:"#1e2842",margin:"10px auto 8px"}} role="presentation"/>
            <div style={{fontSize:9,color:"#7986b0",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.09em",padding:"4px 18px 10px"}}>More views</div>
            {MORE_NAV.map(item=>{
              const on=view===item.id;
              return (
                <button key={item.id} onClick={()=>{setView(item.id);setSelId(null);setShowMore(false);}}
                  aria-current={on?"page":undefined}
                  style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"12px 20px",background:on?"#0f1c38":"transparent",border:"none",borderLeft:on?"3px solid #f59e0b":"3px solid transparent",color:on?"#f59e0b":"#c8d0e8",cursor:"pointer",fontSize:14,fontFamily:"Bricolage Grotesque",fontWeight:on?600:400,textAlign:"left"}}>
                  <span style={{fontSize:20,width:26,textAlign:"center"}} aria-hidden="true">{item.e}</span>
                  {item.l}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MOBILE NAV */}
      <nav className="mobnav" aria-label="Primary mobile navigation" style={{position:"fixed",bottom:0,left:0,right:0,background:"#07090e",borderTop:"1px solid #141d35",padding:"6px 0 8px",justifyContent:"space-around",zIndex:100}}>
        {MOB_NAV.map(item=>{
          const on=view===item.id;
          const badge=item.id==="inbox"?inboxCt:item.id==="waiting"?waitCt:0;
          return (
            <button key={item.id} onClick={()=>{setView(item.id);setSelId(null);setShowMore(false);}}
              aria-current={on?"page":undefined}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"transparent",border:"none",position:"relative",color:on?"#f59e0b":"#7986b0",cursor:"pointer",padding:"3px 10px",fontSize:9,fontFamily:"IBM Plex Mono"}}>
              <span style={{fontSize:19}} aria-hidden="true">{item.e}</span>{item.l}
              {badge>0 && <span aria-label={`${badge} items`} style={{position:"absolute",top:-2,right:4,background:"#f59e0b",color:"#000",fontSize:8,fontWeight:700,borderRadius:8,padding:"0 4px"}}>{badge}</span>}
            </button>
          );
        })}
        <button onClick={()=>setShowMore(v=>!v)} aria-expanded={showMore} aria-controls="mob-more-tray" aria-haspopup="dialog"
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"transparent",border:"none",position:"relative",color:MORE_NAV.some(n=>n.id===view)?"#f59e0b":"#7986b0",cursor:"pointer",padding:"3px 10px",fontSize:9,fontFamily:"IBM Plex Mono"}}>
          <span style={{fontSize:19}} aria-hidden="true">⋯</span>More
          {MORE_NAV.some(n=>n.id===view) && <span style={{position:"absolute",top:2,right:6,width:5,height:5,borderRadius:"50%",background:"#f59e0b"}} aria-hidden="true"/>}
        </button>
      </nav>
    </div>
  );
}