import React from 'react';
import InteractiveAPMap from '../components/InteractiveAPMap';
import { Wrench, Info, Download, AlertTriangle } from 'lucide-react';

const SettingsTab = () => {
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
                <div className="xl:col-span-2">
                    <InteractiveAPMap forceCalibration={true} />
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
