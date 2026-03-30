import React, { useMemo } from 'react';

// ============================================================
// PAGE 2 — Static label map
// Maps debug_id (flat cell ID, row*10+col) to Section + Label
// Derived from calibrated_template_02.json (28×10 grid) and
// the physical SHG form layout shown in the reference image.
//
// TOP portion — two panels side by side:
//   LEFT  cols 1-4 : గత నెల బ్యాంక్ నిల్వలు
//   RIGHT cols 5-8 : ఈ నెల నగదు వివరాలు
//
// BOTTOM portion — two columns of stacked sections:
//   LEFT  cols 1-2 : (expenses / loan repayment / resources / other sections)
//   RIGHT cols 5-8 : (notes / signatures)
// ============================================================

export const PAGE2_SECTION_DEFS = [
    // ── LEFT TOP PANEL ──────────────────────────────────────
    {
        key: 'bank_balances',
        title: 'గత నెల బ్యాంక్ నిల్వలు',
        subtitle: 'Previous Month Bank Balances',
        color: 'indigo',
        rows: [
            { id: 31,  label: 'గత నెల నిల్వ',                         hint: 'Previous month balance' },
            { id: 51,  label: 'ఈ నెల జమ',                             hint: 'This month credit' },
            { id: 61,  label: 'మొత్తం (SN+VO+Other Saving)',           hint: 'Total savings' },
            { id: 72,  label: 'సంఘానికి వచ్చిన ఫండ్స్',               hint: 'Funds received by group' },
            { id: 91,  label: 'బ్యాంక్ లో ఉన్న మొత్తం',               hint: 'Total in bank' },
            { id: 101, label: 'VO లో ఉన్న మొత్తం',                    hint: 'Total in VO' },
            { id: 111, label: 'VO లో ఉన్న రుణధనం',                    hint: 'Loan amount in VO' },
            { id: 121, label: 'సంఘం ఆర్థిక లావాదేవీలు',               hint: 'Group financial transactions' },
        ]
    },

    // ── RIGHT TOP PANEL ─────────────────────────────────────
    {
        key: 'cash_details',
        title: 'ఈ నెల నగదు వివరాలు',
        subtitle: 'This Month Cash Details',
        color: 'emerald',
        multiCol: true,   // renders as label | జమ | రూ. columns
        colHeaders: ['ఖాతా వివరాలు', 'జమ', 'రూ.'],
        rows: [
            { id: 33, id2: 36,  id3: 38,  label: 'సేవింగ్స్',     hint: 'Savings' },
            { id: 46, id2: 48,  id3: null, label: 'రుణ ఖాతా',     hint: 'Loan account' },
            { id: 53, id2: 56,  id3: 58,  label: 'బ్యాంక్ లో జమ', hint: 'Credited to bank' },
        ]
    },

    // ── EXPENSES ────────────────────────────────────────────
    {
        key: 'expenses',
        title: 'ఇతర ఖర్చులు',
        subtitle: 'Other Expenses',
        color: 'amber',
        rows: [
            { id: 80, label: 'ఇతర ఖర్చులు',              hint: 'Other expenses' },
            { id: 87, label: 'బ్యాంక్ నుండి తీసిన నగదు', hint: 'Cash withdrawn from bank' },
            { id: 63, label: 'మొత్తం',                    hint: 'Total expenses' },
        ]
    },

    // ── LOAN REPAYMENTS ─────────────────────────────────────
    {
        key: 'loan_repayments',
        title: 'రుణ వివరాలు',
        subtitle: 'Loan Details',
        color: 'blue',
        rows: [
            { id: 93,  label: 'బ్యాంక్ రుణం చెల్లింపు',         hint: 'Bank loan repayment' },
            { id: 103, label: 'బ్యాంక్ లో జమ చేసిన నగదు',       hint: 'Cash deposited in bank' },
            { id: 113, label: 'బ్యాంక్ వడ్డీ',                   hint: 'Bank interest' },
            { id: 123, label: 'ఆదాయం',                           hint: 'Income' },
            { id: 95,  label: 'VO అంతర్గత రుణం చెల్లింపు',      hint: 'VO internal loan repayment' },
            { id: 105, label: 'CIF రుణం చెల్లింపు',              hint: 'CIF loan repayment' },
            { id: 115, label: 'SHG నిధి',                         hint: 'SHG fund' },
        ]
    },

    // ── RESOURCES & EXPENSES ────────────────────────────────
    {
        key: 'resources',
        title: 'వనరులు & ఖర్చులు',
        subtitle: 'Resources & Expenses',
        color: 'violet',
        rows: [
            { id: 97,  label: 'కిట్టుబాటులో వచ్చిన వనరులు',       hint: 'Resources received' },
            { id: 107, label: 'సంఘం చెల్లించిన వివరాలు',           hint: 'Group payment details' },
            { id: 117, label: 'బ్యాంక్ లో చెల్లించిన కిట్టుబాటు', hint: 'Loan repaid to bank' },
            { id: 99,  label: 'VO నుండి వచ్చిన రుణం',             hint: 'Loan from VO' },
            { id: 109, label: 'సేవా చార్జీలు',                    hint: 'Service charges' },
            { id: 119, label: 'ప్రభుత్వ చెల్లింపులు',             hint: 'Government payments' },
        ]
    },

    // ── LOAN CATEGORIES ─────────────────────────────────────
    {
        key: 'loan_categories',
        title: 'రుణాల విభాగం',
        subtitle: 'Loan Categories',
        color: 'rose',
        rows: [
            { id: 17,  label: 'SCSP రుణం చెల్లింపు',  hint: 'SCSP loan repayment' },
            { id: 26,  label: 'వలస రుణం చెల్లింపు',  hint: 'Migration loan repayment' },
            { id: 68,  label: 'ఆపద రుణం చెల్లింపు',  hint: 'Emergency loan repayment' },
            { id: 76,  label: 'TSP రుణం చెల్లింపు',   hint: 'TSP loan repayment' },
        ]
    },

    // ── OTHER DETAILS ────────────────────────────────────────
    {
        key: 'other_details',
        title: 'ఇతర వివరాలు',
        subtitle: 'Other Details',
        color: 'teal',
        rows: [
            { id: 19,  label: 'రికవరీలు',               hint: 'Recoveries' },
            { id: 46,  label: 'వలస నుండి వచ్చిన మొత్తం', hint: 'Amount from migration' },
            { id: 89,  label: 'విద్య నిధి',              hint: 'Education fund' },
            { id: 36,  label: 'జరిమానాలు',               hint: 'Fines/Penalties' },
            { id: 38,  label: 'సభ్యత్వ రుసుము',          hint: 'Membership fee' },
        ]
    },
];

