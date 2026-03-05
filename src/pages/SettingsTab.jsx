import React, { useState } from 'react';
import InteractiveAPMap from '../components/InteractiveAPMap';
import { Wrench, Info, Download, AlertTriangle, Database, Loader2, CheckCircle, Shield, Activity, RefreshCw, List, AlertCircle } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

const SettingsTab = () => {
    const [repairStatus, setRepairStatus] = useState('idle'); // idle, running, completed, error
    const [repairStats, setRepairStats] = useState(null);
    const [dryRun, setDryRun] = useState(true);
    const [repairMessage, setRepairMessage] = useState('');

    const handleStartRepair = async () => {
        if (repairStatus === 'running') return;

        const confirmMsg = dryRun
            ? "Start a Dry Run? This will only scan and report issues without making any changes."
            : "WARNING: You are about to modify 3,000+ documents. This will fix shgIDs and voIDs across the system. Continue?";

        if (!window.confirm(confirmMsg)) return;

        setRepairStatus('running');
        setRepairMessage(dryRun ? 'Analyzing data integrity...' : 'Executing system-wide repair...');
        setRepairStats(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/conversion/repair-metadata?dryRun=${dryRun}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                setRepairStats(data.stats);
                setRepairStatus('completed');
                setRepairMessage(dryRun ? 'Dry run complete. Review the results below.' : 'Repair complete. All data points synchronized.');
            } else {
                throw new Error(data.message || 'Repair failed');
            }
        } catch (error) {
            console.error('Repair error:', error);
            setRepairStatus('error');
            setRepairMessage(error.message);
        }
    };

    const handleSingleRepair = async (targetId) => {
        if (!window.confirm("Fix this specific record? This will update shgID and payments immediately.")) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/conversion/repair-metadata?targetId=${targetId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                alert("Fixed successfully!");
                // Refresh the list to reflect changes (run dry run again)
                handleStartRepair();
            } else {
                alert("Repair failed: " + data.message);
            }
        } catch (error) {
            console.error('Single repair error:', error);
            alert("Error: " + error.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        Developer Portal
                    </h2>
                    <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-indigo-500" />
                        System Optimization & Calibration
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <InteractiveAPMap forceCalibration={true} />

                    {/* DATA REPAIR SECTION */}
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-rose-600 p-2.5 rounded-2xl shadow-lg">
                                    <Database className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Data Internal Repair Infrastructure</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Cross-Collection Identifier Synchronization</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                                <button
                                    onClick={() => setDryRun(true)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dryRun ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Dry Run
                                </button>
                                <button
                                    onClick={() => setDryRun(false)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!dryRun ? 'bg-rose-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Live Repair
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-emerald-500" />
                                        Safety Protocols
                                    </h4>
                                    <ul className="space-y-3">
                                        {[
                                            "Pads shgID to 18 digits across all collections.",
                                            "Ignores dummy data (test IDs shorter than 15 digits).",
                                            "Resolves null voIDs from authenticated User Profiles.",
                                            "Non-destructive: Performs in-place updates to preserve history."
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-gray-500 font-medium">
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="flex flex-col justify-center items-center p-6 bg-gray-50 rounded-3xl border border-gray-100 border-dashed">
                                    {repairStatus === 'idle' ? (
                                        <div className="text-center">
                                            <div className="flex justify-center mb-4">
                                                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                                                    <RefreshCw className="w-8 h-8 text-indigo-500" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 font-bold mb-6">Ready to initiate system scan.</p>
                                            <button
                                                onClick={handleStartRepair}
                                                className={`px-8 py-4 ${dryRun ? 'bg-indigo-600' : 'bg-rose-600'} text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:shadow-indigo-500/20 active:scale-95 transition-all`}
                                            >
                                                {dryRun ? 'Start Dry Run Scan' : 'Initiate Live Repair'}
                                            </button>
                                        </div>
                                    ) : repairStatus === 'running' ? (
                                        <div className="text-center">
                                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
                                            <h5 className="text-sm font-black text-gray-900 uppercase tracking-tight">{repairMessage}</h5>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-2 tracking-widest">Processing 3,000+ Documents...</p>
                                        </div>
                                    ) : (
                                        <div className="w-full space-y-4 text-center">
                                            <div className={`mx-auto p-3 rounded-2xl w-fit ${repairStatus === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                {repairStatus === 'completed' ? <CheckCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                                            </div>
                                            <h5 className="text-sm font-black text-gray-900 uppercase tracking-tight">{repairStatus === 'completed' ? 'Operation Finished' : 'Operation Failed'}</h5>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{repairMessage}</p>
                                            <button
                                                onClick={() => setRepairStatus('idle')}
                                                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                                            >
                                                Reset Infrastructure
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {repairStats && (
                                <div className="pt-8 border-t border-gray-100 space-y-8">
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                        {[
                                            { label: 'Scanned', val: repairStats.total_scanned, icon: Activity, color: 'text-gray-900' },
                                            { label: 'Queue Fixed', val: repairStats.queue_fixed, icon: Database, color: 'text-indigo-600' },
                                            { label: 'shgID Fixed', val: repairStats.shgID_fixed, icon: CheckCircle, color: 'text-emerald-600' },
                                            { label: 'Padded', val: repairStats.shgID_padded, icon: RefreshCw, color: 'text-amber-600' },
                                            { label: 'voID Fixed', val: repairStats.voID_fixed, icon: Shield, color: 'text-purple-600' },
                                            { label: 'Payments Patched', val: repairStats.resync_count, icon: Activity, color: 'text-rose-600' },
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <stat.icon className={`w-3 h-3 ${stat.color}`} />
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                                                </div>
                                                <div className={`text-xl font-black ${stat.color}`}>{stat.val}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* EXECUTION PLAN */}
                                    {repairStats.execution_plan && (
                                        <div className="space-y-4">
                                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                                                System Repair Strategy & Execution Flow
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {repairStats.execution_plan.map((step, idx) => (
                                                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-all">
                                                        <div className="absolute top-0 right-0 p-3 bg-indigo-50 text-indigo-400 font-black text-xs rounded-bl-2xl">
                                                            #{step.step}
                                                        </div>
                                                        <div className="flex flex-col h-full">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <Database className="w-4 h-4 text-indigo-600" />
                                                                <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight">{step.collection}</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                                                                {step.action}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* SAMPLES TABLE */}
                                    {repairStats.samples && repairStats.samples.length > 0 && (
                                        <div className="space-y-4">
                                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <List className="w-3.5 h-3.5 text-indigo-500" />
                                                Data Synchronization Samples (Verify Improvements)
                                            </h5>
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                <table className="w-full text-left text-[10px]">
                                                    <thead>
                                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                                            <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">SHG Name</th>
                                                            <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Type</th>
                                                            <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Current ID</th>
                                                            <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Corrected ID</th>
                                                            <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {repairStats.samples.map((sample, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-bold text-gray-900">{sample.name}</div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {sample.type === 'mismatch' ? (
                                                                        <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[8px] font-black uppercase tracking-wider border border-rose-100 italic">
                                                                            ID Mismatch
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[8px] font-black uppercase tracking-wider border border-blue-100">
                                                                            Padding Fix
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 font-mono text-rose-500 font-medium">{sample.before || 'EMPTY'}</td>
                                                                <td className="px-4 py-3 font-mono text-emerald-600 font-bold">{sample.after}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {dryRun && sample.id && (
                                                                        <button
                                                                            onClick={() => handleSingleRepair(sample.id)}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all font-black uppercase text-[9px] tracking-tight group-hover:scale-105"
                                                                        >
                                                                            <Wrench className="w-3 h-3" />
                                                                            Fix This
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {repairStats.errors && repairStats.errors.length > 0 && (
                                        <div className="mt-6 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                            <h5 className="text-[10px] font-black text-rose-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <AlertCircle className="w-3 h-3" />
                                                Exception Logs
                                            </h5>
                                            <div className="space-y-1">
                                                {repairStats.errors.map((err, i) => (
                                                    <p key={i} className="text-[10px] text-rose-600 font-medium font-mono">{err}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-indigo-900 text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                        <h3 className="text-xl font-black mb-4 flex items-center gap-2 relative z-10">
                            <Download className="w-5 h-5" />
                            How to Save Changes
                        </h3>
                        <div className="space-y-4 text-sm text-indigo-100 font-medium relative z-10">
                            <p>To persist map calibrations across all devices:</p>
                            <ol className="list-decimal list-inside space-y-3">
                                <li>Click the <span className="text-yellow-400 font-bold">Filter</span> icon on the map to enter Calibration Mode.</li>
                                <li>Select a district and click regions on the map.</li>
                                <li>Click <span className="text-yellow-400 font-bold">Download Mapping</span>.</li>
                                <li>Open <code className="bg-black/20 px-1.5 py-0.5 rounded text-white">src/data/map_calibration.json</code> in your editor.</li>
                                <li>Paste the downloaded contents and save the file.</li>
                            </ol>
                            <div className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/10 flex items-start gap-3">
                                <Info className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                                <p className="text-xs leading-relaxed">
                                    Replacing the JSON file ensures that your calibrations are baked into the application for all users.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-[32px] flex items-start gap-4">
                        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-amber-900 font-black text-sm uppercase tracking-tight">System Notice</h4>
                            <p className="text-amber-700 text-xs mt-1 font-medium leading-relaxed">
                                Calibration mode allows you to fix misaligned districts directly on the interactive map. Use this tool when the SVG boundaries don't match the analytical data.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsTab;
