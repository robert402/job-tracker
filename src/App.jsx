import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Clock, LayoutDashboard, Plus, Trash2, PoundSterling, UserPlus, Receipt, CalendarRange, Loader2, Edit2, Sparkles, Download, Lightbulb, FileText, CheckCircle, CheckSquare, RotateCcw, FilePlus, Lock, KeyRound, UserRound, TrendingUp } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// ============================================================================
// 👇 YOUR LIVE FIREBASE CLOUD DATABASE CONFIGURATION 👇
// ============================================================================
const MY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDdNjm6wGpgp3XjcGEAESYsN9bkZiUiSKI",
  authDomain: "build-tracker-3ab22.firebaseapp.com",
  projectId: "build-tracker-3ab22",
  storageBucket: "build-tracker-3ab22.firebasestorage.app",
  messagingSenderId: "790675108583",
  appId: "1:790675108583:web:2372932c0969fbcf66e842",
  measurementId: "G-V7R9MRW336"
};
// ============================================================================

// --- Tailwind CSS Injection for Local Mac Development ---
if (typeof window !== 'undefined' && !document.getElementById('tailwind-script')) {
  const script = document.createElement('script');
  script.id = 'tailwind-script';
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
}

// --- Firebase Initialization (Smart logic connects to either local or live) ---
const configStr = typeof __firebase_config !== 'undefined' && __firebase_config 
  ? __firebase_config 
  : (Object.keys(MY_FIREBASE_CONFIG).length > 0 ? JSON.stringify(MY_FIREBASE_CONFIG) : '{}');

const firebaseConfig = JSON.parse(configStr);
const isCloud = Object.keys(firebaseConfig).length > 0;

let app, auth, db;
if (isCloud) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init error", e);
  }
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'build-tracker-data';