// ── Colour palettes ───────────────────────────────────────────
const PALETTE = {
    indigo:  { header: 'bg-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',  border: 'border-indigo-200',  row: 'hover:bg-indigo-50/40',  accent: 'text-indigo-900' },
    emerald: { header: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', row: 'hover:bg-emerald-50/40', accent: 'text-emerald-900' },
    amber:   { header: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700',    border: 'border-amber-200',   row: 'hover:bg-amber-50/40',   accent: 'text-amber-900' },
    blue:    { header: 'bg-blue-600',    badge: 'bg-blue-100 text-blue-700',      border: 'border-blue-200',    row: 'hover:bg-blue-50/40',    accent: 'text-blue-900' },
    violet:  { header: 'bg-violet-600',  badge: 'bg-violet-100 text-violet-700',  border: 'border-violet-200',  row: 'hover:bg-violet-50/40',  accent: 'text-violet-900' },
    rose:    { header: 'bg-rose-600',    badge: 'bg-rose-100 text-rose-700',      border: 'border-rose-200',    row: 'hover:bg-rose-50/40',    accent: 'text-rose-900' },
    teal:    { header: 'bg-teal-600',    badge: 'bg-teal-100 text-teal-700',      border: 'border-teal-200',    row: 'hover:bg-teal-50/40',    accent: 'text-teal-900' },
};

// ── Helper: build a flat id→text map from the backend data_rows ──
function buildIdMap(tableData) {
    const map = {};
    const rows = tableData?.data_rows || [];
    rows.forEach(row => {
        (row.cells || []).forEach(cell => {
            if (cell.debug_id != null) {
                map[cell.debug_id] = {
                    text: cell.text || '',
                    confidence: cell.confidence || 0,
                };
            }
        });
    });
    return map;
}

// ── Single-section card (standard key→value layout) ──────────
function SectionCard({ section, idMap, isEditing, onEdit }) {
    const p = PALETTE[section.color] || PALETTE.indigo;
    const filledCount = section.rows.filter(r => idMap[r.id]?.text?.trim()).length;

    return (
        <div className={`rounded-2xl border ${p.border} overflow-hidden shadow-sm`}>
            {/* Header */}
            <div className={`${p.header} px-5 py-3 flex items-center justify-between`}>
                <div>
                    <h4 className="text-white font-black text-sm tracking-wide">{section.title}</h4>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                        {section.subtitle}
                    </p>
                </div>
                <span className={`${p.badge} text-[10px] font-black px-2.5 py-1 rounded-full`}>
                    {filledCount}/{section.rows.length}
                </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 bg-white">
                {section.rows.map((rowDef) => {
                    const cell = idMap[rowDef.id] || {};
                    const value = cell.text || '';
                    const conf  = cell.confidence || 0;
                    const isEmpty = !value.trim();

                    return (
                        <div
                            key={rowDef.id}
                            className={`flex items-center justify-between gap-3 px-5 py-3 transition-colors ${p.row}`}
                        >
                            {/* Label */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-gray-800 leading-snug">{rowDef.label}</p>
                                {rowDef.hint && (
                                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">{rowDef.hint}</p>
                                )}
                            </div>

                            {/* Value */}
                            <div className="min-w-[100px] text-right">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => onEdit(rowDef.id, e.target.value)}
                                        className="w-28 bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        placeholder="రూ."
                                    />
                                ) : (
                                    <span className={`text-sm font-black ${isEmpty ? 'text-gray-300 italic' : p.accent}`}>
                                        {isEmpty ? '—' : value}
                                    </span>
                                )}
                            </div>

                            {/* Confidence dot */}
                            {!isEditing && !isEmpty && (
                                <div
                                    className={`w-2 h-2 rounded-full flex-shrink-0 ${conf >= 0.8 ? 'bg-emerald-400' : conf >= 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                                    title={`OCR Confidence: ${(conf * 100).toFixed(0)}%`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Multi-column section card (for ఈ నెల నగదు వివరాలు) ───────
function MultiColSectionCard({ section, idMap, isEditing, onEdit }) {
    const p = PALETTE[section.color] || PALETTE.emerald;

    return (
        <div className={`rounded-2xl border ${p.border} overflow-hidden shadow-sm`}>
            {/* Header */}
            <div className={`${p.header} px-5 py-3`}>
                <h4 className="text-white font-black text-sm tracking-wide">{section.title}</h4>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    {section.subtitle}
                </p>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-4 gap-0 bg-gray-50/80 border-b border-gray-200">
                {(section.colHeaders || []).map((h, i) => (
                    <div
                        key={i}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 ${i === 0 ? 'col-span-2' : ''}`}
                    >
                        {h}
                    </div>
                ))}
            </div>

            {/* Data rows */}
            <div className="divide-y divide-gray-100 bg-white">
                {section.rows.map((rowDef) => {
                    const v1 = idMap[rowDef.id]?.text  || '';
                    const v2 = rowDef.id2 != null ? (idMap[rowDef.id2]?.text || '') : '';
                    const v3 = rowDef.id3 != null ? (idMap[rowDef.id3]?.text || '') : '';

                    const cell = (id, val) => isEditing ? (
                        <input
                            type="text"
                            value={val}
                            onChange={(e) => onEdit(id, e.target.value)}
                            className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            placeholder="—"
                        />
                    ) : (
                        <span className={`text-sm font-black ${val.trim() ? p.accent : 'text-gray-300 italic'}`}>
                            {val.trim() || '—'}
                        </span>
                    );

                    return (
                        <div key={rowDef.id} className={`grid grid-cols-4 gap-0 px-4 py-3 transition-colors ${p.row}`}>
                            <div className="col-span-2 flex items-center">
                                <p className="text-[13px] font-bold text-gray-800">{rowDef.label}</p>
                            </div>
                            <div className="flex items-center justify-end pr-3">
                                {cell(rowDef.id2, v2)}
                            </div>
                            <div className="flex items-center justify-end">
                                {cell(rowDef.id3, v3)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main export ────────────────────────────────────────────────
export default function SHGPage2View({ tableData, isEditing, onCellEdit }) {
    // Build a flat map: debug_id → { text, confidence }
    const idMap = useMemo(() => buildIdMap(tableData), [tableData]);

    // Callback that routes edits back to parent via debug_id
    const handleEdit = (debugId, value) => {
        if (onCellEdit) onCellEdit(debugId, value);
    };

    // Separate the first two sections (top panels) from the rest
    const [leftTop, rightTop, ...bottomSections] = PAGE2_SECTION_DEFS;

    return (
        <div className="p-6 space-y-6">
            {/* Top two-panel row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard
                    section={leftTop}
                    idMap={idMap}
                    isEditing={isEditing}
                    onEdit={handleEdit}
                />
                <MultiColSectionCard
                    section={rightTop}
                    idMap={idMap}
                    isEditing={isEditing}
                    onEdit={handleEdit}
                />
            </div>

            {/* Bottom sections — responsive 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {bottomSections.map((section) => (
                    <SectionCard
                        key={section.key}
                        section={section}
                        idMap={idMap}
                        isEditing={isEditing}
                        onEdit={handleEdit}
                    />
                ))}
            </div>

            {/* OCR confidence legend */}
            <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-[11px] font-bold text-gray-500">
                <span className="uppercase tracking-widest">OCR Confidence:</span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full inline-block" />
                    High (&ge;80%)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block" />
                    Medium (50–80%)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-red-400 rounded-full inline-block" />
                    Low (&lt;50%)
                </span>
            </div>
        </div>
    );
}
