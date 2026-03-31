import React, { useMemo } from 'react';

/**
 * SHG Page 2 (Financial Ledger) — FINAL High-Fidelity Reconstruction
 * Replicates the physical table scan exactly with hardcoded Telugu titles
 * to ensure accuracy even if OCR misses labels.
 */

const RowHeaderCell = ({ text, colSpan = 1, rowSpan = 1, center = false, bold = true, small = false }) => (
    <td
        colSpan={colSpan}
        rowSpan={rowSpan}
        className={`border border-black px-2 py-1.5 align-middle bg-gray-50/50 ${center ? 'text-center' : 'text-left'} ${bold ? 'font-bold text-gray-900' : 'font-normal text-gray-700'} ${small ? 'text-[10px]' : 'text-[11.5px]'}`}
    >
        {text}
    </td>
);

const DataValueCell = ({ id, idMap, isEditing, onEdit, colSpan = 1, rowSpan = 1, center = true, bold = true }) => {
    const cellId = `cell_${id}`;
    const cell = idMap[cellId] || {};
    const text = cell.text || '';
    const conf = cell.confidence || 0;
    const isEmpty = !text.trim();

    return (
        <td
            colSpan={colSpan}
            rowSpan={rowSpan}
            className={`border border-black px-2 py-1.5 align-middle min-w-[60px] ${center ? 'text-right' : 'text-left'} text-[13px] font-mono font-black text-indigo-900 bg-white group transition-colors hover:bg-indigo-50/30`}
        >
            {isEditing ? (
                <input
                    type="text"
                    value={text}
                    onChange={(e) => onEdit(id, e.target.value)}
                    className="w-full bg-indigo-50/50 border border-transparent focus:border-indigo-400 text-right font-black px-1 py-0.5 outline-none rounded"
                />
            ) : (
                <div className="flex items-center justify-between gap-1">
                    <span className={isEmpty ? 'opacity-20 italic' : ''}>{isEmpty ? '—' : text}</span>
                    {!isEmpty && (
                        <div
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf >= 0.8 ? 'bg-emerald-500' : conf >= 0.5 ? 'bg-amber-400' : 'bg-red-500'}`}
                            title={`OCR: ${(conf * 100).toFixed(0)}%`}
                        />
                    )}
                </div>
            )}
        </td>
    );
};

export default function SHGPage2View({ tableData, isEditing, onCellEdit }) {
    const idMap = useMemo(() => {
        const map = {};
        (tableData?.data_rows || []).forEach(row => {
            (row.cells || []).forEach(cell => {
                if (cell.debug_id != null) map[cell.debug_id] = { text: cell.text || '', confidence: cell.confidence || 0 };
            });
        });
        return map;
    }, [tableData]);

    const handleEdit = (id, val) => onCellEdit?.(id, val);

    return (
        <div className="flex flex-col items-center bg-gray-100 p-4 sm:p-10 min-h-screen">
            {/* Simulation of a Physical Ledger Page */}
            <div className="bg-white shadow-2xl p-[0.3in] border-t-8 border-indigo-600 w-full max-w-[1200px] border border-gray-300">

                <table className="w-full border-collapse border-2 border-black">
                    <tbody>
                        {/* R1: MAIN TITLES */}
                        <tr>
                            <RowHeaderCell text="సంఘం స్థాయిలో జరిగిన ఆర్థిక లావాదేవీలు" colSpan={4} center bold />
                            <RowHeaderCell text="గత నెల (.........................) బ్యాంక్ నిల్వలు" colSpan={6} center bold />
                        </tr>

                        {/* R2: TABLE HEADERS */}
                        <tr>
                            <RowHeaderCell text="సంఘానికి వచ్చిన వివరములు" small />
                            <RowHeaderCell text="మొత్తం రూ." center small />
                            <RowHeaderCell text="సంఘం చెల్లించిన వివరములు" small />
                            <RowHeaderCell text="మొత్తం రూ." center small />
                            <RowHeaderCell text="ఖాతా వివరము" small />
                            <RowHeaderCell text="తేది నాటికి" center small />
                            <RowHeaderCell text="రూ." center colSpan={4} small />
                        </tr>

                        {/* R3 */}
                        <tr>
                            <RowHeaderCell text="సంఘానికి వచ్చిన పొదుపు మొత్తం" />
                            <DataValueCell id={10} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="సంఘం పెట్టుబడులు" />
                            <DataValueCell id={12} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="చేతి నిల్వ" />
                            <DataValueCell id={14} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <DataValueCell id={15} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} colSpan={4} />
                        </tr>

                        {/* R4 */}
                        <tr>
                            <RowHeaderCell text="పొదుపులు (SN+VO+Other Saving)" />
                            <DataValueCell id={17} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="VO లో కట్టిన వడ్డీ ధనం" />
                            <DataValueCell id={19} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="పొదుపు ఖాతా" />
                            <DataValueCell id={21} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <DataValueCell id={22} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} colSpan={4} />
                        </tr>

                        {/* R5 */}
                        <tr>
                            <RowHeaderCell text="సంఘానికి వచ్చిన ఫండ్స్" />
                            <DataValueCell id={24} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="VO లో కట్టిన పొదుపు" />
                            <DataValueCell id={26} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="బ్యాంక్ లోన్ ఖాతా" />
                            <DataValueCell id={28} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <DataValueCell id={29} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} colSpan={4} />
                        </tr>

                        {/* R6 */}
                        <tr>
                            <RowHeaderCell text="రివాల్వింగ్ ఫండ్" />
                            <DataValueCell id={31} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="శ్రీనిధి లో కట్టిన పొదుపు" />
                            <DataValueCell id={33} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="ఈ నెల SB A/C మరియు LOAN A/C నందు నగదు జమ వివరములు" colSpan={6} center small />
                        </tr>

                        {/* R8 */}
                        <tr>
                            <RowHeaderCell text="సంఘానికి తిరిగి వచ్చినవి" />
                            <DataValueCell id={42} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="సంఘం ఖర్చులు" />
                            <DataValueCell id={43} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="అమౌంట్ రూ." rowSpan={2} colSpan={1} small />
                            <RowHeaderCell text="అక్షరాల..." rowSpan={2} colSpan={3} small />
                        </tr>

                        {/* R9 */}
                        <tr>
                            <RowHeaderCell text="VO నుండి తిరిగి వచ్చిన వడ్డీధనం" />
                            <DataValueCell id={46} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="VO కు చెల్లించిన ప్రవేశరుసుము/సభ్యత్వ రుసుము" />
                            <DataValueCell id={48} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                        </tr>

                        {/* R10 */}
                        <tr>
                            <RowHeaderCell text="VO నుండి తిరిగి వచ్చిన పొదుపు" />
                            <DataValueCell id={51} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="VO కు చెల్లించిన జరిమానాలు" />
                            <DataValueCell id={53} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                        </tr>

                        {/* R11 */}
                        <tr>
                            <RowHeaderCell text="శ్రీనిధి నుండి తిరిగి వచ్చిన పొదుపు" />
                            <DataValueCell id={56} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="గౌరవవేతనం చెల్లింపు" />
                            <DataValueCell id={58} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="జమ చేసిన సభ్యురాలి పేరు:....................................." colSpan={3} small />
                        </tr>

                        {/* R12 */}
                        <tr>
                            <RowHeaderCell text="బ్యాంకు నుండి తీసిన డిపాజిట్" />
                            <DataValueCell id={61} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="ప్రయాణపు చార్జీల చెల్లింపు" />
                            <DataValueCell id={63} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="జమ చేసిన సభ్యురాలి సంతకం:....................................." colSpan={3} rowSpan={2} small />
                        </tr>

                        {/* R13 */}
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCell id={66} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="ఇతర ఖర్చులు" />
                            <DataValueCell id={68} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                        </tr>

                        {/* R14 & R15: VOA Signature */}
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCell id={70} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="స్టేషనరీ" />
                            <DataValueCell id={72} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="VOA సంతకం" colSpan={3} rowSpan={2} small center />
                        </tr>
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCell id={74} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="ఆడిట్ ఫీజు" />
                            <DataValueCell id={76} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                        </tr>

                        {/* R16, R17, R18: SHG Stamp & Income */}
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCell id={78} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="బ్యాంకు చార్జీలు" />
                            <DataValueCell id={80} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="SHG స్టాంప్" colSpan={3} rowSpan={3} small center />
                        </tr>
                        <tr>
                            <RowHeaderCell text="సంఘానికి వచ్చిన ఆదాయాలు" bold />
                            <DataValueCell id={83} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="ఋణాలకు సంఘం చెల్లించిన రికవరీలు" bold />
                            <DataValueCell id={85} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                        </tr>
                        <tr>
                            <RowHeaderCell text="బ్యాంకు వడ్డీలు" />
                            <DataValueCell id={87} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="బ్యాంక్ లోన్ ఋణానికి చెల్లింపు" />
                            <DataValueCell id={89} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                        </tr>

                        {/* R19: Signature Header */}
                        <tr>
                            <RowHeaderCell text="డిపాజిట్ లపై వచ్చిన వడ్డీలు" />
                            <DataValueCell id={91} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="శ్రీనిధి మైక్రో ఋణానికి చెల్లింపు" />
                            <DataValueCell id={93} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="సభ్యుల సంతకాలు :" colSpan={6} small bold />
                        </tr>

                        {/* R20-R27: Signature Large Box + Loans */}
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCell id={95} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <RowHeaderCell text="SCSP రుణం చెల్లింపు" />
                            <DataValueCell id={97} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                            <td colSpan={6} rowSpan={8} className="border-2 border-black p-4 align-top bg-white">
                                <div className="grid grid-cols-2 gap-x-24 px-12 py-2">
                                    <div className="flex flex-col gap-4 font-bold text-[13px] text-gray-800">
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <div key={n} className="flex items-center h-6">{n}</div>)}
                                    </div>
                                    <div className="flex flex-col gap-4 font-bold text-[13px] text-gray-800 pr-12">
                                        {[9, 10, 11, 12, 13, 14, 15].map(n => <div key={n} className="flex items-center h-6">{n}</div>)}
                                    </div>
                                </div>
                            </td>
                        </tr>

                        {[
                            { l1: "", v1: 99, l2: "వలస రుణం చెల్లింపు", v2: 101 },
                            { l1: "", v1: 103, l2: "ఆపద రుణం చెల్లింపు", v2: 105 },
                            { l1: "", v1: 107, l2: "TSP రుణం చెల్లింపు", v2: 109 },
                            { l1: "", v1: 111, l2: "CIF ఋణానికి చెల్లింపు", v2: 113 },
                            { l1: "", v1: 200, l2: "VO అంతర్గత ఋణానికి చెల్లింపు", v2: 113 },
                            { l1: "బ్యాంకు నుండి తీసిన నగదు", v1: 115, l2: "బ్యాంకు నందు జమ చేసిన నగదు", v2: 117 },
                            { l1: "మొత్తం రూ.", v1: 119, l2: "మొత్తం రూ.", v2: 121, bold: true }
                        ].map((row, idx) => (
                            <tr key={idx}>
                                <RowHeaderCell text={row.l1} bold={row.bold} />
                                <DataValueCell id={row.v1} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} bold={row.bold} />
                                <RowHeaderCell text={row.l2} bold={row.bold} />
                                <DataValueCell id={row.v2} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} bold={row.bold} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Minimal Legency Overlay */}
            <div className="mt-8 flex gap-8 items-center text-[10px] font-black text-gray-400 tracking-widest uppercase">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                    <span>Machine Verified</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
                    <span>Human Review Suggested</span>
                </div>
                <div className="border-l border-gray-200 pl-8 text-indigo-600">
                    Proprietary Digitized Format — SHG-P2-V1.0
                </div>
            </div>
        </div>
    );
}