// --- Gemini AI Setup ---
const apiKey = ""; 
const callGemini = async (prompt, systemInstruction = "You are a helpful assistant.") => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    } catch (err) {
      if (i === 4) throw new Error("Failed to reach AI after multiple attempts.");
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

// --- UK Date Formatter ---
const formatUKDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  const [staff, setStaff] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clientInvoices, setClientInvoices] = useState([]);
  const [extras, setExtras] = useState([]);
  const [completedJobInfo, setCompletedJobInfo] = useState(null);

  useEffect(() => {
    // If running locally without config, bypass auth to prevent a blank loading screen
    if (!isCloud || !auth) {
      setUser({ uid: 'local-macbook-user' });
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        setAuthError(error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isCloud || !db) return; // Skip trying to load from cloud if running locally

    const getCol = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);
    const unsubStaff = onSnapshot(getCol('staff'), (snap) => setStaff(snap.docs.map(d => d.data())));
    const unsubJobs = onSnapshot(getCol('jobs'), (snap) => setJobs(snap.docs.map(d => d.data())));
    const unsubLogs = onSnapshot(getCol('logs'), (snap) => setLogs(snap.docs.map(d => d.data())));
    const unsubInvoices = onSnapshot(getCol('invoices'), (snap) => setInvoices(snap.docs.map(d => d.data())));
    const unsubClientInvoices = onSnapshot(getCol('clientInvoices'), (snap) => setClientInvoices(snap.docs.map(d => d.data())));
    const unsubExtras = onSnapshot(getCol('extras'), (snap) => setExtras(snap.docs.map(d => d.data())));
    return () => { unsubStaff(); unsubJobs(); unsubLogs(); unsubInvoices(); unsubClientInvoices(); unsubExtras(); };
  }, [user]);

  // Safe write functions that use Local Memory if Firebase isn't connected
  const getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
  
  const addStaff = async (newStaff) => {
    if (!isCloud) setStaff(prev => [...prev.filter(s => s.id !== newStaff.id), newStaff]);
    else await setDoc(doc(getColRef('staff'), newStaff.id), newStaff);
  };
  const deleteStaff = async (id) => {
    if (!isCloud) setStaff(prev => prev.filter(s => s.id !== id));
    else await deleteDoc(doc(getColRef('staff'), id));
  };
  
  const addJob = async (newJob) => {
    if (!isCloud) setJobs(prev => [...prev.filter(j => j.id !== newJob.id), newJob]);
    else await setDoc(doc(getColRef('jobs'), newJob.id), newJob);
  };
  const deleteJob = async (id) => {
    if (!isCloud) setJobs(prev => prev.filter(j => j.id !== id));
    else await deleteDoc(doc(getColRef('jobs'), id));
  };
  
  const addLog = async (newLog) => {
    if (!isCloud) setLogs(prev => [...prev.filter(l => l.id !== newLog.id), newLog]);
    else await setDoc(doc(getColRef('logs'), newLog.id), newLog);
  };
  const deleteLog = async (id) => {
    if (!isCloud) setLogs(prev => prev.filter(l => l.id !== id));
    else await deleteDoc(doc(getColRef('logs'), id));
  };
  
  const addInvoice = async (newInvoice) => {
    if (!isCloud) setInvoices(prev => [...prev.filter(i => i.id !== newInvoice.id), newInvoice]);
    else await setDoc(doc(getColRef('invoices'), newInvoice.id), newInvoice);
  };
  const deleteInvoice = async (id) => {
    if (!isCloud) setInvoices(prev => prev.filter(i => i.id !== id));
    else await deleteDoc(doc(getColRef('invoices'), id));
  };

  const addClientInvoice = async (newInvoice) => {
    if (!isCloud) setClientInvoices(prev => [...prev.filter(i => i.id !== newInvoice.id), newInvoice]);
    else await setDoc(doc(getColRef('clientInvoices'), newInvoice.id), newInvoice);
  };
  const deleteClientInvoice = async (id) => {
    if (!isCloud) setClientInvoices(prev => prev.filter(i => i.id !== id));
    else await deleteDoc(doc(getColRef('clientInvoices'), id));
  };

  const addExtra = async (newExtra) => {
    if (!isCloud) setExtras(prev => [...prev.filter(e => e.id !== newExtra.id), newExtra]);
    else await setDoc(doc(getColRef('extras'), newExtra.id), newExtra);
  };
  const deleteExtra = async (id) => {
    if (!isCloud) setExtras(prev => prev.filter(e => e.id !== id));
    else await deleteDoc(doc(getColRef('extras'), id));
  };

  const getJobSummaries = () => {
    return jobs.map(job => {
      const jobLogs = logs.filter(log => log.jobId === job.id);
      const jobInvoices = invoices.filter(inv => inv.jobId === job.id);
      const billed = clientInvoices.filter(i => i.jobId === job.id).reduce((sum, i) => sum + i.amount, 0);
      const jobExtras = extras.filter(e => e.jobId === job.id).reduce((sum, e) => sum + e.amount, 0);

      const totalHours = jobLogs.reduce((sum, log) => sum + (parseFloat(log.hours) || 0), 0);
      const totalLaborCost = jobLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
      const totalLaborRevenue = jobLogs.reduce((sum, log) => sum + (log.revenue || 0), 0);
      const totalInvoiceCost = jobInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const totalCost = totalLaborCost + totalInvoiceCost;
      
      let expectedRevenue = job.billingType === 'Fixed' 
        ? ((job.tenderPrice || 0) + jobExtras) 
        : (totalLaborRevenue + totalInvoiceCost + jobExtras);

      return { 
        ...job, 
        totalHours, 
        totalLaborCost, 
        totalInvoiceCost, 
        totalCost, 
        expectedRevenue, 
        estimatedProfit: expectedRevenue - totalCost, 
        billed, 
        remaining: expectedRevenue - billed,
        extrasTotal: jobExtras 
      };
    });
  };

  const loadDemoData = () => {
    const demoStaff1 = { id: generateId(), name: 'John Smith', role: 'Foreman', costRate: 35, billableRate: 55 };
    const demoStaff2 = { id: generateId(), name: 'Sarah Jones', role: 'Electrician', costRate: 40, billableRate: 65 };
    const demoJob = { id: generateId(), name: '123 Main St Renovation', status: 'Active', billingType: 'Fixed', tenderPrice: 5000, startDate: '2026-05-15', completionDate: '2026-07-30' };
    
    addStaff(demoStaff1);
    addStaff(demoStaff2);
    addJob(demoJob);
  };

  const handleCompleteJob = async (jobSummary) => {
    const baseJob = jobs.find(j => j.id === jobSummary.id);
    if (baseJob) {
      await addJob({ ...baseJob, status: 'Completed' });
      setCompletedJobInfo(jobSummary);
    }
  };

  if (authError) return <div className="p-10 text-red-600">Error: {authError}</div>;
  if (!isAuthenticated) return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  if (!user) return <div className="p-10 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-2" />Connecting...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      <nav className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col md:min-h-screen shrink-0 shadow-xl">
        <div className="p-6 flex items-center gap-3 text-white">
          <Briefcase className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold">BuildTracker</h1>
        </div>
        <div className="flex md:flex-col gap-1 px-4 overflow-x-auto pb-4 md:pb-0">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'timesheets'} onClick={() => setActiveTab('timesheets')} icon={<CalendarRange size={20} />} label="Timesheets" />
          <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Clock size={20} />} label="Time Logs" />
          <NavItem active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} icon={<Receipt size={20} />} label="Sub Invoices" />
          <NavItem active={activeTab === 'clientBilling'} onClick={() => setActiveTab('clientBilling')} icon={<FileText size={20} />} label="Client Billing" />
          <NavItem active={activeTab === 'extras'} onClick={() => setActiveTab('extras')} icon={<FilePlus size={20} />} label="Job Extras" />
          <NavItem active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} icon={<Briefcase size={20} />} label="Active Jobs" />
          <NavItem active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} icon={<CheckSquare size={20} />} label="Completed Jobs" />
          <NavItem active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Users size={20} />} label="Staff & Rates" />
        </div>
      </nav>
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {jobs.length === 0 && staff.length === 0 && logs.length === 0 && invoices.length === 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-blue-800 text-lg">
                  {isCloud ? 'Live Cloud Database Connected!' : 'Welcome to your Local Workspace!'}
                </h3>
                <p className="text-blue-600">
                  {isCloud 
                    ? 'Your data is now permanently saved to Firebase. Add items manually or load demo data to start testing.' 
                    : 'You are currently running locally on your computer! Add Firebase credentials to save permanently.'}
                </p>
              </div>
              <button onClick={loadDemoData} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0 whitespace-nowrap">
                Load Demo Data
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && <Dashboard jobs={getJobSummaries()} logs={logs} />}
          {activeTab === 'timesheets' && <Timesheets logs={logs} staff={staff} jobs={jobs} invoices={invoices} />}
          {activeTab === 'logs' && <TimeLogs logs={logs} saveLog={addLog} jobs={jobs} staff={staff} deleteLog={deleteLog} />}
          {activeTab === 'invoices' && <SubcontractorInvoices invoices={invoices} addInvoice={addInvoice} jobs={jobs} deleteInvoice={deleteInvoice} />}
          {activeTab === 'clientBilling' && <ClientBilling clientInvoices={clientInvoices} addClientInvoice={addClientInvoice} jobs={getJobSummaries()} deleteClientInvoice={deleteClientInvoice} />}
          {activeTab === 'extras' && <JobExtras extras={extras} addExtra={addExtra} jobs={jobs} deleteExtra={deleteExtra} />}
          {activeTab === 'jobs' && <Jobs jobs={getJobSummaries()} addJob={addJob} deleteJob={deleteJob} completeJob={handleCompleteJob} />}
          {activeTab === 'completed' && <CompletedJobs jobs={getJobSummaries()} reactivateJob={(jobId) => {
            const baseJob = jobs.find(j => j.id === jobId);
            if (baseJob) addJob({ ...baseJob, status: 'Active' });
          }} />}
          {activeTab === 'staff' && <Staff staff={staff} saveStaff={addStaff} deleteStaff={deleteStaff} />}
        </div>
      </main>

      {completedJobInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in duration-200">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-3xl font-black mb-2 text-slate-800">Job Completed!</h2>
            <p className="text-slate-500 mb-8 text-lg">You've successfully wrapped up <strong>{completedJobInfo.name}</strong>.</p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8 text-left space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Billed:</span>
                <span className="font-bold text-blue-600 text-xl">£{completedJobInfo.billed?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Costs:</span>
                <span className="font-bold text-red-600 text-xl">£{completedJobInfo.totalCost?.toLocaleString() || 0}</span>
              </div>
              <div className="border-t border-slate-200 pt-4 flex justify-between items-center mt-2">
                <span className="font-black text-slate-800 text-xl">Final Profit:</span>
                <span className={`font-black text-3xl ${(completedJobInfo.billed || 0) - (completedJobInfo.totalCost || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  £{((completedJobInfo.billed || 0) - (completedJobInfo.totalCost || 0)).toLocaleString()}
                </span>
              </div>
            </div>
            
            <button onClick={() => setCompletedJobInfo(null)} className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg">
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${active ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
      {icon} <span className="font-medium">{label}</span>
    </button>
  );
}

function Dashboard({ jobs, logs }) {
  const [aiReport, setAiReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Calculate stats specifically for completed jobs
  const completedJobs = jobs.filter(j => j.status === 'Completed' && j.id !== 'HOLIDAY');
  const completedRevenue = completedJobs.reduce((sum, j) => sum + (j.billed || 0), 0);
  const completedCost = completedJobs.reduce((sum, j) => sum + (j.totalCost || 0), 0);
  const completedProfit = completedRevenue - completedCost;
  const completedMargin = completedRevenue > 0 ? ((completedProfit / completedRevenue) * 100).toFixed(1) : 0;

  // Keep holiday pay calculation for the AI report logic
  const holidayLogs = logs.filter(l => l.jobId === 'HOLIDAY');
  const totalHolidayCost = holidayLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Analyze this construction business data: ${JSON.stringify(jobs)}. Total Holiday Pay: £${totalHolidayCost}. Summarize business health in 2 paragraphs.`;
      const report = await callGemini(prompt, "You are a business analyst.");
      setAiReport(report);
    } catch (e) { setAiReport("Error generating AI report. Ensure your API key is set."); }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <button onClick={handleGenerateReport} disabled={isGenerating} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} AI Report
        </button>
      </div>
      {aiReport && <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-sm text-purple-900">{aiReport}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatBox label="Completed Revenue" value={`£${completedRevenue.toLocaleString()}`} icon={<Briefcase size={32} />} color="purple" subtitle={`${completedJobs.length} completed jobs`} />
        <StatBox label="Completed Profit" value={`£${completedProfit.toLocaleString()}`} icon={<PoundSterling size={32} />} color={completedProfit >= 0 ? 'green' : 'red'} />
        <StatBox label="Total Profit Margin" value={`${completedMargin}%`} icon={<TrendingUp size={32} />} color={completedMargin >= 0 ? 'emerald' : 'red'} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Active Job Financial Overview</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 uppercase border-b">
              <tr>
                <th className="px-6 py-3">Job Name</th>
                <th className="px-6 py-3">Contract Price</th>
                <th className="px-6 py-3 text-red-600">Total Cost (So Far)</th>
                <th className="px-6 py-3 text-blue-600">Billed to Client</th>
                <th className="px-6 py-3 text-green-600">Remaining to Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.filter(j => j.id !== 'HOLIDAY' && j.status !== 'Completed').map(j => (
                <tr key={j.id}>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {j.name} <span className="text-xs text-slate-400 font-normal ml-2 px-2 py-0.5 bg-slate-100 rounded-full">{j.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold">£{j.expectedRevenue.toLocaleString()}</div>
                    {j.extrasTotal > 0 && <div className="text-xs text-purple-600 mt-0.5">+ £{j.extrasTotal.toLocaleString()} in Extras</div>}
                  </td>
                  <td className="px-6 py-4 font-bold text-red-600">£{j.totalCost.toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-blue-600">£{j.billed.toLocaleString()}</td>
                  <td className={`px-6 py-4 font-bold ${j.remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {j.remaining < 0 ? `Overbilled: £${Math.abs(j.remaining).toLocaleString()}` : `£${j.remaining.toLocaleString()}`}
                  </td>
                </tr>
              ))}
              {jobs.filter(j => j.id !== 'HOLIDAY' && j.status !== 'Completed').length === 0 && (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No active jobs available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color, subtitle }) {
  const colors = { purple: 'bg-purple-100 text-purple-600', blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', red: 'bg-red-100 text-red-600', emerald: 'bg-emerald-100 text-emerald-600' };
  
  return (
    <div className="relative group bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex items-center gap-6 hover:bg-slate-50 transition-colors cursor-default">
      <div className={`p-4 rounded-xl shrink-0 ${colors[color]}`}>{icon}</div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-base text-slate-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold truncate mt-1">{value}</p>
        {subtitle && <p className="text-sm text-slate-400 truncate mt-1">{subtitle}</p>}
      </div>

      {/* Instant Custom Tooltip that pops up on hover */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-max max-w-xs bg-slate-900 text-white p-4 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none text-center">
        <p className="font-medium text-slate-300">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1 whitespace-normal break-words">{subtitle}</p>}
        {/* Tooltip bottom arrow triangle */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
      </div>
    </div>
  );
}

function Timesheets({ logs, staff, jobs, invoices }) {
  const [viewType, setViewType] = useState('staff');
  const [selectedId, setSelectedId] = useState('');
  const [baseDate, setBaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [aiInsights, setAiInsights] = useState('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const getMonday = (dStr) => { const d = new Date(dStr); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); };
  const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; };
  const mondayDate = getMonday(baseDate);
  const weekDates = Array.from({ length: 7 }).map((_, i) => addDays(mondayDate, i));
  const weekHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const filteredLogs = logs.filter(l => (l.date >= weekDates[0] && l.date <= weekDates[6]) && (viewType === 'staff' ? l.staffId === selectedId : l.jobId === selectedId));
  
  // Filter invoices only if viewing a job, and only for this week
  const filteredInvoices = (viewType === 'job' && selectedId && invoices) 
    ? invoices.filter(i => i.jobId === selectedId && i.date >= weekDates[0] && i.date <= weekDates[6]) 
    : [];

  let matrix = {};
  let totalWeekHours = 0;
  let totalWeekLaborCost = 0;
  
  if (selectedId) {
    filteredLogs.forEach(l => {
      const rowKey = viewType === 'staff' ? l.jobId : l.staffId;
      if (!matrix[rowKey]) matrix[rowKey] = { name: viewType === 'staff' ? (l.jobId === 'HOLIDAY' ? '🌟 Holiday' : jobs.find(j => j.id === l.jobId)?.name) : staff.find(s => s.id === l.staffId)?.name, days: [0,0,0,0,0,0,0], totalHrs: 0, totalCost: 0 };
      const idx = weekDates.indexOf(l.date);
      if (idx !== -1) { matrix[rowKey].days[idx] += l.hours; matrix[rowKey].totalHrs += l.hours; matrix[rowKey].totalCost += l.cost; totalWeekHours += l.hours; totalWeekLaborCost += l.cost; }
    });
  }

  const totalSubCost = filteredInvoices.reduce((sum, i) => sum + i.amount, 0);
  const totalWeekCost = totalWeekLaborCost + totalSubCost;

  const exportToCSV = () => {
    const csv = [["Entity", ...weekHeaders, "Total", "Cost"].join(","), ...Object.values(matrix).map(r => [`"${r.name}"`, ...r.days, r.totalHrs, r.totalCost].join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'timesheet.csv'; link.click();
  };

  const handleGetInsights = async () => {
    setIsGeneratingInsights(true);
    setAiInsights('');
    try {
      const entityName = viewType === 'staff' 
        ? staff.find(s => s.id === selectedId)?.name 
        : jobs.find(j => j.id === selectedId)?.name;
      
      const prompt = `Review this weekly timesheet for ${viewType} "${entityName}". 
      Total hours this week: ${totalWeekHours}. Total labor cost: £${totalWeekLaborCost}. Total subcontractor cost: £${totalSubCost}. 
      Daily Labor Matrix data: ${JSON.stringify(matrix)}. 
      ${filteredInvoices.length > 0 ? `Subcontractor Invoices this week: ${JSON.stringify(filteredInvoices)}` : ''}
      Act as a smart site manager. Give 2-3 brief bullet points of insights. Point out any long days/overtime risks, expensive shifts, high sub costs, or general productivity observations. Do not use markdown asterisks.`;
      
      const result = await callGemini(prompt, "You are a smart payroll and construction site manager.");
      setAiInsights(result);
    } catch (e) {
      setAiInsights("Failed to generate insights. Check API connection.");
    }
    setIsGeneratingInsights(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <select value={viewType} onChange={e => {setViewType(e.target.value); setSelectedId('');}} className="p-2 border rounded bg-white"><option value="staff">Staff</option><option value="job">Job</option></select>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="p-2 border rounded bg-white flex-1">{viewType === 'staff' ? staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>) : <><option value="HOLIDAY">🌟 Holiday</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</>}</select>
        <input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} className="p-2 border rounded" />
      </div>
      {selectedId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">Week of {formatUKDate(weekDates[0])} • Total Week Cost: £{totalWeekCost.toLocaleString()}</div>
              {viewType === 'job' && <div className="text-xs text-slate-500 mt-0.5">Labor: £{totalWeekLaborCost.toLocaleString()} | Subcontractors: £{totalSubCost.toLocaleString()}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleGetInsights} disabled={isGeneratingInsights || Object.keys(matrix).length === 0} className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded font-bold flex items-center gap-1 transition-colors">
                {isGeneratingInsights ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} 
                {isGeneratingInsights ? 'Analyzing...' : 'Get Insights ✨'}
              </button>
              <button onClick={exportToCSV} className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          {aiInsights && (
            <div className="p-4 bg-purple-50 border-b border-purple-100 flex gap-3 items-start">
              <Sparkles className="text-purple-500 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-purple-900 whitespace-pre-wrap">{aiInsights}</div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="px-6 py-3">Row</th>{weekHeaders.map(h=><th key={h} className="px-4 py-3">{h}</th>)}<th className="px-6 py-3">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.keys(matrix).map(k => (
                  <tr key={k}><td className="px-6 py-4 font-medium">{matrix[k].name}</td>{matrix[k].days.map((d,i)=><td key={i} className="px-4 py-4">{d || '-'}</td>)}<td className="px-6 py-4 font-bold">{matrix[k].totalHrs}</td></tr>
                ))}
                {Object.keys(matrix).length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-400">No labor logged for this week.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length > 0 && (
            <div className="border-t border-slate-200 bg-white p-4">
              <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2">
                <Receipt size={16} className="text-slate-400" />
                Subcontractor Invoices (This Week)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Vendor</th><th className="px-4 py-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map(i => (
                      <tr key={i.id}>
                        <td className="px-4 py-2">{formatUKDate(i.date)}</td>
                        <td className="px-4 py-2 font-medium">{i.vendor}</td>
                        <td className="px-4 py-2 text-right font-bold text-red-600">£{i.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimeLogs({ logs, saveLog, jobs, staff, deleteLog }) {
  const [editingId, setEditingId] = useState(null);
  const [logType, setLogType] = useState('Work');
  const [jobId, setJobId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    const selStaff = staff.find(s => s.id === staffId);
    if (!selStaff) return;
    const cost = selStaff.costRate * parseFloat(hours);
    const rev = logType === 'Holiday' ? 0 : (selStaff.billableRate * parseFloat(hours));
    saveLog({ id: editingId || generateId(), jobId: logType === 'Holiday' ? 'HOLIDAY' : jobId, staffId, date, hours: parseFloat(hours), cost, revenue: rev, description });
    setEditingId(null); setJobId(''); setStaffId(''); setHours(''); setLogType('Work'); setDescription('');
  };

  const startEdit = (l) => {
    setEditingId(l.id); setLogType(l.jobId === 'HOLIDAY' ? 'Holiday' : 'Work'); setJobId(l.jobId === 'HOLIDAY' ? '' : l.jobId);
    setStaffId(l.staffId); setHours(l.hours); setDate(l.date); setDescription(l.description);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 border rounded" />
          <select value={logType} onChange={e => {setLogType(e.target.value); if(e.target.value==='Holiday') setJobId('');}} className="p-2 border rounded bg-white">
            <option value="Work">Work</option>
            <option value="Holiday">Holiday</option>
          </select>
          {logType === 'Work' && <select value={jobId} onChange={e => setJobId(e.target.value)} className="p-2 border rounded bg-white" required><option value="">Select Job</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select>}
          <select value={staffId} onChange={e => setStaffId(e.target.value)} className="p-2 border rounded bg-white" required><option value="">Select Staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="Hours" className="p-2 border rounded" required />
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="md:col-span-2 p-2 border rounded" />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded">{editingId ? 'Update' : 'Add Log'}</button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Staff/Job</th><th className="px-6 py-3">Hours</th><th className="px-6 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map(l => (
                <tr key={l.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{formatUKDate(l.date)}</td>
                  <td className="px-6 py-4">{staff.find(s=>s.id===l.staffId)?.name} <div className="text-xs text-slate-400">{l.jobId==='HOLIDAY'?'🌟 Holiday':jobs.find(j=>j.id===l.jobId)?.name}</div></td>
                  <td className="px-6 py-4 font-bold">{l.hours}</td>
                  <td className="px-6 py-4 flex justify-end gap-2"><button onClick={() => startEdit(l)} className="text-blue-600 bg-blue-50 p-1.5 rounded-md border border-blue-100"><Edit2 size={14} /></button><button onClick={() => deleteLog(l.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SubcontractorInvoices({ invoices, addInvoice, jobs, deleteInvoice }) {
  const [editingId, setEditingId] = useState(null);
  const [jobId, setJobId] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = (e) => {
    e.preventDefault();
    addInvoice({ id: editingId || generateId(), jobId, vendor, date, amount: parseFloat(amount) });
    setEditingId(null); setJobId(''); setVendor(''); setAmount('');
  };

  const startEdit = (v) => { setEditingId(v.id); setJobId(v.jobId); setVendor(v.vendor); setAmount(v.amount); setDate(v.date); };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select value={jobId} onChange={e => setJobId(e.target.value)} className="p-2 border rounded bg-white" required><option value="">Select Job</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select>
          <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Subcontractor" className="p-2 border rounded" required />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount £" className="p-2 border rounded" required />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded">{editingId ? 'Update' : 'Add Invoice'}</button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr><th className="px-6 py-3">Vendor</th><th className="px-6 py-3">Job</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.map(v => (
                <tr key={v.id}>
                  <td className="px-6 py-4 font-medium">{v.vendor}</td>
                  <td className="px-6 py-4">{jobs.find(j=>j.id===v.jobId)?.name}</td>
                  <td className="px-6 py-4 font-bold text-red-600">£{v.amount}</td>
                  <td className="px-6 py-4 flex justify-end gap-2"><button onClick={() => startEdit(v)} className="text-blue-600 bg-blue-50 p-1.5 rounded-md border border-blue-100"><Edit2 size={14} /></button><button onClick={() => deleteInvoice(v.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClientBilling({ clientInvoices, addClientInvoice, jobs, deleteClientInvoice }) {
  const [editingId, setEditingId] = useState(null);
  const [jobId, setJobId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = (e) => {
    e.preventDefault();
    addClientInvoice({ id: editingId || generateId(), jobId, invoiceRef, date, amount: parseFloat(amount) });
    setEditingId(null); setJobId(''); setInvoiceRef(''); setAmount('');
  };

  const startEdit = (i) => { setEditingId(i.id); setJobId(i.jobId); setInvoiceRef(i.invoiceRef); setAmount(i.amount); setDate(i.date); };

  const jobSummaries = jobs.map(job => {
    const billed = job.billed !== undefined ? job.billed : clientInvoices.filter(i => i.jobId === job.id).reduce((sum, i) => sum + i.amount, 0);
    const expectedRevenue = job.expectedRevenue !== undefined ? job.expectedRevenue : (job.tenderPrice || 0);
    return {
      ...job,
      billed,
      expectedRevenue,
      remaining: expectedRevenue - billed,
      percent: expectedRevenue ? Math.min(100, Math.max(0, Math.round((billed / expectedRevenue) * 100))) : 0
    };
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
        <h3 className="font-bold mb-4">{editingId ? 'Edit Client Invoice' : 'Log Invoice Sent to Client'}</h3>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select value={jobId} onChange={e => setJobId(e.target.value)} className="p-2 border rounded bg-white" required><option value="">Select Job</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select>
          <input type="text" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="Invoice Ref (e.g. INV-001)" className="p-2 border rounded" required />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount Billed £" className="p-2 border rounded" required />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded">{editingId ? 'Update' : 'Log Invoice'}</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Job Billing Summary</div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 uppercase border-b">
                <tr><th className="px-6 py-3">Job & Tender</th><th className="px-6 py-3 text-right">Billed / Remaining</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobSummaries.map(j => (
                  <tr key={j.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{j.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Contract Value: £{j.expectedRevenue.toLocaleString()} {j.extrasTotal > 0 && `(Inc. £${j.extrasTotal.toLocaleString()} Extras)`}</div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                        <div className={`h-1.5 rounded-full ${j.percent >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${j.percent}%` }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-slate-800">£{j.billed}</div>
                      <div className={`text-xs mt-0.5 ${j.remaining < 0 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>{j.remaining < 0 ? 'Overbilled' : 'Remaining'}: £{Math.abs(j.remaining)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Recent Client Invoices</div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 uppercase border-b">
                <tr><th className="px-6 py-3">Ref & Job</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {clientInvoices.map(i => (
                  <tr key={i.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{i.invoiceRef}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{jobs.find(j=>j.id===i.jobId)?.name}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-600">£{i.amount}</td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => startEdit(i)} className="text-blue-600 bg-blue-50 p-1.5 rounded-md border border-blue-100"><Edit2 size={14} /></button>
                      <button onClick={() => deleteClientInvoice(i.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {clientInvoices.length === 0 && (
                  <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-400">No invoices logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Jobs({ jobs, addJob, deleteJob, completeJob }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('');
  const [tenderPrice, setTenderPrice] = useState('');
  const [billingType, setBillingType] = useState('Fixed');
  const [status, setStatus] = useState('Active');
  const [isDraftingScope, setIsDraftingScope] = useState(false);

  const handleDraftScope = async () => {
    if (!name) return;
    setIsDraftingScope(true);
    try {
      const prompt = `Write a professional, concise scope of work (2-3 sentences) for a construction project titled: "${name}". Make it sound professional for a client contract or proposal.`;
      const result = await callGemini(prompt, "You are a professional construction estimator and planner.");
      setScope(result.replace(/["']/g, '').trim());
    } catch(e) {
      console.error(e);
    }
    setIsDraftingScope(false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    addJob({ id: editingId || generateId(), name, scope, tenderPrice: parseFloat(tenderPrice) || 0, billingType, status });
    setEditingId(null); setName(''); setScope(''); setTenderPrice(''); setBillingType('Fixed'); setStatus('Active');
  };

  const startEdit = (j) => {
    setEditingId(j.id); setName(j.name); setScope(j.scope || ''); setTenderPrice(j.tenderPrice); setBillingType(j.billingType); setStatus(j.status);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
        <h3 className="font-bold mb-4">{editingId ? 'Edit Job' : 'Add Job'}</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Job Name" className="w-full p-2 border rounded" required />
          
          <div className="space-y-1">
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium text-slate-600">Scope of Work</label>
              <button 
                type="button" 
                onClick={handleDraftScope}
                disabled={isDraftingScope || !name}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 disabled:text-slate-400 flex items-center gap-1 transition-colors"
                title="Use AI to generate a scope based on the job name"
              >
                {isDraftingScope ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isDraftingScope ? 'Drafting...' : 'Auto-Draft Scope ✨'}
              </button>
            </div>
            <textarea value={scope} onChange={e => setScope(e.target.value)} placeholder="Description of works..." rows={3} className="w-full p-2 border rounded resize-none" />
          </div>

          <select value={billingType} onChange={e => setBillingType(e.target.value)} className="w-full p-2 border rounded bg-white">
            <option value="Fixed">Fixed Price</option>
            <option value="Hourly">Hourly Rate</option>
          </select>
          {billingType === 'Fixed' && <input type="number" value={tenderPrice} onChange={e => setTenderPrice(e.target.value)} placeholder="Tender Price £" className="w-full p-2 border rounded" required />}
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border rounded bg-white">
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">{editingId ? 'Update' : 'Save'}</button>
        </form>
      </div>
      <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3">Job Name</th>
                <th className="px-6 py-3">Price / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map(j => (
                <tr key={j.id}>
                  <td className="px-6 py-4 font-medium">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        {j.name}
                        {j.scope && <div className="text-xs text-slate-500 mt-1 font-normal max-w-sm whitespace-pre-wrap">{j.scope}</div>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {j.status !== 'Completed' && (
                          <button onClick={() => completeJob(j)} className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-md flex items-center gap-1 border border-emerald-100 text-xs font-bold hover:bg-emerald-100 transition-colors">
                            <CheckCircle size={12} /> Complete
                          </button>
                        )}
                        <button onClick={() => startEdit(j)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md flex items-center gap-1 border border-blue-100 text-xs font-bold"><Edit2 size={12} /> Edit</button>
                        <button onClick={() => deleteJob(j.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-800 font-bold">£{j.tenderPrice || 0}</div>
                    <div className={`text-xs ${j.status === 'Completed' ? 'text-green-600 font-bold' : 'text-slate-500'}`}>{j.status} • {j.billingType}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompletedJobs({ jobs, reactivateJob }) {
  const completedJobs = jobs.filter(j => j.status === 'Completed' && j.id !== 'HOLIDAY');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Completed Jobs</h2>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase border-b">
              <tr>
                <th className="px-6 py-3">Job Name</th>
                <th className="px-6 py-3">Final Billed</th>
                <th className="px-6 py-3">Total Cost</th>
                <th className="px-6 py-3">Final Profit</th>
                <th className="px-6 py-3">Profit Margin</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {completedJobs.map(j => {
                const profit = (j.billed || 0) - (j.totalCost || 0);
                const margin = j.billed > 0 ? ((profit / j.billed) * 100).toFixed(1) : 0;
                return (
                  <tr key={j.id}>
                    <td className="px-6 py-4 font-medium text-slate-800">{j.name}</td>
                    <td className="px-6 py-4 font-bold text-blue-600">£{(j.billed || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-red-600">£{(j.totalCost || 0).toLocaleString()}</td>
                    <td className={`px-6 py-4 font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      £{profit.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {margin}%
                    </td>
                    <td className="px-6 py-4 flex justify-end">
                      <button onClick={() => reactivateJob(j.id)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md flex items-center gap-1 border border-blue-100 text-xs font-bold hover:bg-blue-100 transition-colors">
                        <RotateCcw size={12} /> Reactivate
                      </button>
                    </td>
                  </tr>
                );
              })}
              {completedJobs.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">No completed jobs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Staff({ staff, saveStaff, deleteStaff }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [costRate, setCostRate] = useState('');
  const [billableRate, setBillableRate] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    saveStaff({ id: editingId || generateId(), name, role, costRate: parseFloat(costRate), billableRate: parseFloat(billableRate) });
    setEditingId(null); setName(''); setRole(''); setCostRate(''); setBillableRate('');
  };

  const startEdit = (s) => {
    setEditingId(s.id); setName(s.name); setRole(s.role); setCostRate(s.costRate); setBillableRate(s.billableRate);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
        <h3 className="font-bold mb-4">{editingId ? 'Edit Staff' : 'Add Staff'}</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="w-full p-2 border rounded" required />
          <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="Role" className="w-full p-2 border rounded" />
          <input type="number" value={costRate} onChange={e => setCostRate(e.target.value)} placeholder="Cost Rate £" className="w-full p-2 border rounded" required />
          <input type="number" value={billableRate} onChange={e => setBillableRate(e.target.value)} placeholder="Billable Rate £" className="w-full p-2 border rounded" required />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">{editingId ? 'Update' : 'Save'}</button>
        </form>
      </div>
      <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Cost/Bill</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staff.map(s => (
                <tr key={s.id}>
                  <td className="px-6 py-4 font-medium">{s.name} <div className="text-xs text-slate-400 font-normal">{s.role}</div></td>
                  <td className="px-6 py-4 text-slate-600">£{s.costRate} / £{s.billableRate}</td>
                  <td className="px-6 py-4 flex justify-end gap-2">
                    <button onClick={() => startEdit(s)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md flex items-center gap-1 border border-blue-100"><Edit2 size={14} /> Edit</button>
                    <button onClick={() => deleteStaff(s.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function JobExtras({ extras, addExtra, jobs, deleteExtra }) {
  const [editingId, setEditingId] = useState(null);
  const [jobId, setJobId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = (e) => {
    e.preventDefault();
    addExtra({ id: editingId || generateId(), jobId, description, date, amount: parseFloat(amount) });
    setEditingId(null); setJobId(''); setDescription(''); setAmount('');
  };

  const startEdit = (x) => { setEditingId(x.id); setJobId(x.jobId); setDescription(x.description); setAmount(x.amount); setDate(x.date); };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
        <h3 className="font-bold mb-4 text-purple-700 flex items-center gap-2">
          <FilePlus size={18} /> {editingId ? 'Edit Extra/Variation' : 'Log a Job Extra'}
        </h3>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select value={jobId} onChange={e => setJobId(e.target.value)} className="p-2 border rounded bg-white" required>
            <option value="">Select Job</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description of Extra works" className="p-2 border rounded md:col-span-2" required />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Price Charged £" className="p-2 border rounded" required />
          <button type="submit" className="bg-purple-600 text-white p-2 rounded md:col-span-4 hover:bg-purple-700 transition-colors font-bold">
            {editingId ? 'Update Extra' : 'Add Extra to Job'}
          </button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase border-b">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Job</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {extras.map(x => (
                <tr key={x.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">{formatUKDate(x.date)}</td>
                  <td className="px-6 py-4 font-medium">{jobs.find(j => j.id === x.jobId)?.name}</td>
                  <td className="px-6 py-4">{x.description}</td>
                  <td className="px-6 py-4 font-bold text-purple-600">+£{x.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 flex justify-end gap-2">
                    <button onClick={() => startEdit(x)} className="text-blue-600 bg-blue-50 p-1.5 rounded-md border border-blue-100"><Edit2 size={14} /></button>
                    <button onClick={() => deleteExtra(x.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {extras.length === 0 && <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No extras logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // CHANGE YOUR USERNAME AND PASSWORD HERE!
    const correctUsername = 'admin';
    const correctPassword = 'build123';

    if (username.toLowerCase() === correctUsername && password === correctPassword) {
      onLogin();
    } else {
      setError('Invalid username or password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">BuildTracker</h1>
          <p className="text-slate-400 mt-2 text-sm">Please sign in to access your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 font-medium">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 ml-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserRound size={18} />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound size={18} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold text-lg py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg mt-4"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}