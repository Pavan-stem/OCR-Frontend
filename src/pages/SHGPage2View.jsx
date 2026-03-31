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
                if (cell.debug_id != null) map[`cell_${cell.debug_id}`] = { text: cell.text || '', confidence: cell.confidence || 0 };
            });
        });
        return map;
    }, [tableData]);

    const handleEdit = (id, val) => onCellEdit?.(id, val);

    const editableIds = useMemo(() => new Set([
        10, 12, 17, 19, 24, 26, 31, 33, 36, 38, 42, 43, 46, 48, 51, 53, 56, 58, 61, 63, 66, 68, 70, 72, 74, 76, 78, 80, 83, 85, 87, 89, 91, 93, 95, 97, 99, 101, 103, 105, 107, 109, 111, 113, 115, 117, 119, 121, 123
    ]), []);

    const DataValueCellRefined = (props) => (
        <DataValueCell {...props} idMap={idMap} isEditing={isEditing && editableIds.has(props.id)} onEdit={handleEdit} />
    );

    return (
        <div className="flex flex-col items-center bg-gray-100 p-4 sm:p-10 min-h-screen">
            <div className="bg-white shadow-2xl p-[0.3in] border-t-8 border-indigo-600 w-full max-w-[1200px] border border-gray-300">
                <table className="w-full border-collapse border-2 border-black">
                    <tbody>
                        {/* Headers */}
                        <tr>
                            <RowHeaderCell text="సంఘం స్థాయిలో జరిగిన ఆర్థిక లావాదేవీలు" colSpan={4} center bold />
                            <RowHeaderCell text="గత నెల (.........................) బ్యాంక్ నిల్వలు" colSpan={6} center bold />
                        </tr>
                        <tr>
                            <RowHeaderCell text="సంఘానికి వచ్చిన వివరములు" small />
                            <RowHeaderCell text="మొత్తం రూ." center small />
                            <RowHeaderCell text="సంఘం చెల్లించిన వివరములు" small />
                            <RowHeaderCell text="మొత్తం రూ." center small />
                            <RowHeaderCell text="ఖాతా వివరము" small />
                            <RowHeaderCell text="తేది నాటికి" center small />
                            <RowHeaderCell text="రూ." center colSpan={4} small />
                        </tr>

                        {/* Balance Section (R3-R5) */}
                        {[
                            { t1: "సంఘానికి వచ్చిన పొదుపు మొత్తం", id1: 10, t2: "సంఘం పెట్టుబడులు", id2: 12, label: "చేతి నిల్వ", idV1: 14, idV2: 15 },
                            { t1: "పొదుపులు (SN+VO+Other Saving)", id1: 17, t2: "VO లో కట్టిన వడ్డీ ధనం", id2: 19, label: "పొదుపు ఖాతా", idV1: 21, idV2: 22 },
                            { t1: "సంఘానికి వచ్చిన ఫండ్స్", id1: 24, t2: "VO లో కట్టిన పొదుపు", id2: 26, label: "బ్యాంక్ లోన్ ఖాతా", idV1: 28, idV2: 29 }
                        ].map((row, idx) => (
                            <tr key={idx}>
                                <RowHeaderCell text={row.t1} />
                                <DataValueCellRefined id={row.id1} />
                                <RowHeaderCell text={row.t2} />
                                <DataValueCellRefined id={row.id2} />
                                <RowHeaderCell text={row.label} />
                                <DataValueCellRefined id={row.idV1} />
                                <DataValueCellRefined id={row.idV2} colSpan={4} />
                            </tr>
                        ))}

                        {/* R6: Heading */}
                        <tr>
                            <RowHeaderCell text="రివాల్వింగ్ ఫండ్" />
                            <DataValueCellRefined id={31} />
                            <RowHeaderCell text="శ్రీనిధి లో కట్టిన పొదుపు" />
                            <DataValueCellRefined id={33} />
                            <RowHeaderCell text="ఈ నెల SB A/C మరియు LOAN A/C నందు నగదు జమ వివరములు" colSpan={6} center small />
                        </tr>

                        {/* R7-R8: Amount and Expenses */}
                        <tr>
                            <RowHeaderCell text="ఆధార్ గ్రాంట్స్" />
                            <DataValueCellRefined id={36} />
                            <RowHeaderCell text="బ్యాంకు లో చేసిన డిపాజిట్" />
                            <DataValueCellRefined id={38} />
                            <RowHeaderCell text="అమౌంట్ రూ." rowSpan={2} center small />
                            <td colSpan={5} rowSpan={2} className="border border-black p-2 text-[12px] italic text-gray-500 align-middle">
                                అక్షరాల........................................................ మాత్రమే
                            </td>
                        </tr>
                        <tr>
                            <RowHeaderCell text="సంఘానికి తిరిగి వచ్చినవి" />
                            <DataValueCellRefined id={42} />
                            <RowHeaderCell text="సంఘం ఖర్చులు" />
                            <DataValueCellRefined id={43} />
                        </tr>

                        {/* R9-R10: VO returns/savings */}
                        <tr>
                            <RowHeaderCell text="VO నుండి తిరిగి వచ్చిన వడ్డీధనం" />
                            <DataValueCellRefined id={46} />
                            <RowHeaderCell text="VO కు చెల్లించిన సభ్యత్వ రుసుము" />
                            <DataValueCellRefined id={48} />
                            <RowHeaderCell text="జమ చేసిన సభ్యురాలి పేరు:....................................." colSpan={6} small />
                        </tr>
                        <tr>
                            <RowHeaderCell text="VO నుండి తిరిగి వచ్చిన పొదుపు" />
                            <DataValueCellRefined id={51} />
                            <RowHeaderCell text="VO కు చెల్లించిన జరిమానాలు" />
                            <DataValueCellRefined id={53} />
                            <RowHeaderCell text="జమ చేసిన సభ్యురాలి సంతకం:....................................." colSpan={6} rowSpan={2} small />
                        </tr>

                        {/* R11-R12: Salaries and VOA Signature Box (2 rows) */}
                        <tr>
                            <RowHeaderCell text="శ్రీనిధి నుండి తిరిగి వచ్చిన పొదుపు" />
                            <DataValueCellRefined id={56} />
                            <RowHeaderCell text="గౌరవవేతనం చెల్లింపు" />
                            <DataValueCellRefined id={58} />
                        </tr>
                        <tr>
                            <RowHeaderCell text="బ్యాంకు నుండి తీసిన నగదు" />
                            <DataValueCellRefined id={61} />
                            <RowHeaderCell text="ప్రయాణపు చార్జీల చెల్లింపు" />
                            <DataValueCellRefined id={63} />
                            <RowHeaderCell text="VOA సంతకం" colSpan={6} center small />
                        </tr>

                        {/* R13-R16: SHG Stamp (4 rows) */}
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCellRefined id={66} />
                            <RowHeaderCell text="ఇతర ఖర్చులు" />
                            <DataValueCellRefined id={68} />
                            <td colSpan={6} rowSpan={4} className="border border-black px-2 py-1 text-center align-middle font-bold text-gray-200 italic text-[11px]">
                                SHG స్టాంప్
                            </td>
                        </tr>
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCellRefined id={70} />
                            <RowHeaderCell text="స్టేషనరీ" />
                            <DataValueCellRefined id={72} />
                        </tr>
                        <tr>
                            <RowHeaderCell text="బ్యాంక్ లో చెల్లించిన వడ్డీ" />
                            <DataValueCellRefined id={74} />
                            <RowHeaderCell text="ఆడిట్ ఫీజు" />
                            <DataValueCellRefined id={76} />
                        </tr>
                        <tr>
                            <RowHeaderCell text="" />
                            <DataValueCellRefined id={78} />
                            <RowHeaderCell text="బ్యాంకు చార్జీలు" />
                            <DataValueCellRefined id={80} />
                        </tr>

                        {/* R17-R27: Member Signatures (11 rows) starting from Income row */}
                        <tr>
                            <RowHeaderCell text="సంఘానికి వచ్చిన ఆదాయాలు" bold />
                            <DataValueCellRefined id={83} />
                            <RowHeaderCell text="ఋణాలకు సంఘం చెల్లించిన రికవరీలు" bold />
                            <DataValueCellRefined id={85} />
                            <td colSpan={6} rowSpan={11} className="border-2 border-black p-4 align-top bg-white">
                                <div className="font-bold text-[11px] mb-6">సభ్యుల సంతకాలు :</div>
                                <div className="grid grid-cols-2 gap-x-24 px-12 py-2">
                                    <div className="flex flex-col gap-5 font-bold text-[13px] text-gray-800">
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <div key={n} className="flex items-center h-6">{n}</div>)}
                                    </div>
                                    <div className="flex flex-col gap-5 font-bold text-[13px] text-gray-800 pr-12">
                                        {[9, 10, 11, 12, 13, 14, 15].map(n => <div key={n} className="flex items-center h-6">{n}</div>)}
                                    </div>
                                </div>
                            </td>
                        </tr>
                        {[
                            { l1: "బ్యాంకు వడ్డీలు", v1: 87, l2: "బ్యాంక్ లోన్ ఋణానికి చెల్లింపు", v2: 89 },
                            { l1: "డిపాజిట్ లపై వచ్చిన వడ్డీలు", v1: 91, l2: "శ్రీనిధి మైక్రో ఋణానికి చెల్లింపు", v2: 93 },
                            { l1: "", v1: 95, l2: "SCSP రుణం చెల్లింపు", v2: 97 },
                            { l1: "", v1: 99, l2: "వలస రుణం చెల్లింపు", v2: 101 },
                            { l1: "", v1: 103, l2: "ఆపద రుణం చెల్లింపు", v2: 105 },
                            { l1: "", v1: 107, l2: "TSP రుణం చెల్లింపు", v2: 109 },
                            { l1: "", v1: 111, l2: "CIF ఋణానికి చెల్లింపు", v2: 113 },
                            { l1: "", v1: 123, l2: "VO అంతర్గత ఋణానికి చెల్లింపు", v2: 113 },
                            { l1: "బ్యాంకు నుండి తీసిన నగదు", v1: 115, l2: "బ్యాంకు నందు జమ చేసిన నగదు", v2: 117 },
                            { l1: "మొత్తం రూ.", v1: 119, l2: "మొత్తం రూ.", v2: 121, bold: true }
                        ].map((row, idx) => (
                            <tr key={idx}>
                                <RowHeaderCell text={row.l1} bold={row.bold} />
                                <DataValueCellRefined id={row.v1} />
                                <RowHeaderCell text={row.l2} bold={row.bold} />
                                <DataValueCellRefined id={row.v2} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Status Overlay */}
            <div className="mt-8 flex gap-8 items-center text-[10px] font-black text-gray-400 tracking-widest uppercase">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                    <span>Machine Verified</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
                    <span>Review Suggested</span>
                </div>
                <div className="border-l border-gray-200 pl-8 text-indigo-600">
                    SHG-P2-V1.1
                </div>
            </div>
        </div>
    );
}
