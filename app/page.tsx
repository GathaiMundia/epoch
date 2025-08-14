// The file you are editing is: epoch/app/page.tsx

'use client'; 

import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { createClient, Session } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// Supabase Client Setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type for a single time entry
type TimeEntry = {
  id: number;
  created_at: string;
  date: string;
  activity: string;
  project: string;
  time_in: string;
  time_out: string;
  billable: string;
  hours_worked: number;
  user_id: string;
};

// ====================================================================
// COMPONENT 1: The Main Timesheet Application
// This component contains all the logic for your app AFTER a user logs in.
// ====================================================================
function TimesheetApp({ session }: { session: Session }) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [formData, setFormData] = useState({
    date: '',
    activity: '',
    project: '',
    time_in: '',
    time_out: '',
    billable: 'Billable',
  });

  useEffect(() => {
    const fetchEntries = async () => {
      if (!session) return;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) console.error('Error fetching entries:', error.message);
      else setTimeEntries(data);
    };
    fetchEntries();
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.date || !formData.activity || !formData.project || !formData.time_in || !formData.time_out) {
      alert('Please fill out all fields.');
      return;
    }
    const timeInDate = new Date(`1970-01-01T${formData.time_in}:00`);
    const timeOutDate = new Date(`1970-01-01T${formData.time_out}:00`);
    const hours_worked = (timeOutDate.getTime() - timeInDate.getTime()) / (1000 * 60 * 60);

    const { data: newEntry, error } = await supabase
      .from('time_entries')
      .insert({ ...formData, hours_worked: parseFloat(hours_worked.toFixed(2)), user_id: session.user.id })
      .select().single();

    if (error) console.error('Error adding entry:', error.message);
    else {
      setTimeEntries(prevEntries => [newEntry, ...prevEntries]);
      setFormData({ date: '', activity: '', project: '', time_in: '', time_out: '', billable: 'Billable' });
    }
  };
  
  const handleDelete = async (idToDelete: number) => {
    const { error } = await supabase.from('time_entries').delete().eq('id', idToDelete);
    if (error) console.error('Error deleting entry:', error.message);
    else setTimeEntries(prevEntries => prevEntries.filter(entry => entry.id !== idToDelete));
  };

  // --- NEW EXCEL EXPORT FUNCTION ---
  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Weekly Report');

    // 1. Add Title and merge cells
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ZIHI Insitute STAFF WEEKLY REPORT';
    titleCell.font = { name: 'Calibri', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    worksheet.getRow(1).height = 30;

    // 2. Add Staff Info (using logged-in user's email)
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = 'STAFF NAME:';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('C3').value = session.user.email; // Dynamic user email

    worksheet.mergeCells('F3:G3');
    worksheet.getCell('F3').value = 'WEEK ENDING:';
    worksheet.getCell('F3').font = { bold: true };
    worksheet.getCell('H3').value = new Date().toLocaleDateString(); // Dynamic date
    
    // 3. Add Main Column Headers
    const headerRow = worksheet.addRow([
        'Day',
        'Date',
        'Work/Activity done',
        'Project',
        'Time in',
        'Time out',
        'Hours worked on project',
        'Billable/Non-billable'
    ]);
    headerRow.height = 30;

    // Style the header row
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: {argb: 'FFFFFFFF'} };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284c7' } }; // Darker Sky Blue
    });
    
    // 4. Add the Data Rows from our app
    timeEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort entries by date
    .forEach(entry => {
        // Create a proper Date object, ensuring timezone consistency
        const dateParts = entry.date.split('-').map(part => parseInt(part, 10));
        const entryDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

        const day = entryDate.toLocaleDateString('en-US', { weekday: 'long' }); 
        
        const row = worksheet.addRow([
            day,
            entry.date,
            entry.activity,
            entry.project,
            entry.time_in,
            entry.time_out,
            entry.hours_worked,
            entry.billable
        ]);
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { vertical: 'top', wrapText: true };
        });
    });

    // Set column widths
    worksheet.getColumn('A').width = 15;
    worksheet.getColumn('B').width = 15;
    worksheet.getColumn('C').width = 50;
    worksheet.getColumn('D').width = 30;
    worksheet.getColumn('E').width = 12;
    worksheet.getColumn('F').width = 12;
    worksheet.getColumn('G').width = 20;
    worksheet.getColumn('H').width = 20;

    // --- File Generation ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `WeeklyReport-${session.user.email}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <div className="flex justify-between items-center">
            <div></div>
            <h1 className="text-4xl sm:text-5xl font-bold text-sky-400 tracking-widest uppercase">EPOCH</h1>
            <button onClick={() => supabase.auth.signOut()} className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Sign Out</button>
          </div>
          <p className="text-slate-400 mt-2">Log your activities. Forge your time.</p>
          <div className="mt-6"><button onClick={handleExport} className="bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">Export to Excel</button></div>
        </header>
        <section className="bg-slate-800 p-6 rounded-lg shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4 pb-3 border-b border-slate-600 text-sky-300">// New Time Entry</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label htmlFor="activity" className="block mb-1 font-medium text-slate-300">Work / Activity Done</label><textarea id="activity" name="activity" rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none" value={formData.activity} onChange={handleInputChange}></textarea></div>
            <div><label htmlFor="project" className="block mb-1 font-medium text-slate-300">Project</label><input type="text" id="project" name="project" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none" value={formData.project} onChange={handleInputChange} /></div>
            <div><label htmlFor="date" className="block mb-1 font-medium text-slate-300">Date</label><input type="date" id="date" name="date" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none" value={formData.date} onChange={handleInputChange} /></div>
            <div><label htmlFor="time_in" className="block mb-1 font-medium text-slate-300">Time In</label><input type="time" id="time_in" name="time_in" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none" value={formData.time_in} onChange={handleInputChange} /></div>
            <div><label htmlFor="time_out" className="block mb-1 font-medium text-slate-300">Time Out</label><input type="time" id="time_out" name="time_out" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none" value={formData.time_out} onChange={handleInputChange} /></div>
            <div className="sm:col-span-2"><label htmlFor="billable" className="block mb-1 font-medium text-slate-300">Category</label><select id="billable" name="billable" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none" value={formData.billable} onChange={handleInputChange}><option value="Billable">Billable</option><option value="Non-billable">Non-billable</option></select></div>
            <div className="sm:col-span-2 text-right"><button type="submit" className="bg-sky-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/20">Log Activity</button></div>
          </form>
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4 pb-3 border-b border-slate-600 text-sky-300">// Logged Activities</h2>
          <div className="flex flex-col gap-4">
            {timeEntries.map((entry) => (
              <div key={entry.id} className="bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-grow">
                  <div className="col-span-2"><strong className="text-slate-400">ACTIVITY:</strong> {entry.activity}</div>
                  <div><strong className="text-slate-400">PROJECT:</strong> {entry.project}</div>
                  <div><strong className="text-slate-400">HOURS:</strong> {entry.hours_worked}</div>
                  <div><strong className="text-slate-400">DATE:</strong> {entry.date}</div>
                  <div><strong className="text-slate-400">TIME:</strong> {entry.time_in} - {entry.time_out}</div>
                </div>
                <button onClick={() => handleDelete(entry.id)} className="bg-red-500 text-white font-bold py-2 px-4 rounded-md hover:bg-red-600 transition-colors self-end sm:self-center">Delete</button>
              </div>
            ))}
          </div>
        </section>
    </div>
  );
}


// ====================================================================
// COMPONENT 2: The Auth Gatekeeper
// This is the main component for the page. It decides whether to show
// the login form or the main app.
// ====================================================================
export default function AuthGatekeeper() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <main className="bg-slate-900 min-h-screen flex items-center justify-center">
        <p className="text-white text-xl">Initializing...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="bg-slate-900 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            theme="dark"
          />
        </div>
      </main>
    );
  } else {
    return (
      <main className="bg-slate-900 text-white min-h-screen p-4 sm:p-8">
        <TimesheetApp session={session} />
      </main>
    );
  }
}