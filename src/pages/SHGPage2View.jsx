import React, { useMemo } from 'react';

/**
 * SHG Page 2 (Financial Ledger) — FINAL High-Fidelity Reconstruction
 * Replicates the physical table scan exactly with hardcoded Telugu titles
 * to ensure accuracy even if OCR misses labels.
 *
 * Col 1 empty slots mirror the 7 loan repayment values from Col 2.
 * Col 2 structure is unchanged from the original physical form.
 */

const RowHeaderCell = ({ text, colSpan = 1, rowSpan = 1, center = false, bold = false, small = false }) => (
  <td
    colSpan={colSpan}
    rowSpan={rowSpan}
    style={bold ? { textShadow: '0.5px 0 0 black', fontFamily: "'Nirmala UI', 'Segoe UI', sans-serif" } : { fontFamily: "'Nirmala UI', 'Segoe UI', sans-serif" }}
    className={`border border-black px-2 py-1.5 align-middle bg-gray-50/50 ${center ? 'text-center' : 'text-left'} ${bold ? 'font-black' : 'font-normal'} text-black ${small ? 'text-[10px]' : 'text-[11.5px]'}`}
  >
    {text}
  </td>
);

/** Editable/read-only data cell — reads from its own id in idMap */
const DataValueCell = ({ id, idMap, isEditing, onEdit, colSpan = 1, rowSpan = 1, computed = false, value = null, orange = false, brown = false }) => {
  const cell = idMap[`cell_${id}`] || {};
  const text = computed ? (value !== null ? String(value) : '') : (cell.text || '');
  const conf = cell.confidence || 0;
  const isEmpty = !text.trim();

  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={`border border-black px-2 py-1.5 align-middle min-w-[60px] text-right text-[13px] font-mono font-black ${brown ? 'bg-[#F7BD83] text-white' : orange ? 'text-orange-600 bg-orange-50' : 'text-indigo-900 bg-white'} group transition-colors ${!brown ? 'hover:bg-indigo-50/30' : ''}`}
    >
      {isEditing && !computed && !brown ? (
        <input
          type="text"
          value={text}
          onChange={(e) => onEdit(id, e.target.value)}
          className="w-full bg-indigo-50/50 border border-transparent focus:border-indigo-400 text-right font-black px-1 py-0.5 outline-none rounded"
        />
      ) : (
        <div className="flex items-center justify-between gap-1">
          <span className={isEmpty ? 'opacity-20 italic' : ''}>{(isEmpty && !brown) ? '—' : text}</span>
          {!isEmpty && !computed && (
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cell.isLinked ? 'bg-blue-500' : (conf >= 0.8 ? 'bg-emerald-500' : conf >= 0.5 ? 'bg-amber-400' : 'bg-red-500')}`}
              title={cell.isLinked ? "Linked to Page 1 Total" : `OCR: ${(conf * 100).toFixed(0)}%`}
            />
          )}
        </div>
      )}
    </td>
  );
};

/**
 * Mirror cell — reads value from `mirrorId` (a Col 2 cell) and displays it
 * read-only in a Col 1 slot. Editing is done via the Col 2 original.
 */
const MirrorValueCell = ({ mirrorId, idMap, orange = false }) => {
  const cell = idMap[`cell_${mirrorId}`] || {};
  const text = cell.text || '';
  const isEmpty = !text.trim();

  return (
    <td className={`border border-black px-2 py-1.5 align-middle min-w-[60px] text-right text-[13px] font-mono font-black ${orange ? 'text-orange-600 bg-orange-50' : 'text-indigo-900 bg-indigo-50/20'}`}>
      <span className={isEmpty ? 'opacity-20 italic' : ''}>{isEmpty ? '—' : text}</span>
    </td>
  );
};

const parseValue = (val) => {
  if (!val) return 0;
  const clean = val.toString().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const fmt = (n) => n === 0 ? '' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function SHGPage2View({ tableData, isEditing, onCellEdit, relatedPage1Totals }) {
  const idMap = useMemo(() => {
    const map = {};
    (tableData?.data_rows || []).forEach(row => {
      (row.cells || []).forEach(cell => {
        if (cell.debug_id != null) map[`cell_${cell.debug_id}`] = { text: cell.text || '', confidence: cell.confidence || 0 };
      });
    });

    // Link Page 1 totals if available — overwrites detected data in Page 2
    if (relatedPage1Totals) {
      const mappings = {
        '4': 89,  // Bank Loan
        '5': 93,  // Streenidhi Micro
        '6': 97,  // Streenidhi Tenni
        '7': 101, // Unnathi SCSP
        '8': 105, // Unnathi TSP
        '9': 109  // CIF
      };

      Object.entries(mappings).forEach(([p1Col, p2Id]) => {
        const val = relatedPage1Totals[p1Col];
        if (val !== undefined && val !== null) {
          // If total is 0, we treat it as empty per user request
          const text = val > 0 ? String(val) : '';
          map[`cell_${p2Id}`] = {
            text: text,
            confidence: 1.0,
            isLinked: true
          };
        }
      });
    }

    return map;
  }, [tableData, relatedPage1Totals]);

  const handleEdit = (id, val) => onCellEdit?.(id, val);

  const editableIds = useMemo(() => {
    const baseIds = new Set([
      10, 12, 17, 19, 24, 26, 31, 33, 36, 38, 42, 43, 46, 48, 51, 53,
      56, 58, 61, 63, 68, 72, 76, 80, 83, 85, 87, 89, 91, 93, 97, 101,
      105, 109, 113, 115
    ]);

    // If linked data exists, these 6 IDs are NO LONGER editable in Page 2
    if (relatedPage1Totals) {
      [89, 93, 97, 101, 105, 109].forEach(id => baseIds.delete(id));
    }

    return baseIds;
  }, [relatedPage1Totals]);

  const g = (id) => parseValue(idMap[`cell_${id}`]?.text || '');

  // ── Calculated values ──────────────────────────────────────────────────────

  // L1 = పొదుపులు(17) − సంఘం పెట్టుబడులు(12) − VO వాటాధనం(19) − VO పొదుపు(26)
  const L1 = g(17) - g(12) - g(19) - g(26);

  // Loan repayment IDs (7 — live in Col 2): 89, 93, 97, 101, 105, 109, 113
  const loanRepaymentTotal = g(89) + g(93) + g(97) + g(101) + g(105) + g(109) + g(113);

  // అమౌంట్ రూ. = L1 + all 7 loan repayments
  const amountRu = L1 + loanRepaymentTotal;

  // బ్యాంకు నందు జమ చేసిన నగదు (Col 2, computed) =
  //   L1 + రివాల్వింగ్ ఫండ్(31) + ఆధార్ గ్రాంట్స్(36) +
  //   VO వాటాధనం తిరిగి(46) + VO పొదుపు తిరిగి(51) +
  //   శ్రీనిధి పొదుపు తిరిగి(56) + బ్యాంకు డిపాజిట్ తిరిగి(61) +
  //   బ్యాంకు వడ్డీలు(87) + డిపాజిట్ వడ్డీలు(91)
  const bankCashReceived = L1 + g(31) + g(36) + g(46) + g(51) + g(56) + g(61) + g(87) + g(91);

  // బ్యాంకు నుండి తీసిన నగదు (Col 1, computed) =
  //   బ్యాంకు లో చేసిన డిపాజిట్(38) + VO ప్రవేశ రుసుము(48) + VO జరిమానాలు(53) +
  //   గౌరవవేతనం(58) + ప్రయాణపు చార్జీలు(63) + ఇతర ఖర్చులు(68) +
  //   స్టేషనరీ(72) + ఆడిట్ ఫీజు(76) + బ్యాంకు చార్జీలు(80)
  const bankCashWithdrawn = g(38) + g(48) + g(53) + g(58) + g(63) + g(68) + g(72) + g(76) + g(80);

  // Grand totals
  // Col 1 includes the 7 mirrored loan repayment values displayed in the empty slots
  const col1Total =
    g(10) + g(17) + g(24) + g(31) + g(36) + g(42) + g(46) + g(51) +
    g(56) + g(61) + g(83) + g(87) + g(91) +
    loanRepaymentTotal +   // mirrored: 89+93+97+101+105+109+113
    bankCashWithdrawn;

  const col2Total =
    g(12) + g(19) + g(26) + g(33) + g(38) + g(43) + g(48) + g(53) +
    g(58) + g(63) + g(68) + g(72) + g(76) + g(80) + g(85) +
    loanRepaymentTotal + bankCashReceived;

  const totalsMatch = Math.abs(col1Total - col2Total) < 0.01;

  const lastSentTotals = React.useRef({ t119: null, t121: null });

  React.useEffect(() => {
    if (totalsMatch) {
      const next119 = fmt(col1Total);
      const next121 = fmt(col2Total);

      // Use a ref to track what we've sent to prevent infinite loop
      // This is safer than checking idMap since these cells might not be in the data rows yet
      if (lastSentTotals.current.t119 !== next119 || lastSentTotals.current.t121 !== next121) {
        lastSentTotals.current = { t119: next119, t121: next121 };
        onCellEdit?.(119, next119);
        onCellEdit?.(121, next121);
      }
    }
  }, [col1Total, col2Total, totalsMatch, onCellEdit]);

  return (
    <div className="flex flex-col items-center bg-gray-100 p-4 sm:p-10 min-h-screen">
      <div className="bg-white shadow-2xl p-[0.3in] border-t-8 border-indigo-600 w-full max-w-[1200px] border border-gray-300">
        <table className="w-full border-collapse border-2 border-black">
          <tbody>
            {/* ── Header rows ── */}
            <tr>
              <RowHeaderCell text="సంఘం స్థాయిలో జరిగిన ఆర్థిక లావాదేవీలు" colSpan={4} center bold />
              <RowHeaderCell text="గత నెల (.........................) బ్యాంక్ నిల్వలు" colSpan={6} center bold />
            </tr>
            <tr>
              <RowHeaderCell text="సంఘానికి వచ్చిన వివరములు" center bold />
              <RowHeaderCell text="మొత్తం రూ." center bold />
              <RowHeaderCell text="సంఘం చెల్లించిన వివరములు" center bold />
              <RowHeaderCell text="మొత్తం రూ." center bold />
              <RowHeaderCell text="ఖాతా వివరము" small />
              <RowHeaderCell text="తేది నాటికి" center small />
              <RowHeaderCell text="రూ." center colSpan={4} small />
            </tr>

            {/* ── R3-R5: Savings / Investments ── */}
            {[
              { t1: "సంఘానికి వచ్చిన పొదుపు మొత్తం", id1: 10, t2: "సంఘం పెట్టుబడులు", id2: 12, label: "చేతి నిల్వ", idV1: 14, idV2: 15, bold1: true, center1: true, brown1: true, bold2: true, center2: true, brown2: true },

              { t1: "పొదుపులు (SN+VO+Other Saving)", id1: 17, t2: "VO లో కట్టిన వాటాధనం", id2: 19, label: "పొదుపు ఖాతా", idV1: 21, idV2: 22 },

              { t1: "సంఘానికి వచ్చిన ఫండ్స్", id1: 24, t2: "VO లో కట్టిన పొదుపు", id2: 26, label: "బ్యాంక్ లోన్ ఖాతా", idV1: 28, idV2: 29, bold1: true, center1: true, brown1: true }
            ].map((row, idx) => (
              <tr key={idx}>
                <RowHeaderCell text={row.t1} bold={row.bold1 || false} center={row.center1 || false} />
                <DataValueCell id={row.id1} idMap={idMap} isEditing={isEditing && editableIds.has(row.id1)} onEdit={handleEdit} brown={row.brown1 || false} />

                <RowHeaderCell text={row.t2} bold={row.bold2 || false} center={row.center2 || false} />
                <DataValueCell id={row.id2} idMap={idMap} isEditing={isEditing && editableIds.has(row.id2)} onEdit={handleEdit} brown={row.brown2 || false} />

                <RowHeaderCell text={row.label} />
                <DataValueCell id={row.idV1} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} />
                <DataValueCell id={row.idV2} idMap={idMap} isEditing={isEditing} onEdit={handleEdit} colSpan={4} />
              </tr>
            ))}

            {/* ── R6 ── */}
            <tr>
              <RowHeaderCell text="రివాల్వింగ్ ఫండ్" />
              <DataValueCell id={31} idMap={idMap} isEditing={isEditing && editableIds.has(31)} onEdit={handleEdit} />
              <RowHeaderCell text="శ్రీనిధి లో కట్టిన పొదుపు" />
              <DataValueCell id={33} idMap={idMap} isEditing={isEditing && editableIds.has(33)} onEdit={handleEdit} />
              <RowHeaderCell text="ఈ నెల SB A/C మరియు LOAN A/C నందు నగదు జమ వివరములు" colSpan={6} center small />
            </tr>

            {/* ── R7-R8: Amount box ── */}
            <tr>
              <RowHeaderCell text="ఆధార్ గ్రాంట్స్" />
              <DataValueCell id={36} idMap={idMap} isEditing={isEditing && editableIds.has(36)} onEdit={handleEdit} />
              <RowHeaderCell text="బ్యాంకు లో చేసిన డిపాజిట్" />
              <DataValueCell id={38} idMap={idMap} isEditing={isEditing && editableIds.has(38)} onEdit={handleEdit} />
              {/* అమౌంట్ రూ. — computed: L1 + 7 loan repayments */}
              <td rowSpan={2} className="border border-black px-2 py-1.5 align-middle bg-gray-50/50 text-center min-w-[80px]">
                <div className="font-bold text-gray-900 text-[10px]">అమౌంట్ రూ.</div>
                <div className="text-center font-mono font-black text-indigo-900 text-[13px] mt-1">
                  {amountRu !== 0 ? fmt(amountRu) : '—'}
                </div>
              </td>
              <td colSpan={5} rowSpan={2} className="border border-black p-2 text-[12px] italic text-gray-500 align-middle">
                అక్షరాల........................................................ మాత్రమే
              </td>
            </tr>
            <tr>
              <RowHeaderCell text="సంఘానికి తిరిగి వచ్చినవి" center bold />
              <DataValueCell id={42} idMap={idMap} isEditing={isEditing && editableIds.has(42)} onEdit={handleEdit} brown />
              <RowHeaderCell text="సంఘం ఖర్చులు" center bold />
              <DataValueCell id={43} idMap={idMap} isEditing={isEditing && editableIds.has(43)} onEdit={handleEdit} brown />
            </tr>

            {/* ── R9-R10: VO returns ── */}
            <tr>
              <RowHeaderCell text="VO నుండి తిరిగి వచ్చిన వాటాధనం" />
              <DataValueCell id={46} idMap={idMap} isEditing={isEditing && editableIds.has(46)} onEdit={handleEdit} />
              <RowHeaderCell text="VO కు చెల్లించిన ప్రవేశ రుసుము/సభ్యత్వ రుసుము" />
              <DataValueCell id={48} idMap={idMap} isEditing={isEditing && editableIds.has(48)} onEdit={handleEdit} />
              <RowHeaderCell text="జమ చేసిన సభ్యురాలి పేరు:....................................." colSpan={6} small />
            </tr>
            <tr>
              <RowHeaderCell text="VO నుండి తిరిగి వచ్చిన పొదుపు" />
              <DataValueCell id={51} idMap={idMap} isEditing={isEditing && editableIds.has(51)} onEdit={handleEdit} />
              <RowHeaderCell text="VO కు చెల్లించిన జరిమానాలు" />
              <DataValueCell id={53} idMap={idMap} isEditing={isEditing && editableIds.has(53)} onEdit={handleEdit} />
              <RowHeaderCell text="జమ చేసిన సభ్యురాలి సంతకం:....................................." colSpan={6} rowSpan={2} small />
            </tr>

            {/* ── R11-R12: Honorarium / Deposit ── */}
            <tr>
              <RowHeaderCell text="శ్రీనిధి నుండి తిరిగి వచ్చిన పొదుపు" />
              <DataValueCell id={56} idMap={idMap} isEditing={isEditing && editableIds.has(56)} onEdit={handleEdit} />
              <RowHeaderCell text="గౌరవవేతనం చెల్లింపు" />
              <DataValueCell id={58} idMap={idMap} isEditing={isEditing && editableIds.has(58)} onEdit={handleEdit} />
            </tr>
            <tr>
              <RowHeaderCell text="బ్యాంకు నుండి తిరిగి వచ్చిన డిపాజిట్" />
              <DataValueCell id={61} idMap={idMap} isEditing={isEditing && editableIds.has(61)} onEdit={handleEdit} />
              <RowHeaderCell text="ప్రయాణపు చార్జీల చెల్లింపు" />
              <DataValueCell id={63} idMap={idMap} isEditing={isEditing && editableIds.has(63)} onEdit={handleEdit} />
              <RowHeaderCell text="VOA సంతకం" colSpan={6} center small />
            </tr>

            {/* ── R13-R16: SHG Stamp (4 rows) ──
                             Col 1 empty slots → mirror first 4 loan repayments from Col 2
                             (read-only; edit via the Col 2 cell in the member-signatures section)
                        ── */}
            <tr>
              {/* Mirror: బ్యాంక్ లోన్ ఋణం కు చెల్లింపు ← id:89 */}
              <RowHeaderCell text="బ్యాంక్ లోన్ ఋణం కు చెల్లింపు" />
              <MirrorValueCell mirrorId={89} idMap={idMap} />
              <RowHeaderCell text="ఇతర ఖర్చులు" />
              <DataValueCell id={68} idMap={idMap} isEditing={isEditing && editableIds.has(68)} onEdit={handleEdit} />
              <td colSpan={6} rowSpan={4} className="border border-black px-2 py-1 text-center bg-gray-50/50 align-middle font-bold text-gray-700 text-[11px]">
                SHG స్టాంప్
              </td>
            </tr>
            <tr>
              {/* Mirror: స్త్రీనిధి మైక్రో ఋణం కు చెల్లింపు ← id:93 */}
              <RowHeaderCell text="స్త్రీనిధి మైక్రో ఋణం కు చెల్లింపు" />
              <MirrorValueCell mirrorId={93} idMap={idMap} />
              <RowHeaderCell text="స్టేషనరీ" />
              <DataValueCell id={72} idMap={idMap} isEditing={isEditing && editableIds.has(72)} onEdit={handleEdit} />
            </tr>
            <tr>
              {/* Mirror: శ్రీనిధి టెన్ని ఋణం కు చెల్లింపు ← id:97 */}
              <RowHeaderCell text="శ్రీనిధి టెన్ని ఋణం కు చెల్లింపు" />
              <MirrorValueCell mirrorId={97} idMap={idMap} />
              <RowHeaderCell text="ఆడిట్ ఫీజు" />
              <DataValueCell id={76} idMap={idMap} isEditing={isEditing && editableIds.has(76)} onEdit={handleEdit} />
            </tr>
            <tr>
              {/* Mirror: ఉన్నతి (SCSP) ఋణం కు చెల్లింపు ← id:101 */}
              <RowHeaderCell text="ఉన్నతి (SCSP) ఋణం కు చెల్లింపు" />
              <MirrorValueCell mirrorId={101} idMap={idMap} />
              <RowHeaderCell text="బ్యాంకు చార్జీలు" />
              <DataValueCell id={80} idMap={idMap} isEditing={isEditing && editableIds.has(80)} onEdit={handleEdit} />
            </tr>

            {/* ── Member Signatures section (rowspan 11) ──
                             Col 2 original structure preserved exactly.
                             Col 1 empty slots (95, 99, 103, 107, 111) → mirror remaining 3 loans.
                        ── */}
            <tr>
              <RowHeaderCell text="సంఘానికి వచ్చిన ఆదాయాలు" center bold />
              <DataValueCell id={83} idMap={idMap} isEditing={isEditing && editableIds.has(83)} onEdit={handleEdit} brown />
              <RowHeaderCell text="ఋణాలకు సంఘం చెల్లించిన రికవరీలు" center bold />
              <DataValueCell id={85} idMap={idMap} isEditing={isEditing && editableIds.has(85)} onEdit={handleEdit} brown />
              <td colSpan={6} rowSpan={11} className="border-2 border-black p-4 align-top bg-gray-50/50">
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
            <tr>
              <RowHeaderCell text="బ్యాంకు వడ్డీలు" />
              <DataValueCell id={87} idMap={idMap} isEditing={isEditing && editableIds.has(87)} onEdit={handleEdit} />
              <RowHeaderCell text="బ్యాంక్ లోన్ ఋణం కు చెల్లింపు" />
              <DataValueCell id={89} idMap={idMap} isEditing={isEditing && editableIds.has(89)} onEdit={handleEdit} />
            </tr>
            <tr>
              <RowHeaderCell text="డిపాజిట్ లపై వచ్చిన వడ్డీలు" />
              <DataValueCell id={91} idMap={idMap} isEditing={isEditing && editableIds.has(91)} onEdit={handleEdit} />
              <RowHeaderCell text="స్త్రీనిధి మైక్రో ఋణం కు చెల్లింపు" />
              <DataValueCell id={93} idMap={idMap} isEditing={isEditing && editableIds.has(93)} onEdit={handleEdit} />
            </tr>
            {/* Empty Col 1 slot → Mirror: ఉన్నతి (TSP) ← id:105 */}
            <tr>
              <RowHeaderCell text="ఉన్నతి (TSP) ఋణం కు చెల్లింపు" />
              <MirrorValueCell mirrorId={105} idMap={idMap} />
              <RowHeaderCell text="శ్రీనిధి టెన్ని ఋణం కు చెల్లింపు" />
              <DataValueCell id={97} idMap={idMap} isEditing={isEditing && editableIds.has(97)} onEdit={handleEdit} />
            </tr>
            {/* Empty Col 1 slot → Mirror: CIF ← id:109 */}
            <tr>
              <RowHeaderCell text="CIF ఋణం చెల్లింపు" />
              <MirrorValueCell mirrorId={109} idMap={idMap} />
              <RowHeaderCell text="ఉన్నతి (SCSP) ఋణం కు చెల్లింపు" />
              <DataValueCell id={101} idMap={idMap} isEditing={isEditing && editableIds.has(101)} onEdit={handleEdit} />
            </tr>
            {/* Empty Col 1 slot → Mirror: vo అంతర్గత ← id:113 */}
            <tr>
              <RowHeaderCell text="vo అంతర్గత ఋణం కు చెల్లింపు" />
              <MirrorValueCell mirrorId={113} idMap={idMap} />
              <RowHeaderCell text="ఉన్నతి (TSP) ఋణం కు చెల్లింపు" />
              <DataValueCell id={105} idMap={idMap} isEditing={isEditing && editableIds.has(105)} onEdit={handleEdit} />
            </tr>
            {/* Remaining empty Col 1 slots */}
            <tr>
              <RowHeaderCell text="" />
              <DataValueCell id={107} idMap={idMap} isEditing={false} onEdit={handleEdit} />
              <RowHeaderCell text="CIF ఋణం చెల్లింపు" />
              <DataValueCell id={109} idMap={idMap} isEditing={isEditing && editableIds.has(109)} onEdit={handleEdit} />
            </tr>
            <tr>
              <RowHeaderCell text="" />
              <DataValueCell id={111} idMap={idMap} isEditing={false} onEdit={handleEdit} />
              <RowHeaderCell text="vo అంతర్గత ఋణం కు చెల్లింపు" />
              <DataValueCell id={113} idMap={idMap} isEditing={isEditing && editableIds.has(113)} onEdit={handleEdit} />
            </tr>

            {/* ── బ్యాంకు నుండి తీసిన నగదు | బ్యాంకు నందు జమ చేసిన నగదు ── */}
            <tr>
              <RowHeaderCell text="బ్యాంకు నుండి తీసిన నగదు" />
              <DataValueCell
                id={115}
                idMap={idMap}
                isEditing={false}
                onEdit={handleEdit}
                computed
                value={bankCashWithdrawn !== 0 ? fmt(bankCashWithdrawn) : ''}
                orange={!totalsMatch}
              />
              <RowHeaderCell text="బ్యాంకు నందు జమ చేసిన నగదు" />
              <DataValueCell
                id={117}
                idMap={idMap}
                isEditing={false}
                onEdit={handleEdit}
                computed
                value={bankCashReceived !== 0 ? fmt(bankCashReceived) : ''}
                orange={!totalsMatch}
              />
            </tr>

            {/* ── Grand totals ── */}
            <tr>
              <RowHeaderCell text="మొత్తం రూ." bold />
              <DataValueCell
                id={119}
                idMap={idMap}
                isEditing={false}
                onEdit={handleEdit}
                computed
                value={col1Total !== 0 ? fmt(col1Total) : ''}
                orange={!totalsMatch}
              />
              <RowHeaderCell text="మొత్తం రూ." bold />
              <DataValueCell
                id={121}
                idMap={idMap}
                isEditing={false}
                onEdit={handleEdit}
                computed
                value={col2Total !== 0 ? fmt(col2Total) : ''}
                orange={!totalsMatch}
              />
            </tr>
          </tbody>
        </table>

        {/* ── Mismatch warning banner ── */}
        {!totalsMatch && (col1Total !== 0 || col2Total !== 0) && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-300 rounded-lg text-orange-700 text-[12px] font-semibold">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span>
              మొత్తాలు సరిపోలలేదు — Col 1: <strong>{fmt(col1Total)}</strong> vs Col 2: <strong>{fmt(col2Total)}</strong>
              &nbsp;(తేడా: <strong>{fmt(Math.abs(col1Total - col2Total))}</strong>)
            </span>
          </div>
        )}
      </div>

      {/* Status bar */}
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
          SHG-P2-V1.3
        </div>
      </div>
    </div>
  );
}
