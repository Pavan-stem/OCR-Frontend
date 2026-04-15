import PptxGenJS from 'pptxgenjs';
import html2pdf from 'html2pdf.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const getMonthName = (m) => MONTHS[parseInt(m) - 1] || String(m);
const DEBUG_ID_MAP = {
    "101": "VO Savings",
    "105": "VO Principal",
    "109": "Bank Interest Paid",
    "113": "Streenidhi Interest Paid"
};


const formatINR = (val) => {
    if (!val && val !== 0) return '₹0';
    const abs = Math.abs(val);
    if (abs >= 10000000) return `Rs.${(val / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `Rs.${(val / 100000).toFixed(2)} L`;
    if (abs >= 1000) return `Rs.${(val / 1000).toFixed(1)} K`;
    return `Rs.${Math.floor(val)}`;
};

const fmt = (val) => (val || 0).toLocaleString('en-IN');
const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '0%');

// ─── DOCUMENT EXPORT (Rich HTML → .pdf) ──────────────────────────────────────
export const exportAnalyticsPDF = ({ summary, paymentData, paymentTrends, historyData, trends, filters }) => {
    const reportDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const period = `${getMonthName(filters?.month)} ${filters?.year}`;
    const scope = [
        filters?.district !== 'all' ? filters.district : 'All Districts',
        filters?.mandal && filters.mandal !== 'all' ? filters.mandal : null,
        filters?.village && filters.village !== 'all' ? filters.village : null,
    ].filter(Boolean).join(' › ');

    const fs = paymentData?.financeStats || {};
    const shg = summary?.shgStats || {};
    const conv = summary?.conversion || {};
    const cc = summary?.ccActions || {};
    const lb = fs.loanRecoveryBreakdown || {};

    // Process cumulative history
    let runningBalance = 0;
    const processedHistory = (historyData || []).map(item => {
        const s = item.stats || {};
        const inflow = (s.totalLoanRecovered || 0) + (s.totalSavings || 0) + (s.totalPenalties || 0) + (s.otherSavings || 0);
        const outflow = (s.totalLoansTaken || 0) + (s.totalReturned || 0);
        const opening = runningBalance;
        const closing = opening + inflow - outflow;
        runningBalance = closing;
        return { ...item, opening, inflow, outflow, closing };
    });

    const dists = paymentData?.distributions || {};
    const topCollections = (dists.totalCollections || []).slice(0, 10);

    const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a2e; line-height: 1.5; background: white; margin: 0 auto; padding: 20px; width: 700px; box-sizing: border-box;">
    <!-- All styles are now strictly inline to prevent clashing with the main dashboard CSS -->

    <!-- ── COVER PAGE ─────────────────────────────────────────────────────────── -->
    <div style="text-align: center; padding: 60px 40px; background: #fafbff; margin-bottom: 40px; border-radius: 15px; border: 1px solid #eef2ff; box-sizing: border-box;">
      <span style="font-size: 9pt; font-weight: 800; letter-spacing: 4px; color: #6366f1; text-transform: uppercase; margin-bottom: 20px; display: block;">SHG Analytics Platform</span>
      <h1 style="font-size: 30pt; font-weight: 950; margin: 0 0 10px; color: #1e1b4b; line-height: 1.1;">Monthly Portfolio Analysis</h1>
      <div style="font-size: 14pt; color: #475569; font-weight: 500; margin-bottom: 25px;">Detailed Performance & Financial Assessment Report</div>
      <div style="font-size: 22pt; font-weight: 900; color: #ea580c; margin: 25px 0;">${period}</div>
      <div style="font-size: 10pt; color: #64748b; margin-top: 50px; border-top: 2px solid #e2e8f0; padding-top: 25px; font-weight: 600;">
        Regional Scope: <span style="color: #1e40af;">${scope}</span> <br/>
        Drafted on: ${reportDate}
      </div>
    </div>

    <!-- ── 1. EXECUTIVE SUMMARY ────────────────────────────────────────────────── -->
    <h2 style="font-size: 16pt; font-weight: 800; color: #1e3a8a; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #eff6ff;">1. Executive Summary</h2>
    <div style="background: #f0f7ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 15px; margin: 15px 0; color: #1e40af; font-size: 8.5pt; box-sizing: border-box;">
      This report outlines the performance and financial stability of Self Help Groups (SHGs) within <strong>${scope}</strong> for ${period}.
    </div>

    <div style="display: flex; gap: 10px; margin: 25px 0; box-sizing: border-box;">
      <div style="background: #1e3a8a; flex: 1; color: white; padding: 20px 15px; border-radius: 12px; text-align: center; box-sizing: border-box;">
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #bfdbfe; display: block; margin-bottom: 8px;">TOTAL SHGs</span>
        <span style="font-size: 18pt; font-weight: 900;">${fmt(shg.total)}</span>
      </div>
      <div style="background: #059669; flex: 1; color: white; padding: 20px 15px; border-radius: 12px; text-align: center; box-sizing: border-box;">
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #a7f3d0; display: block; margin-bottom: 8px;">DOCS UPLOADED</span>
        <span style="font-size: 18pt; font-weight: 900;">${fmt(shg.uploaded)}</span>
        <div style="font-size: 7.5pt; color: #d1fae5; margin-top: 5px;">${pct(shg.uploaded, shg.total)} completion</div>
      </div>
      <div style="background: #ca8a04; flex: 1; color: white; padding: 20px 15px; border-radius: 12px; text-align: center; box-sizing: border-box;">
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #fef3c7; display: block; margin-bottom: 8px;">PENDING REVIEWS</span>
        <span style="font-size: 18pt; font-weight: 900;">${fmt(shg.pending)}</span>
      </div>
    </div>

    <table style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; margin-bottom: 25px;">
      <thead><tr style="background: #1e3a8a; color: white;">
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0;">Metric</th>
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0;">Count</th>
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0;">Progress</th>
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0;">Status</th>
      </tr></thead>
      <tbody>
        ${[
          { label: 'Registered Groups', val: shg.total, rel: '100%', badge: 'Baseline', bColor: '#f1f5f9', tColor: '#475569' },
          { label: 'Successful Uploads', val: shg.uploaded, rel: pct(shg.uploaded, shg.total), badge: 'Completed', bColor: '#dcfce7', tColor: '#166534' },
          { label: 'Conversations Finalized', val: conv.converted, rel: pct(conv.converted, shg.uploaded), badge: 'Validated', bColor: '#dcfce7', tColor: '#166534' },
          { label: 'Processing Failures', val: conv.failed, rel: pct(conv.failed, shg.uploaded), badge: 'Needs Attention', bColor: '#fee2e2', tColor: '#991b1b' }
        ].map(row => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">${row.label}</td>
            <td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; border: 1px solid #e2e8f0;">${fmt(row.val)}</td>
            <td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; border: 1px solid #e2e8f0;">${row.rel}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0;"><span style="display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; background: ${row.bColor}; color: ${row.tColor};">${row.badge}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- ── 2. FINANCIAL ANALYSIS ──────────────────────────────────────────────── -->
    <h2 style="font-size: 16pt; font-weight: 800; color: #1e3a8a; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #eff6ff; page-break-before: always;">2. Financial Performance Overiview</h2>
    <div style="background: #f0f7ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 15px; margin: 15px 0; color: #1e40af; font-size: 8.5pt; box-sizing: border-box;">
      Consolidated financial position across all reporting groups. Values are formatted in Indian National Rupees (INR).
    </div>
    
    <div style="display: flex; gap: 10px; margin: 25px 0; box-sizing: border-box;">
      <div style="background: #0f172a; flex: 1; color: white; padding: 20px 15px; border-radius: 12px; text-align: center; box-sizing: border-box;">
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 8px;">GROSS COLLECTIONS</span>
        <span style="font-size: 18pt; font-weight: 900;">${formatINR(fs.totalLoanRecovered)}</span>
      </div>
      <div style="background: #1e40af; flex: 1; color: white; padding: 20px 15px; border-radius: 12px; text-align: center; box-sizing: border-box;">
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #bfdbfe; display: block; margin-bottom: 8px;">MEMBER DEPOSITS</span>
        <span style="font-size: 18pt; font-weight: 900;">${formatINR(fs.totalSavings)}</span>
      </div>
      <div style="background: #9f1239; flex: 1; color: white; padding: 20px 15px; border-radius: 12px; text-align: center; box-sizing: border-box;">
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #fecaca; display: block; margin-bottom: 8px;">LOANS DISBURSED</span>
        <span style="font-size: 18pt; font-weight: 900;">${formatINR(fs.totalLoansTaken)}</span>
      </div>
    </div>

    <table style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; margin-bottom: 25px;">
      <thead><tr style="background: #1e3a8a; color: white;">
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; border: 1px solid #e2e8f0;">Category</th>
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; border: 1px solid #e2e8f0;">Current Value</th>
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; border: 1px solid #e2e8f0;">Account Type</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">Loan Collections</td><td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; color: #059669; border: 1px solid #e2e8f0;">${formatINR(fs.totalLoanRecovered)}</td><td style="padding: 9px 10px; border: 1px solid #e2e8f0;">Inflow</td></tr>
        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">Savings Deposits</td><td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; color: #1e40af; border: 1px solid #e2e8f0;">${formatINR(fs.totalSavings)}</td><td style="padding: 9px 10px; border: 1px solid #e2e8f0;">Deposit</td></tr>
        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">Loans Sanctioned</td><td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; color: #dc2626; border: 1px solid #e2e8f0;">-${formatINR(fs.totalLoansTaken)}</td><td style="padding: 9px 10px; border: 1px solid #e2e8f0;">Outflow</td></tr>
        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">Late Surcharges</td><td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; color: #d97706; border: 1px solid #e2e8f0;">${formatINR(fs.totalPenalties)}</td><td style="padding: 9px 10px; border: 1px solid #e2e8f0;">Income</td></tr>
        <tr style="background: #f8fafc; font-weight: bold;">
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0;">NET SURPLUS</td>
            <td style="padding: 9px 10px; text-align: right; font-size: 12pt; color: #0f172a; border: 1px solid #e2e8f0;">${formatINR((fs.totalLoanRecovered || 0) + (fs.totalSavings || 0) - (fs.totalLoansTaken || 0))}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0;">Portfolio Growth</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #eff6ff; border-left: 4px solid #1e40af; border-radius: 6px; padding: 12px 15px; margin: 15px 0; color: #1e40af; font-size: 8.5pt; box-sizing: border-box;">
       <strong>System Observations:</strong>
       <ul style="margin: 5px 0 0 15px; padding: 0;">
         <li>Recovery Efficiency: ${fs.totalLoansTaken > 0 ? ((fs.totalLoanRecovered / fs.totalLoansTaken) * 100).toFixed(1) + '%' : '100%'}.</li>
         <li>Monthly contribution stability remains within healthy threshold.</li>
       </ul>
    </div>

    </div>

    <!-- ── 3. MANUAL LEDGER SUMMARY (Page 2) ────────────────────────────────── -->
    <h2 style="font-size: 16pt; font-weight: 800; color: #1e3a8a; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #eff6ff; page-break-before: always;">3. Manual Ledger Summary</h2>
    <div style="background: #f0f7ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 15px; margin: 15px 0; color: #1e40af; font-size: 8.5pt; box-sizing: border-box;">
      Specialized financial indicators from manual ledger records for ${period}.
    </div>

    <table style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; margin-bottom: 25px;">
      <thead><tr style="background: #0f172a; color: white;">
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; border: 1px solid #e2e8f0;">Category</th>
        <th style="padding: 10px 8px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; border: 1px solid #e2e8f0;">Amount</th>
      </tr></thead>
      <tbody>
        ${(() => {
            const p2 = fs.page2Finance || {};
            const items = [
                { label: 'Savings Received', val: p2.savingsReceived, color: '#1e40af' },
                { label: 'Funds Received', val: p2.fundsReceived, color: '#1e40af' },
                { label: 'Group Investments', val: p2.investments, color: '#ca8a04' },
                { label: 'Recoveries Received', val: p2.recoveriesReceived, color: '#059669' },
                { label: 'Group Expenses', val: p2.expenses, color: '#dc2626' },
                { label: 'Group Incomes', val: p2.incomesReceived, color: '#059669' },
                { label: 'Loan Recoveries Paid', val: p2.loanRecoveriesPaid, color: '#dc2626' }
            ];
            return items.filter(i => i.val > 0 || i.val === 0).map(row => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">${row.label}</td>
                    <td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; color: ${row.color}; border: 1px solid #e2e8f0;">${formatINR(row.val)}</td>
                </tr>
            `).join('');
        })()}
      </tbody>
    </table>

    <!-- ── 4. REGIONAL PERFORMANCE ────────────────────────────────────────────── -->
    <h2 style="font-size: 16pt; font-weight: 800; color: #1e3a8a; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #eff6ff; page-break-before: always;">4. Regional Performance (Top 10)</h2>
    ${topCollections.length > 0 ? `
    <table style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; margin-bottom: 25px;">
      <thead><tr style="background: #1e3a8a; color: white;">
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Rank</th>
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Regional Details</th>
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Volume</th>
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Share (%)</th>
      </tr></thead>
      <tbody>
        ${topCollections.map((d, i) => {
            const total = (paymentData?.distributions?.totalCollections || []).reduce((a, b) => a + (b.value || 0), 0) || 1;
            const share = (d.value / total) * 100;
            return `<tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 9px 10px; border: 1px solid #e2e8f0;">${i + 1}</td>
              <td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">${d.name}</td>
              <td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; color: #059669; border: 1px solid #e2e8f0;">${formatINR(d.value)}</td>
              <td style="padding: 9px 10px; text-align: right; border: 1px solid #e2e8f0;">${share.toFixed(1)}%</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<div style="color: #94a3b8; font-size: 9pt; font-style: italic; padding: 20px;">No regional statistical distribution recorded.</div>'}

    <!-- ── 5. RECOMMENDATIONS ──────────────────────────────────────────────────── -->
    <h2 style="font-size: 16pt; font-weight: 800; color: #1e3a8a; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #eff6ff;">5. Critical Recommendations</h2>
    <table style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; margin-bottom: 25px;">
      <thead><tr style="background: #1e3a8a; color: white;">
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Action Item</th>
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Unit Count</th>
        <th style="padding: 10px 8px; border: 1px solid #e2e8f0;">Priority</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">Awaiting Field Upload</td><td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; border: 1px solid #e2e8f0;">${fmt(shg.pending || 0)}</td><td style="padding: 9px 10px; text-align: center; border: 1px solid #e2e8f0;"><span style="display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; background: #fee2e2; color: #9f1239;">HIGH</span></td></tr>
        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 9px 10px; font-weight: 600; border: 1px solid #e2e8f0;">Failed Processing Audit</td><td style="padding: 9px 10px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; border: 1px solid #e2e8f0;">${fmt(conv.failed || 0)}</td><td style="padding: 9px 10px; text-align: center; border: 1px solid #e2e8f0;"><span style="display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; background: #fee2e2; color: #9f1239;">URGENT</span></td></tr>
      </tbody>
    </table>

    <div style="color: #94a3b8; font-size: 8pt; text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 15px; box-sizing: border-box;">
      <strong>OFFICIAL ANALYTICS RECORD</strong> <br/>
      Generated by SHG Intelligence Engine &copy; ${new Date().getFullYear()} <br/>
      Period: ${period} | Region: ${scope}
    </div>
</div>`;

    const opt = {
        margin: 10,
        filename: `Official_SHG_Report_${period.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800, 
            scrollY: 0,
            scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(html).save().catch(err => {
        console.error('PDF library Error:', err);
    });
};



// ─── DOCUMENT EXPORT (Rich HTML → .doc) ──────────────────────────────────────
export const exportAnalyticsDoc = ({ summary, paymentData, paymentTrends, historyData, trends, filters }) => {
    const reportDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const period = `${getMonthName(filters?.month)} ${filters?.year}`;
    const scope = [
        filters?.district !== 'all' ? filters.district : 'All Districts',
        filters?.mandal && filters.mandal !== 'all' ? filters.mandal : null,
        filters?.village && filters.village !== 'all' ? filters.village : null,
    ].filter(Boolean).join(' › ');

    const fs = paymentData?.financeStats || {};
    const shg = summary?.shgStats || {};
    const conv = summary?.conversion || {};
    const cc = summary?.ccActions || {};
    const lb = fs.loanRecoveryBreakdown || {};

    // Process cumulative history
    let runningBalance = 0;
    const processedHistory = (historyData || []).map(item => {
        const s = item.stats || {};
        const inflow = (s.totalLoanRecovered || 0) + (s.totalSavings || 0) + (s.totalPenalties || 0) + (s.otherSavings || 0);
        const outflow = (s.totalLoansTaken || 0) + (s.totalReturned || 0);
        const opening = runningBalance;
        const closing = opening + inflow - outflow;
        runningBalance = closing;
        return { ...item, opening, inflow, outflow, closing };
    });

    // Distributions
    const dists = paymentData?.distributions || {};
    const distKey = paymentData?.distKey || 'region';
    const topCollections = (dists.totalCollections || []).slice(0, 10);
    const topDeposits = (dists.memberDeposits || []).slice(0, 10);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 2.5cm; }
  body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.6; margin: 0; }
  
  .cover { text-align: center; padding: 60px 40px; background-color: #eef2ff; page-break-after: always; }
  .cover-logo { font-size: 12pt; font-weight: bold; letter-spacing: 4px; color: #6b7280; text-transform: uppercase; margin-bottom: 30px; display: block; }
  .cover h1 { font-size: 36pt; font-weight: 900; margin: 0 0 12px; line-height: 1.1; color: #1e1b4b; }
  .cover .subtitle { font-size: 20pt; color: #111827; font-weight: bold; margin-bottom: 12px; }
  .cover .meta { font-size: 11pt; color: #111827; font-weight: bold; margin-top: 36px; border-top: 2px solid #c7d2fe; padding-top: 16px; }
  .cover .period { font-size: 26pt; font-weight: bold; color: #d97706; margin: 20px 0; }

  h2 { font-size: 18pt; font-weight: bold; color: #1e40af; border-left: 5px solid #4f46e5; padding-left: 14px; margin: 30px 0 16px; page-break-before: always; }
  h2.no-break { page-break-before: avoid; }
  h3 { font-size: 13pt; font-weight: bold; color: #1e40af; margin: 20px 0 10px; }

  .section-intro { background: #f0f4ff; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 10.5pt; color: #374151; border-left: 3px solid #6366f1; }

  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt; }
  th { background: #1e40af; color: white; padding: 10px 14px; text-align: left; font-weight: bold; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 9px 14px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f8faff; }
  tr:hover td { background: #eef2ff; }
  .num { text-align: right; font-weight: bold; }
  .label { font-weight: bold; color: #374151; }

  .kpi-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 10px; margin: 20px 0; }
  .kpi-row { display: table-row; }
  .kpi { display: table-cell; width: 33.33%; background-color: #1e3a8a; color: white; padding: 18px; border-radius: 8px; text-align: center; vertical-align: middle; }
  .kpi .k-label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; display: block; margin-bottom: 6px; }
  .kpi .k-value { font-size: 22pt; font-weight: 900; display: block; color: #ffffff; }
  .kpi .k-sub { font-size: 8pt; color: #bfdbfe; margin-top: 3px; display: block; }

  .kpi-green { background-color: #065f46; }
  .kpi-amber { background-color: #92400e; }
  .kpi-rose { background-color: #9f1239; }

  .finance-table th { background: #0f172a; }
  .highlight-row td { background: #fef3c7 !important; font-weight: bold; color: #92400e; }
  .total-row td { background: #1e3a8a !important; color: white !important; font-weight: bold; }

  .bar-container { display: flex; align-items: center; gap: 6px; overflow: hidden; max-width: 160px; }
  .bar { height: 12px; border-radius: 3px; display: inline-block; min-width: 2px; max-width: 90px; flex-shrink: 0; }
  .bar-label { font-size: 9pt; color: #374151; min-width: 60px; }
  .bar-value { font-size: 9pt; font-weight: bold; color: #1e40af; white-space: nowrap; }

  .badge { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 8.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #9f1239; }
  .badge-indigo { background: #e0e7ff; color: #3730a3; }

  .insight-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 14px 0; font-size: 10pt; color: #1e40af; }
  .insight-box strong { display: block; margin-bottom: 6px; font-size: 11pt; }
  .insight-box ul { margin: 0; padding-left: 20px; }
  .insight-box li { margin-bottom: 4px; }

  .footer { position: fixed; bottom: 1cm; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .page-break { page-break-before: always; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-emerald { color: #059669; font-weight: bold; }
  .text-rose { color: #dc2626; font-weight: bold; }
  .text-indigo { color: #4338ca; font-weight: bold; }
  .text-amber { color: #d97706; font-weight: bold; }
</style>
</head>
<body>

<!-- ── COVER PAGE ─────────────────────────────────────────────────────────── -->
<div class="cover">
  <div class="cover-logo">SHG Analytics Platform</div>
  <h1>Analytics Report</h1>
  <div class="subtitle">Self Help Group Performance &amp; Financial Overview</div>
  <div class="period">${period}</div>
  <div class="meta">
    <strong>Scope:</strong> ${scope || 'All Regions'} &nbsp;|&nbsp;
    <strong>Generated:</strong> ${reportDate}
  </div>
</div>

<!-- ── 1. EXECUTIVE SUMMARY ────────────────────────────────────────────────── -->
<h2 class="no-break">1. Executive Summary</h2>
<div class="section-intro">
  This section provides a high-level overview of SHG performance for <strong>${period}</strong>. 
  It covers upload activity, conversion status, and an aggregated view of the financial standing across all groups.
</div>

<table width="100%" cellpadding="0" cellspacing="8" style="border-collapse:separate;margin:20px 0;">
  <tr>
    <td width="33%" bgcolor="#1e3a8a" style="background-color:#1e3a8a;padding:20px 12px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;margin-bottom:8px;">Total SHGs</div>
      <div style="font-size:26pt;font-weight:900;color:#ffffff;line-height:1;">${fmt(shg.total || 0)}</div>
      <div style="font-size:8pt;color:#bfdbfe;margin-top:6px;">Registered Groups</div>
    </td>
    <td width="4" style="font-size:1pt;">&nbsp;</td>
    <td width="33%" bgcolor="#065f46" style="background-color:#065f46;padding:20px 12px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#6ee7b7;margin-bottom:8px;">Uploaded</div>
      <div style="font-size:26pt;font-weight:900;color:#ffffff;line-height:1;">${fmt(shg.uploaded || 0)}</div>
      <div style="font-size:8pt;color:#a7f3d0;margin-top:6px;">${pct(shg.uploaded, shg.total)} of Total</div>
    </td>
    <td width="4" style="font-size:1pt;">&nbsp;</td>
    <td width="33%" bgcolor="#92400e" style="background-color:#92400e;padding:20px 12px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#fcd34d;margin-bottom:8px;">Pending Upload</div>
      <div style="font-size:26pt;font-weight:900;color:#ffffff;line-height:1;">${fmt(shg.pending || 0)}</div>
      <div style="font-size:8pt;color:#fde68a;margin-top:6px;">${pct(shg.pending, shg.total)} Remaining</div>
    </td>
  </tr>
</table>

<h3>Upload &amp; Conversion Status Breakdown</h3>
<table>
  <thead><tr>
    <th>Metric</th><th>Count</th><th>% of Total</th><th>Status</th>
  </tr></thead>
  <tbody>
    <tr><td class="label">Total SHGs Registered</td><td class="num">${fmt(shg.total || 0)}</td><td class="num">100%</td><td class="text-center"><span class="badge badge-indigo">Baseline</span></td></tr>
    <tr><td class="label">Documents Uploaded</td><td class="num">${fmt(shg.uploaded || 0)}</td><td class="num">${pct(shg.uploaded, shg.total)}</td><td class="text-center"><span class="badge badge-green">Completed</span></td></tr>
    <tr><td class="label">Uploads Pending</td><td class="num">${fmt(shg.pending || 0)}</td><td class="num">${pct(shg.pending, shg.total)}</td><td class="text-center"><span class="badge badge-amber">Action Needed</span></td></tr>
    <tr><td class="label">Conversion Successful</td><td class="num">${fmt(conv.converted || 0)}</td><td class="num">${pct(conv.converted, shg.uploaded)}</td><td class="text-center"><span class="badge badge-green">Done</span></td></tr>
    <tr><td class="label">Conversion Pending</td><td class="num">${fmt(conv.pending || 0)}</td><td class="num">${pct(conv.pending, shg.uploaded)}</td><td class="text-center"><span class="badge badge-amber">In Queue</span></td></tr>
    <tr><td class="label">Conversion Processing</td><td class="num">${fmt(conv.processing || 0)}</td><td class="num">${pct(conv.processing, shg.uploaded)}</td><td class="text-center"><span class="badge badge-indigo">Processing</span></td></tr>
    <tr><td class="label">Conversion Failed</td><td class="num">${fmt(conv.failed || 0)}</td><td class="num">${pct(conv.failed, shg.uploaded)}</td><td class="text-center"><span class="badge badge-red">Failed</span></td></tr>
  </tbody>
</table>

${summary ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:collapse;">
  <tr><td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;color:#1e40af;font-size:10pt;">
    <strong style="display:block;margin-bottom:8px;font-size:11pt;color:#1e40af;">Key Observations — Uploads</strong>
    <table width="100%" cellpadding="2" cellspacing="0" style="border:none;">
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Upload completion rate is <strong>${pct(shg.uploaded, shg.total)}</strong> — ${(shg.uploaded / Math.max(shg.total, 1) * 100) >= 80 ? 'above 80%, indicating strong field activity.' : 'below 80%, indicating opportunity to push field activity.'}</td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- ${fmt(shg.pending || 0)} SHGs still need to upload their documents for ${period}.</td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Conversion success rate (of uploaded): <strong>${pct(conv.converted, shg.uploaded)}</strong></td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- ${fmt(conv.failed || 0)} records have failed conversion and may require re-upload or manual review.</td></tr>
    </table>
  </td></tr>
</table>` : ''}

<!-- ── 2. FINANCIAL PERFORMANCE ────────────────────────────────────────────── -->
<h2>2. Financial Performance Overview</h2>
<div class="section-intro">
  This section covers all key financial indicators for <strong>${period}</strong>, including collections, savings deposits, loans sanctioned, savings withdrawals, and late penalties.
</div>

<table width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate;margin:20px 0;">
  <tr>
    <td width="24%" bgcolor="#1e3a8a" style="background-color:#1e3a8a;padding:18px 10px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;margin-bottom:8px;">Total Collections</div>
      <div style="font-size:18pt;font-weight:900;color:#ffffff;line-height:1.1;">${formatINR(fs.totalLoanRecovered)}</div>
      <div style="font-size:7.5pt;color:#bfdbfe;margin-top:6px;">Loan Repayments Received</div>
    </td>
    <td width="2" style="font-size:1pt;">&nbsp;</td>
    <td width="24%" bgcolor="#065f46" style="background-color:#065f46;padding:18px 10px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#6ee7b7;margin-bottom:8px;">Member Deposits</div>
      <div style="font-size:18pt;font-weight:900;color:#ffffff;line-height:1.1;">${formatINR(fs.totalSavings)}</div>
      <div style="font-size:7.5pt;color:#a7f3d0;margin-top:6px;">Monthly Savings</div>
    </td>
    <td width="2" style="font-size:1pt;">&nbsp;</td>
    <td width="24%" bgcolor="#7f1d1d" style="background-color:#7f1d1d;padding:18px 10px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#fca5a5;margin-bottom:8px;">Loans Sanctioned</div>
      <div style="font-size:18pt;font-weight:900;color:#ffffff;line-height:1.1;">${formatINR(fs.totalLoansTaken)}</div>
      <div style="font-size:7.5pt;color:#fecaca;margin-top:6px;">${fmt(fs.loanCount || 0)} Loans Disbursed</div>
    </td>
    <td width="2" style="font-size:1pt;">&nbsp;</td>
    <td width="24%" bgcolor="#78350f" style="background-color:#78350f;padding:18px 10px;border-radius:8px;text-align:center;vertical-align:middle;">
      <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#fcd34d;margin-bottom:8px;">Late Penalties</div>
      <div style="font-size:18pt;font-weight:900;color:#ffffff;line-height:1.1;">${formatINR(fs.totalPenalties)}</div>
      <div style="font-size:7.5pt;color:#fde68a;margin-top:6px;">Deferred Surcharges</div>
    </td>
  </tr>
</table>

<h3>Detailed Financial Metrics</h3>
<table class="finance-table">
  <thead><tr>
    <th>Financial Category</th><th>Amount</th><th>Interpretation</th>
  </tr></thead>
  <tbody>
    <tr><td class="label">Total Collections (Loan Repayments)</td><td class="num text-emerald">${formatINR(fs.totalLoanRecovered)}</td><td>Sum of all loan recovery inflows</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— Bank Loan Recovered</td><td class="num">${formatINR(lb.bankLoan)}</td><td>Institutional bank loan recoveries</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— SHG Internal Loan</td><td class="num">${formatINR(lb.shgInternal)}</td><td>Internal group lending repayments</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— Streenidhi Micro</td><td class="num">${formatINR(lb.streenidhiMicro)}</td><td>Streenidhi micro-finance recoveries</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— Streenidhi Tenny</td><td class="num">${formatINR(lb.streenidhiTenni)}</td><td>Streenidhi tenny scheme recoveries</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— Unnati SCSP</td><td class="num">${formatINR(lb.unnatiSCSP)}</td><td>Unnati SCSP loan recoveries</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— Unnati TSP</td><td class="num">${formatINR(lb.unnatiTSP)}</td><td>Unnati TSP loan recoveries</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— CIF Loan</td><td class="num">${formatINR(lb.cif)}</td><td>CIF scheme loan recoveries</td></tr>
    <tr><td class="label">&nbsp;&nbsp;&nbsp;— VO Internal</td><td class="num">${formatINR(lb.voInternal)}</td><td>Village Organisation internal lending</td></tr>
    <tr><td class="label">Member Savings Deposits</td><td class="num text-emerald">${formatINR(fs.totalSavings)}</td><td>Monthly savings from members</td></tr>
    <tr><td class="label">Savings Withdrawals</td><td class="num text-rose">${formatINR(fs.totalReturned)}</td><td>Amount returned to members</td></tr>
    <tr><td class="label">Loans Sanctioned (Capital Outflow)</td><td class="num text-rose">${formatINR(fs.totalLoansTaken)}</td><td>${fmt(fs.loanCount || 0)} new loans disbursed</td></tr>
    <tr><td class="label">Late Payment Penalties</td><td class="num text-amber">${formatINR(fs.totalPenalties)}</td><td>Surcharges on delayed payments</td></tr>
  </tbody>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:collapse;">
  <tr><td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;color:#1e40af;font-size:10pt;">
    <strong style="display:block;margin-bottom:8px;font-size:11pt;color:#1e40af;">Financial Analysis Notes</strong>
    <table width="100%" cellpadding="2" cellspacing="0" style="border:none;">
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Net Cash Position: <strong>${formatINR((fs.totalLoanRecovered || 0) + (fs.totalSavings || 0) - (fs.totalLoansTaken || 0) - (fs.totalReturned || 0))}</strong> (Total Inflow minus Total Outflow)</td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Collection-to-Loan Ratio: <strong>${fs.totalLoansTaken > 0 ? ((fs.totalLoanRecovered / fs.totalLoansTaken) * 100).toFixed(1) + '%' : 'N/A'}</strong> — measures repayment efficiency against disbursements</td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Average Loan Ticket Size: <strong>${fs.loanCount > 0 ? formatINR(Math.round(fs.totalLoansTaken / fs.loanCount)) : 'N/A'}</strong></td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Penalty Rate: <strong>${fs.totalLoansTaken > 0 ? ((fs.totalPenalties / fs.totalLoansTaken) * 100).toFixed(2) + '%' : '0%'}</strong> of total loans sanctioned</td></tr>
    </table>
  </td></tr>
</table>

<!-- ── 3. MANUAL LEDGER SUMMARY (Page 2) ────────────────────────────────── -->
<h2>3. Manual Ledger Summary</h2>
<div class="section-intro">
  This section outlines specialized financial indicators from manual ledger records for <strong>${period}</strong>, covering collective savings, funds, investments, and operational expenses.
</div>

<table class="finance-table">
  <thead><tr>
    <th>Page 2 Financial Category</th><th>Amount</th><th>Type</th>
  </tr></thead>
  <tbody>
    ${(() => {
        const p2 = fs.page2Finance || {};
        const items = [
            { label: 'Savings Received', val: p2.savingsReceived, type: 'Inflow', color: 'text-indigo' },
            { label: 'Funds Received', val: p2.fundsReceived, type: 'Inflow', color: 'text-indigo' },
            { label: 'Group Investments', val: p2.investments, type: 'Asset', color: 'text-amber' },
            { label: 'Recoveries Received', val: p2.recoveriesReceived, type: 'Inflow', color: 'text-emerald' },
            { label: 'Group Expenses', val: p2.expenses, type: 'Outflow', color: 'text-rose' },
            { label: 'Group Incomes', val: p2.incomesReceived, type: 'Income', color: 'text-emerald' },
            { label: 'Loan Recoveries Paid', val: p2.loanRecoveriesPaid, type: 'Outflow', color: 'text-rose' }
        ];
        return items.filter(i => i.val > 0 || i.val === 0).map(row => `
            <tr>
                <td class="label">${row.label}</td>
                <td class="num ${row.color}">${formatINR(row.val)}</td>
                <td>${row.type}</td>
            </tr>
        `).join('');
    })()}
  </tbody>
</table>

<!-- ── 4. REGIONAL CONTRIBUTION ────────────────────────────────────────────── -->
<h2>4. Regional Contribution Analysis</h2>
<div class="section-intro">
  The following tables show the top contributing ${distKey || 'regions'} by financial category for ${period}. This helps identify which regions are leading in collections, deposits, and other key metrics.
</div>

${topCollections.length > 0 ? `
<h3>Top Regions — Collections (Loan Repayments)</h3>
<table>
  <thead><tr><th>#</th><th>Region</th><th>Collections Amount</th><th>Share</th></tr></thead>
  <tbody>
    ${topCollections.map((d, i) => {
        const total = topCollections.reduce((a, b) => a + (b.value || 0), 0);
        const barW = Math.round((d.value / Math.max(total, 1)) * 80);
        return `<tr>
      <td class="text-center num">${i + 1}</td>
      <td class="label">${d.name || '—'}</td>
      <td class="num text-emerald">${formatINR(d.value)}</td>
      <td><div class="bar-container"><div class="bar" style="width:${barW}px;background:#10b981;"></div><span class="bar-value">${pct(d.value, total)}</span></div></td>
    </tr>`;
    }).join('')}
  </tbody>
</table>` : '<p style="color:#9ca3af;font-style:italic;">No regional collections data available for this period.</p>'}

${topDeposits.length > 0 ? `
<h3>Top Regions — Member Deposits (Savings)</h3>
<table>
  <thead><tr><th>#</th><th>Region</th><th>Deposits Amount</th><th>Share</th></tr></thead>
  <tbody>
    ${topDeposits.map((d, i) => {
        const total = topDeposits.reduce((a, b) => a + (b.value || 0), 0);
        const barW = Math.round((d.value / Math.max(total, 1)) * 80);
        return `<tr>
      <td class="text-center num">${i + 1}</td>
      <td class="label">${d.name || '—'}</td>
      <td class="num text-indigo">${formatINR(d.value)}</td>
      <td><div class="bar-container"><div class="bar" style="width:${barW}px;background:#6366f1;"></div><span class="bar-value">${pct(d.value, total)}</span></div></td>
    </tr>`;
    }).join('')}
  </tbody>
</table>` : ''}

<!-- ── 5. MONTHLY TRENDS ────────────────────────────────────────────────────── -->
${paymentTrends && paymentTrends.length > 0 ? `
<h2>5. Monthly Financial Trends</h2>
<div class="section-intro">
  This section tracks financial activity month-over-month, helping identify growth patterns, seasonal peaks, and months requiring attention.
</div>
<table class="finance-table">
  <thead><tr>
    <th>Month</th><th>Collections</th><th>Deposits</th><th>Loans</th><th>Withdrawals</th><th>Penalties</th>
  </tr></thead>
  <tbody>
    ${paymentTrends.map((t, i) => `
    <tr>
      <td class="label">${t.month || `Month ${i + 1}`}</td>
      <td class="num text-emerald">${formatINR(t.collections)}</td>
      <td class="num text-indigo">${formatINR(t.deposits)}</td>
      <td class="num text-rose">${formatINR(t.loans)}</td>
      <td class="num text-amber">${formatINR(t.withdrawals)}</td>
      <td class="num">${formatINR(t.penalties)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:collapse;">
  <tr><td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;color:#1e40af;font-size:10pt;">
    <strong style="display:block;margin-bottom:8px;font-size:11pt;color:#1e40af;">Trend Observations</strong>
    <table width="100%" cellpadding="2" cellspacing="0" style="border:none;">
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Peak collections observed in: <strong>${(() => { const peak = [...paymentTrends].sort((a, b) => (b.collections || 0) - (a.collections || 0))[0]; return peak?.month || 'N/A'; })()}</strong></td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Highest deposits month: <strong>${(() => { const peak = [...paymentTrends].sort((a, b) => (b.deposits || 0) - (a.deposits || 0))[0]; return peak?.month || 'N/A'; })()}</strong></td></tr>
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Highest loan disbursement: <strong>${(() => { const peak = [...paymentTrends].sort((a, b) => (b.loans || 0) - (a.loans || 0))[0]; return peak?.month || 'N/A'; })()}</strong></td></tr>
    </table>
  </td></tr>
</table>` : ''}

<!-- ── 6. CUMULATIVE FINANCIAL SUMMARY ─────────────────────────────────────── -->
${processedHistory.length > 0 ? `
<h2>6. Cumulative Financial Summary (Jan – ${getMonthName(filters?.month)} ${filters?.year})</h2>
<div class="section-intro">
  This table tracks the running financial balance from January through the selected period, showing cumulative inflow, outflow, and closing position each month.
</div>
<table class="finance-table">
  <thead><tr>
    <th>Month</th><th>Opening Balance</th><th>Inflow (+)</th><th>Outflow (−)</th><th>Closing Balance</th>
  </tr></thead>
  <tbody>
    ${processedHistory.map(h => `
    <tr>
      <td class="label">${getMonthName(h.month)} ${h.year}</td>
      <td class="num">${formatINR(h.opening)}</td>
      <td class="num text-emerald">+${formatINR(h.inflow)}</td>
      <td class="num text-rose">-${formatINR(h.outflow)}</td>
      <td class="num ${h.closing >= 0 ? 'text-indigo' : 'text-rose'}">${formatINR(h.closing)}</td>
    </tr>`).join('')}
    ${processedHistory.length > 0 ? `
    <tr class="total-row">
      <td><strong>YTD Total</strong></td>
      <td class="num">—</td>
      <td class="num">+${formatINR(processedHistory.reduce((a, b) => a + (b.inflow || 0), 0))}</td>
      <td class="num">-${formatINR(processedHistory.reduce((a, b) => a + (b.outflow || 0), 0))}</td>
      <td class="num">${formatINR(processedHistory[processedHistory.length - 1]?.closing || 0)}</td>
    </tr>` : ''}
  </tbody>
</table>` : ''}

<!-- ── 7. PENDING ACTIONS ──────────────────────────────────────────────────── -->
<h2>7. Pending Actions &amp; Recommendations</h2>
<table>
  <thead><tr>
    <th>Action Item</th><th>Count</th><th>Priority</th>
  </tr></thead>
  <tbody>
    <tr><td class="label">SHG Documents Pending Upload</td><td class="num">${fmt(shg.pending || 0)}</td><td class="text-center"><span class="badge badge-red">High</span></td></tr>
    <tr><td class="label">Conversion Queue Pending</td><td class="num">${fmt(conv.pending || 0)}</td><td class="text-center"><span class="badge badge-amber">Medium</span></td></tr>
    <tr><td class="label">Conversion Processing (In Progress)</td><td class="num">${fmt(conv.processing || 0)}</td><td class="text-center"><span class="badge badge-indigo">Monitor</span></td></tr>
    <tr><td class="label">Failed Conversions (Need Re-upload)</td><td class="num">${fmt(conv.failed || 0)}</td><td class="text-center"><span class="badge badge-red">Urgent</span></td></tr>
  </tbody>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:collapse;">
  <tr><td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;color:#1e40af;font-size:10pt;">
    <strong style="display:block;margin-bottom:8px;font-size:11pt;color:#1e40af;">Recommended Next Steps</strong>
    <table width="100%" cellpadding="2" cellspacing="0" style="border:none;">
      ${(shg.pending || 0) > 0 ? `<tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Follow up on <strong>${fmt(shg.pending)}</strong> pending SHG uploads through cluster coordinators.</td></tr>` : ''}
      ${(conv.failed || 0) > 0 ? `<tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Investigate and resolve <strong>${fmt(conv.failed)}</strong> failed conversions — re-upload may be required.</td></tr>` : ''}
      ${(conv.pending || 0) > 0 ? `<tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Monitor conversion queue — <strong>${fmt(conv.pending)}</strong> documents are awaiting processing.</td></tr>` : ''}
      <tr><td style="padding:3px 0;color:#1e40af;font-size:10pt;">- Cross-check regional contribution data for outlier areas with unusually low collections.</td></tr>
    </table>
  </td></tr>
</table>

<div class="footer">
  SHG Analytics Platform &nbsp;|&nbsp; Report Generated: ${reportDate} &nbsp;|&nbsp; Period: ${period} &nbsp;|&nbsp; Scope: ${scope}
</div>

</body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Analytics_Report_${period.replace(' ', '_')}_${scope.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


// ─── PPT EXPORT ───────────────────────────────────────────────────────────────
export const exportAnalyticsPPT = async ({ summary, paymentData, paymentTrends, historyData, filters }) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5 in

    const period = `${getMonthName(filters?.month)} ${filters?.year}`;
    const scope = [
        filters?.district !== 'all' ? filters.district : 'All Districts',
        filters?.mandal && filters.mandal !== 'all' ? filters.mandal : null,
        filters?.village && filters.village !== 'all' ? filters.village : null,
    ].filter(Boolean).join(' > ');

    const fs = paymentData?.financeStats || {};
    const shg = summary?.shgStats || {};
    const conv = summary?.conversion || {};
    const cc = summary?.ccActions || {};
    const lb = fs.loanRecoveryBreakdown || {};
    const dists = paymentData?.distributions || {};
    const distKey = paymentData?.distKey || 'region';

    // Theme
    const INDIGO = '4338CA';
    const DARK_BG = '0F172A';
    const ACCENT = 'A78BFA';
    const WHITE = 'FFFFFF';
    const LIGHT_BG = 'EEF2FF';

    // ── MASTER SLIDE SETTINGS ────────────────────────────────────────────────
    const addBgRect = (slide, color = DARK_BG) => {
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color } });
    };

    const addGradientBg = (slide) => {
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '1E1B4B' } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '50%', h: '100%', fill: { color: '1E1B4B', transparency: 0 } });
        slide.addShape(pptx.ShapeType.rect, { x: 6, y: 4, w: 4, h: 4, fill: { color: '6366F1', transparency: 85 }, line: { color: '6366F1', transparency: 100 } });
    };

    const sectionLabel = (slide, text, x = 0.4, y = 0.22) => {
        slide.addText(text, {
            x, y, w: 10, h: 0.3,
            fontSize: 9, bold: true, color: ACCENT,
            charSpacing: 3, fontFace: 'Calibri',
        });
    };

    const slideTitle = (slide, text, x = 0.4, y = 0.5) => {
        slide.addText(text, {
            x, y, w: 12, h: 0.65,
            fontSize: 28, bold: true, color: WHITE, fontFace: 'Calibri',
        });
    };

    const divider = (slide, y = 1.2) => {
        slide.addShape(pptx.ShapeType.line, {
            x: 0.4, y, w: 12.4, h: 0,
            line: { color: '4338CA', width: 1.5 },
        });
    };

    // ── SLIDE 1: COVER ───────────────────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        // Accent shape
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: '100%', fill: { color: '4338CA' } });
        slide.addShape(pptx.ShapeType.rect, { x: 8.5, y: 0, w: 4.8, h: '100%', fill: { color: '1E1B4B' } });
        slide.addShape(pptx.ShapeType.ellipse, { x: 7, y: -1, w: 6, h: 6, fill: { color: '4F46E5', transparency: 80 }, line: { transparency: 100 } });

        slide.addText('SHG ANALYTICS PLATFORM', {
            x: 0.5, y: 1.4, w: 8, h: 0.4,
            fontSize: 10, bold: true, color: '818CF8', charSpacing: 4, fontFace: 'Calibri',
        });
        slide.addText('Analytics\nReport', {
            x: 0.5, y: 1.9, w: 9, h: 2.2,
            fontSize: 56, bold: true, color: WHITE, fontFace: 'Calibri', lineSpacingMultiple: 1.1,
        });
        slide.addText(`${period}  |  ${scope}`, {
            x: 0.5, y: 4.3, w: 10, h: 0.5,
            fontSize: 16, color: 'A5B4FC', fontFace: 'Calibri',
        });
        slide.addShape(pptx.ShapeType.line, { x: 0.5, y: 4.9, w: 4, h: 0, line: { color: '4338CA', width: 2 } });
        slide.addText(`Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
            x: 0.5, y: 5.15, w: 8, h: 0.3,
            fontSize: 10, color: '64748B', fontFace: 'Calibri',
        });

        // Right panel stats
        const kpiY = 1.5;
        [
            { label: 'TOTAL SHGs', val: fmt(shg.total || 0), color: 'A5B4FC' },
            { label: 'UPLOADED', val: fmt(shg.uploaded || 0), color: '6EE7B7' },
            { label: 'PENDING', val: fmt(shg.pending || 0), color: 'FCD34D' },
            { label: 'CONVERTED', val: fmt(conv.converted || 0), color: 'C4B5FD' },
        ].forEach((k, i) => {
            slide.addShape(pptx.ShapeType.rect, {
                x: 9.3, y: kpiY + i * 1.45, w: 3.5, h: 1.25,
                fill: { color: '1E1B4B' }, line: { color: '4338CA', width: 1 }, rounding: true,
            });
            slide.addText(k.label, { x: 9.5, y: kpiY + i * 1.45 + 0.1, w: 3.1, h: 0.3, fontSize: 8, bold: true, color: k.color, charSpacing: 2, fontFace: 'Calibri' });
            slide.addText(k.val, { x: 9.5, y: kpiY + i * 1.45 + 0.38, w: 3.1, h: 0.65, fontSize: 30, bold: true, color: WHITE, fontFace: 'Calibri' });
        });
    }

    // ── SLIDE 2: AGENDA ──────────────────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '1E1B4B');
        sectionLabel(slide, 'AGENDA');
        slideTitle(slide, 'What We Cover Today');
        divider(slide);

        const items = [
            { num: '01', title: 'Executive Summary', desc: 'Upload status, conversion overview, APM activity' },
            { num: '02', title: 'Financial Performance', desc: 'Collections, deposits, loans, penalties' },
            { num: '03', title: 'Manual Ledger Summary', desc: 'Specialized Page 2 financial indicators' },
            { num: '04', title: 'Regional Contribution', desc: 'Top performing districts, mandals, villages' },
            { num: '05', title: 'Monthly Trends', desc: 'Month-over-month financial activity analysis' },
            { num: '06', title: 'Cumulative Summary', desc: 'Running balance from Jan to current month' },
            { num: '07', title: 'Pending Actions', desc: 'Key follow-ups and recommendations' },
        ];

        items.forEach((item, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = col === 0 ? 0.4 : 6.9;
            const y = 1.4 + row * 1.4;

            slide.addShape(pptx.ShapeType.rect, {
                x, y, w: 5.9, h: 1.25,
                fill: { color: '1E3A8A', transparency: 20 }, line: { color: '4338CA', width: 1 }, rounding: true,
            });
            slide.addText(item.num, { x: x + 0.2, y: y + 0.12, w: 0.7, h: 0.5, fontSize: 22, bold: true, color: '818CF8', fontFace: 'Calibri' });
            slide.addText(item.title, { x: x + 0.95, y: y + 0.1, w: 4.7, h: 0.45, fontSize: 13, bold: true, color: WHITE, fontFace: 'Calibri' });
            slide.addText(item.desc, { x: x + 0.95, y: y + 0.55, w: 4.7, h: 0.6, fontSize: 10, color: 'A5B4FC', fontFace: 'Calibri' });
        });
    }

    // ── SLIDE 3: EXECUTIVE SUMMARY ───────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '01  ·  EXECUTIVE SUMMARY');
        slideTitle(slide, `SHG Performance — ${period}`);
        divider(slide);

        // KPI Cards Row 1
        const kpis = [
            { label: 'TOTAL SHGs', val: fmt(shg.total || 0), sub: 'Registered', color: '4338CA', accent: 'A5B4FC' },
            { label: 'UPLOADED', val: fmt(shg.uploaded || 0), sub: pct(shg.uploaded, shg.total) + ' of Total', color: '065F46', accent: '6EE7B7' },
            { label: 'PENDING', val: fmt(shg.pending || 0), sub: pct(shg.pending, shg.total) + ' Remaining', color: '92400E', accent: 'FCD34D' },
            { label: 'CONVERTED', val: fmt(conv.converted || 0), sub: pct(conv.converted, shg.uploaded) + ' Rate', color: '5B21B6', accent: 'C4B5FD' },
        ];
        kpis.forEach((k, i) => {
            const x = 0.4 + i * 3.2;
            slide.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 3, h: 2, fill: { color: k.color }, line: { transparency: 100 }, rounding: true });
            slide.addText(k.label, { x, y: 1.62, w: 3, h: 0.3, align: 'center', fontSize: 9, bold: true, color: k.accent, charSpacing: 2, fontFace: 'Calibri' });
            slide.addText(k.val, { x, y: 2.0, w: 3, h: 0.8, align: 'center', fontSize: 32, bold: true, color: WHITE, fontFace: 'Calibri' });
            slide.addText(k.sub, { x, y: 2.9, w: 3, h: 0.4, align: 'center', fontSize: 10, color: k.accent, fontFace: 'Calibri' });
        });

        // Conversion breakdown table
        slide.addText('CONVERSION STATUS', { x: 0.4, y: 3.75, w: 6, h: 0.3, fontSize: 9, bold: true, color: ACCENT, charSpacing: 3, fontFace: 'Calibri' });
        const convRows = [
            [{ text: 'Status', options: { bold: true, color: WHITE } }, { text: 'Count', options: { bold: true, color: WHITE, align: 'right' } }, { text: 'Rate', options: { bold: true, color: WHITE, align: 'right' } }],
            [{ text: 'Converted ✓' }, { text: fmt(conv.converted || 0), options: { align: 'right' } }, { text: pct(conv.converted, shg.uploaded), options: { align: 'right', color: '10B981' } }],
            [{ text: 'Pending ⏳' }, { text: fmt(conv.pending || 0), options: { align: 'right' } }, { text: pct(conv.pending, shg.uploaded), options: { align: 'right', color: 'F59E0B' } }],
            [{ text: 'Processing 🔄' }, { text: fmt(conv.processing || 0), options: { align: 'right' } }, { text: pct(conv.processing, shg.uploaded), options: { align: 'right', color: '60A5FA' } }],
            [{ text: 'Failed ✗' }, { text: fmt(conv.failed || 0), options: { align: 'right' } }, { text: pct(conv.failed, shg.uploaded), options: { align: 'right', color: 'F43F5E' } }],
        ];
        slide.addTable(convRows, {
            x: 0.4, y: 4.1, w: 6.2, h: 2.8,
            fontSize: 12, fontFace: 'Calibri', color: 'CBD5E1',
            fill: { color: '1E293B' },
            colW: [3.8, 1.2, 1.2],
            border: { color: '334155', pt: 0.5 },
            rowH: 0.45,
        });

        // Upload progress visual
        const uploadPct = shg.total > 0 ? (shg.uploaded / shg.total) : 0;
        slide.addText('UPLOAD PROGRESS', { x: 7.2, y: 3.75, w: 5.8, h: 0.3, fontSize: 9, bold: true, color: ACCENT, charSpacing: 3, fontFace: 'Calibri' });
        slide.addShape(pptx.ShapeType.rect, { x: 7.2, y: 4.15, w: 5.8, h: 0.35, fill: { color: '1E293B' }, line: { transparency: 100 }, rounding: true });
        slide.addShape(pptx.ShapeType.rect, { x: 7.2, y: 4.15, w: Math.max(0.1, uploadPct * 5.8), h: 0.35, fill: { color: '10B981' }, line: { transparency: 100 }, rounding: true });
        slide.addText(`${(uploadPct * 100).toFixed(1)}% Uploaded`, { x: 7.2, y: 4.6, w: 5.8, h: 0.4, align: 'center', fontSize: 12, bold: true, color: '6EE7B7', fontFace: 'Calibri' });

        const pendingPct = shg.total > 0 ? (shg.pending / shg.total) : 0;
        slide.addShape(pptx.ShapeType.rect, { x: 7.2, y: 5.15, w: 5.8, h: 0.35, fill: { color: '1E293B' }, line: { transparency: 100 }, rounding: true });
        slide.addShape(pptx.ShapeType.rect, { x: 7.2, y: 5.15, w: Math.max(0.1, pendingPct * 5.8), h: 0.35, fill: { color: 'F59E0B' }, line: { transparency: 100 }, rounding: true });
        slide.addText(`${(pendingPct * 100).toFixed(1)}% Pending`, { x: 7.2, y: 5.6, w: 5.8, h: 0.4, align: 'center', fontSize: 12, bold: true, color: 'FCD34D', fontFace: 'Calibri' });
    }

    // ── SLIDE 4: FINANCIAL OVERVIEW ──────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '02  ·  FINANCIAL PERFORMANCE');
        slideTitle(slide, 'Key Financial Metrics');
        divider(slide);

        const metrics = [
            { label: 'COLLECTIONS', val: formatINR(fs.totalLoanRecovered), sub: 'Loan Repayments', color: '065F46', bar: 'green' },
            { label: 'DEPOSITS', val: formatINR(fs.totalSavings), sub: 'Member Savings', color: '1E3A8A', bar: 'indigo' },
            { label: 'LOANS', val: formatINR(fs.totalLoansTaken), sub: `${fmt(fs.loanCount || 0)} loans`, color: '9F1239', bar: 'rose' },
            { label: 'WITHDRAWALS', val: formatINR(fs.totalReturned), sub: 'Savings Returned', color: '7C2D12', bar: 'amber' },
            { label: 'PENALTIES', val: formatINR(fs.totalPenalties), sub: 'Late Surcharges', color: '78350F', bar: 'yellow' },
        ];

        metrics.forEach((m, i) => {
            const x = 0.4 + i * 2.6;
            slide.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 2.4, h: 1.8, fill: { color: m.color }, line: { transparency: 100 }, rounding: true });
            slide.addText(m.label, { x, y: 1.6, w: 2.4, h: 0.3, align: 'center', fontSize: 8, bold: true, color: WHITE, charSpacing: 2, fontFace: 'Calibri' });
            slide.addText(m.val, { x, y: 1.95, w: 2.4, h: 0.7, align: 'center', fontSize: 20, bold: true, color: WHITE, fontFace: 'Calibri' });
            slide.addText(m.sub, { x, y: 2.72, w: 2.4, h: 0.4, align: 'center', fontSize: 9, color: 'A5B4FC', fontFace: 'Calibri' });
        });

        // Collections Breakdown
        slide.addText('COLLECTIONS BREAKDOWN', { x: 0.4, y: 3.55, w: 6, h: 0.3, fontSize: 9, bold: true, color: ACCENT, charSpacing: 3, fontFace: 'Calibri' });

        const lbItems = [
            ['Bank Loan', lb.bankLoan],
            ['SHG Internal', lb.shgInternal],
            ['Streenidhi Micro', lb.streenidhiMicro],
            ['Streenidhi Tenny', lb.streenidhiTenni],
            ['Unnati SCSP', lb.unnatiSCSP],
            ['Unnati TSP', lb.unnatiTSP],
            ['CIF Loan', lb.cif],
            ['VO Internal', lb.voInternal],
        ].filter(([, v]) => v > 0);

        const lbTotal = lbItems.reduce((a, [, v]) => a + (v || 0), 0);
        lbItems.slice(0, 6).forEach(([label, val], i) => {
            const barW = lbTotal > 0 ? (val / lbTotal) * 4.8 : 0;
            const y = 4.0 + i * 0.52;
            slide.addText(label, { x: 0.4, y, w: 2.0, h: 0.45, fontSize: 9.5, color: 'CBD5E1', fontFace: 'Calibri' });
            slide.addShape(pptx.ShapeType.rect, { x: 2.5, y: y + 0.07, w: 4.8, h: 0.28, fill: { color: '1E293B' }, line: { transparency: 100 }, rounding: true });
            slide.addShape(pptx.ShapeType.rect, { x: 2.5, y: y + 0.07, w: Math.max(0.05, barW), h: 0.28, fill: { color: '10B981' }, line: { transparency: 100 }, rounding: true });
            slide.addText(formatINR(val), { x: 7.4, y, w: 2.0, h: 0.45, align: 'right', fontSize: 9.5, bold: true, color: '6EE7B7', fontFace: 'Calibri' });
        });

        // Net Position
        const net = (fs.totalLoanRecovered || 0) + (fs.totalSavings || 0) - (fs.totalLoansTaken || 0) - (fs.totalReturned || 0);
        slide.addShape(pptx.ShapeType.rect, { x: 9.5, y: 3.55, w: 3.8, h: 3.3, fill: { color: '1E1B4B' }, line: { color: '4338CA', width: 1 }, rounding: true });
        slide.addText('NET POSITION', { x: 9.6, y: 3.7, w: 3.6, h: 0.35, align: 'center', fontSize: 9, bold: true, color: ACCENT, charSpacing: 2, fontFace: 'Calibri' });
        slide.addText(formatINR(net), { x: 9.6, y: 4.1, w: 3.6, h: 0.8, align: 'center', fontSize: 22, bold: true, color: net >= 0 ? '6EE7B7' : 'F43F5E', fontFace: 'Calibri' });
        slide.addText(net >= 0 ? '▲ Positive Cash Flow' : '▼ Negative Cash Flow', { x: 9.6, y: 5.0, w: 3.6, h: 0.4, align: 'center', fontSize: 10, color: net >= 0 ? '10B981' : 'F43F5E', fontFace: 'Calibri' });
        slide.addText(`Avg Loan: ${fs.loanCount > 0 ? formatINR(Math.round(fs.totalLoansTaken / fs.loanCount)) : 'N/A'}`, { x: 9.6, y: 5.5, w: 3.6, h: 0.4, align: 'center', fontSize: 10, color: 'A5B4FC', fontFace: 'Calibri' });
        slide.addText(`Recovery Rate: ${pct(fs.totalLoanRecovered, fs.totalLoansTaken)}`, { x: 9.6, y: 5.95, w: 3.6, h: 0.4, align: 'center', fontSize: 10, color: 'A5B4FC', fontFace: 'Calibri' });
    }

    // ── SLIDE 5: MANUAL LEDGER SUMMARY (Page 2) ──────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '03  ·  MANUAL LEDGER SUMMARY');
        slideTitle(slide, 'Specialized Financial Indicators');
        divider(slide);

        const p2 = fs.page2Finance || {};
        const p2Items = [
            { label: 'SAVINGS RECEIVED', val: formatINR(p2.savingsReceived), color: '1E3A8A', accent: 'A5B4FC' },
            { label: 'FUNDS RECEIVED', val: formatINR(p2.fundsReceived), color: '4338CA', accent: 'C4B5FD' },
            { label: 'INVESTMENTS', val: formatINR(p2.investments), color: '92400E', accent: 'FCD34D' },
            { label: 'RECOVERIES REC.', val: formatINR(p2.recoveriesReceived), color: '065F46', accent: '6EE7B7' },
            { label: 'EXPENSES', val: formatINR(p2.expenses), color: '9F1239', accent: 'FDA4AF' },
            { label: 'INCOMES', val: formatINR(p2.incomesReceived), color: '115E59', accent: '99F6E4' },
            { label: 'LOAN REC. PAID', val: formatINR(p2.loanRecoveriesPaid), color: '7F1D1D', accent: 'FECACA' },
        ];

        p2Items.forEach((k, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const x = 0.4 + col * 3.2;
            const y = 1.5 + row * 2.2;
            slide.addShape(pptx.ShapeType.rect, { x, y, w: 3, h: 2, fill: { color: k.color }, line: { transparency: 100 }, rounding: true });
            slide.addText(k.label, { x, y: y + 0.15, w: 3, h: 0.35, align: 'center', fontSize: 9, bold: true, color: k.accent, charSpacing: 2, fontFace: 'Calibri' });
            slide.addText(k.val, { x, y: y + 0.6, w: 3, h: 0.8, align: 'center', fontSize: 24, bold: true, color: WHITE, fontFace: 'Calibri' });
            slide.addText('Monthly Record', { x, y: y + 1.45, w: 3, h: 0.4, align: 'center', fontSize: 10, color: k.accent, fontFace: 'Calibri' });
        });
    }

    // ── SLIDE 6: REGIONAL CONTRIBUTION ──────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '04  ·  REGIONAL CONTRIBUTION');
        slideTitle(slide, `Top Regions — ${distKey ? distKey.charAt(0).toUpperCase() + distKey.slice(1) : 'Region'} Level`);
        divider(slide);

        const topC = (dists.totalCollections || []).filter(d => d.value > 0).slice(0, 8);
        const topD = (dists.memberDeposits || []).filter(d => d.value > 0).slice(0, 8);

        const renderRegionTable = (items, title, x, color) => {
            slide.addText(title, { x, y: 1.4, w: 6, h: 0.3, fontSize: 9, bold: true, color, charSpacing: 3, fontFace: 'Calibri' });
            const total = items.reduce((a, b) => a + (b.value || 0), 0);
            items.forEach((d, i) => {
                const barW = total > 0 ? (d.value / total) * 3.0 : 0;
                const y = 1.8 + i * 0.68;
                slide.addText(`${i + 1}. ${d.name || '\u2014'}`, { x, y, w: 2.3, h: 0.45, fontSize: 10, color: 'CBD5E1', fontFace: 'Calibri' });
                slide.addShape(pptx.ShapeType.rect, { x: x + 2.4, y: y + 0.08, w: 3.0, h: 0.26, fill: { color: '1E293B' }, line: { transparency: 100 }, rounding: true });
                slide.addShape(pptx.ShapeType.rect, { x: x + 2.4, y: y + 0.08, w: Math.max(0.05, barW), h: 0.26, fill: { color }, line: { transparency: 100 }, rounding: true });
                slide.addText(`${formatINR(d.value)}  (${pct(d.value, total)})`, { x: x + 2.4, y: y + 0.38, w: 3.0, h: 0.22, fontSize: 7.5, color: '94A3B8', fontFace: 'Calibri' });
            });
        };

        if (topC.length > 0) renderRegionTable(topC, 'TOP COLLECTIONS BY REGION', 0.4, '10B981');
        if (topD.length > 0) renderRegionTable(topD, 'TOP DEPOSITS BY REGION', 6.9, '818CF8');

        if (!topC.length && !topD.length) {
            slide.addText('No regional distribution data available for this period.', {
                x: 0.4, y: 2.5, w: 13, h: 1, align: 'center', fontSize: 14, color: '64748B', fontFace: 'Calibri'
            });
        }
    }

    // ── SLIDE 6: MONTHLY TRENDS ──────────────────────────────────────────────
    if (paymentTrends && paymentTrends.length > 0) {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '05  ·  MONTHLY TRENDS');
        slideTitle(slide, 'Financial Activity Over Time');
        divider(slide);

        const maxVal = Math.max(...paymentTrends.map(t => Math.max(t.collections || 0, t.deposits || 0, t.loans || 0)));
        const barH = 3.2;
        const barAreaY = 1.5;
        const months = paymentTrends.slice(0, 10);
        const bW = 12.4 / Math.max(months.length, 1);

        // Bars + month dividers
        months.forEach((t, i) => {
            const x = 0.4 + i * bW;

            // Alternating faint background band per month
            if (i % 2 === 0) {
                slide.addShape(pptx.ShapeType.rect, {
                    x, y: barAreaY, w: bW, h: barH,
                    fill: { color: 'FFFFFF', transparency: 96 },
                    line: { transparency: 100 },
                });
            }

            const metrics = [
                { key: 'collections', color: '10B981', offset: 0 },
                { key: 'deposits', color: '6366F1', offset: bW * 0.22 },
                { key: 'loans', color: 'F43F5E', offset: bW * 0.44 },
            ];
            metrics.forEach(m => {
                const h = maxVal > 0 ? ((t[m.key] || 0) / maxVal) * barH : 0;
                if (h > 0.05) {
                    slide.addShape(pptx.ShapeType.rect, {
                        x: x + m.offset, y: barAreaY + barH - h, w: bW * 0.18, h,
                        fill: { color: m.color }, line: { transparency: 100 }, rounding: true,
                    });
                }
            });

            // Month label
            slide.addText(t.month || `M${i + 1}`, {
                x, y: barAreaY + barH + 0.05, w: bW, h: 0.4,
                align: 'center', fontSize: 8, color: '94A3B8', fontFace: 'Calibri',
            });

            // Vertical divider between months (skip last)
            if (i < months.length - 1) {
                slide.addShape(pptx.ShapeType.line, {
                    x: x + bW, y: barAreaY,
                    w: 0, h: barH + 0.45,
                    line: { color: '334155', width: 0.8, dashType: 'dash' },
                });
            }
        });

        // Legend
        [
            { label: 'Collections', color: '10B981' },
            { label: 'Deposits', color: '6366F1' },
            { label: 'Loans', color: 'F43F5E' },
            { label: 'Withdrawals', color: 'F97316' },
            { label: 'Penalties', color: 'F59E0B' },
        ].forEach((l, i) => {
            slide.addShape(pptx.ShapeType.rect, { x: 0.4 + i * 2.5, y: 5.2, w: 0.2, h: 0.2, fill: { color: l.color }, line: { transparency: 100 } });
            slide.addText(l.label, { x: 0.65 + i * 2.5, y: 5.18, w: 2.2, h: 0.25, fontSize: 9, color: 'A5B4FC', fontFace: 'Calibri' });
        });

        // Trend summary table
        slide.addText('MONTHLY SUMMARY TABLE', { x: 0.4, y: 5.55, w: 12, h: 0.25, fontSize: 9, bold: true, color: ACCENT, charSpacing: 3, fontFace: 'Calibri' });
        const trendRows = [
            [{ text: 'Month', options: { bold: true } }, { text: 'Collections', options: { bold: true, align: 'right' } }, { text: 'Deposits', options: { bold: true, align: 'right' } }, { text: 'Loans', options: { bold: true, align: 'right' } }],
            ...months.map(t => ([
                { text: t.month || '' },
                { text: formatINR(t.collections), options: { align: 'right', color: '10B981' } },
                { text: formatINR(t.deposits), options: { align: 'right', color: '818CF8' } },
                { text: formatINR(t.loans), options: { align: 'right', color: 'F43F5E' } },
            ]))
        ];
        slide.addTable(trendRows, {
            x: 0.4, y: 5.85, w: 12.9, h: 1.2,
            fontSize: 9, fontFace: 'Calibri', color: 'CBD5E1',
            fill: { color: '1E293B' }, border: { color: '334155', pt: 0.5 },
            colW: [2, 2.6, 2.6, 2.6],
        });
    }

    // ── SLIDE 7: CUMULATIVE SUMMARY ───────────────────────────────────────────
    let processedHistory2 = [];
    if (historyData && historyData.length > 0) {
        let rb = 0;
        processedHistory2 = historyData.map(h => {
            const s = h.stats || {};
            const inflow = (s.totalLoanRecovered || 0) + (s.totalSavings || 0) + (s.totalPenalties || 0) + (s.otherSavings || 0);
            const outflow = (s.totalLoansTaken || 0) + (s.totalReturned || 0);
            const opening = rb;
            const closing = opening + inflow - outflow;
            rb = closing;
            return { ...h, opening, inflow, outflow, closing };
        });

        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '06  ·  CUMULATIVE FINANCIAL SUMMARY');
        slideTitle(slide, `Running Balance — Jan to ${getMonthName(filters?.month)}`);
        divider(slide);

        const finalClose = processedHistory2[processedHistory2.length - 1]?.closing || 0;
        const ytdInflow = processedHistory2.reduce((a, b) => a + (b.inflow || 0), 0);
        const ytdOutflow = processedHistory2.reduce((a, b) => a + (b.outflow || 0), 0);

        // Summary KPIs
        [
            { label: 'YTD TOTAL INFLOW', val: formatINR(ytdInflow), color: '065F46', text: '6EE7B7' },
            { label: 'YTD TOTAL OUTFLOW', val: formatINR(ytdOutflow), color: '9F1239', text: 'FDA4AF' },
            { label: 'CLOSING BALANCE', val: formatINR(finalClose), color: finalClose >= 0 ? '1E3A8A' : '7F1D1D', text: finalClose >= 0 ? 'A5B4FC' : 'FCA5A5' },
        ].forEach((k, i) => {
            slide.addShape(pptx.ShapeType.rect, { x: 0.4 + i * 4.4, y: 1.5, w: 4, h: 1.5, fill: { color: k.color }, line: { transparency: 100 }, rounding: true });
            slide.addText(k.label, { x: 0.4 + i * 4.4, y: 1.6, w: 4, h: 0.35, align: 'center', fontSize: 8, bold: true, color: k.text, charSpacing: 2, fontFace: 'Calibri' });
            slide.addText(k.val, { x: 0.4 + i * 4.4, y: 2.0, w: 4, h: 0.75, align: 'center', fontSize: 22, bold: true, color: WHITE, fontFace: 'Calibri' });
        });

        // Table
        slide.addText('MONTH-BY-MONTH BREAKDOWN', { x: 0.4, y: 3.25, w: 8, h: 0.3, fontSize: 9, bold: true, color: ACCENT, charSpacing: 3, fontFace: 'Calibri' });
        const histRows = [
            [{ text: 'Month', options: { bold: true } }, { text: 'Opening', options: { bold: true, align: 'right' } }, { text: 'Inflow (+)', options: { bold: true, align: 'right' } }, { text: 'Outflow (−)', options: { bold: true, align: 'right' } }, { text: 'Closing', options: { bold: true, align: 'right' } }],
            ...processedHistory2.map(h => ([
                { text: `${getMonthName(h.month)} ${h.year}` },
                { text: formatINR(h.opening), options: { align: 'right' } },
                { text: `+${formatINR(h.inflow)}`, options: { align: 'right', color: '10B981' } },
                { text: `-${formatINR(h.outflow)}`, options: { align: 'right', color: 'F43F5E' } },
                { text: formatINR(h.closing), options: { align: 'right', color: h.closing >= 0 ? 'A5B4FC' : 'F43F5E', bold: true } },
            ]))
        ];
        slide.addTable(histRows, {
            x: 0.4, y: 3.6, w: 12.9, h: 4,
            fontSize: 10, fontFace: 'Calibri', color: 'CBD5E1',
            fill: { color: '1E293B' }, border: { color: '334155', pt: 0.5 },
            colW: [2.5, 2.3, 2.6, 2.6, 2.6],
            rowH: 0.42,
        });
    }

    // ── SLIDE 8: PENDING ACTIONS ─────────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        sectionLabel(slide, '07  ·  PENDING ACTIONS & RECOMMENDATIONS');
        slideTitle(slide, 'Key Follow-Ups');
        divider(slide);

        const actions = [
            { icon: '📁', label: 'SHG Uploads Pending', val: fmt(shg.pending || 0), priority: 'HIGH', color: 'DC2626', pcolor: 'F87171' },
            { icon: '⚙️', label: 'Conversion Queue', val: fmt(conv.pending || 0), priority: 'MEDIUM', color: 'D97706', pcolor: 'FCD34D' },
            { icon: '🔄', label: 'Currently Processing', val: fmt(conv.processing || 0), priority: 'MONITOR', color: '2563EB', pcolor: '93C5FD' },
            { icon: '✗', label: 'Failed Conversions', val: fmt(conv.failed || 0), priority: 'URGENT', color: '991B1B', pcolor: 'FCA5A5' },
            { icon: '✓', label: 'Awaiting APM Approval', val: fmt(Math.max(0, (shg.uploaded || 0) - (cc.approved || 0))), priority: 'MEDIUM', color: '5B21B6', pcolor: 'C4B5FD' },
        ];

        actions.forEach((a, i) => {
            const x = 0.4;
            const y = 1.5 + i * 1.0;
            slide.addShape(pptx.ShapeType.rect, { x, y, w: 9.5, h: 0.8, fill: { color: '1E293B' }, line: { color: '334155', width: 0.5 }, rounding: true });
            slide.addText(`${a.icon}  ${a.label}`, { x: x + 0.2, y: y + 0.15, w: 7, h: 0.5, fontSize: 13, color: 'E2E8F0', fontFace: 'Calibri' });
            slide.addShape(pptx.ShapeType.rect, { x: x + 7.5, y: y + 0.15, w: 1.5, h: 0.5, fill: { color: a.color }, line: { transparency: 100 }, rounding: true });
            slide.addText(a.priority, { x: x + 7.5, y: y + 0.15, w: 1.5, h: 0.5, align: 'center', fontSize: 8, bold: true, color: a.pcolor, charSpacing: 1, fontFace: 'Calibri' });
            slide.addText(a.val, { x: 10.1, y, w: 3.2, h: 0.8, align: 'center', fontSize: 28, bold: true, color: a.pcolor, fontFace: 'Calibri' });
        });

        slide.addText('RECOMMENDATIONS', { x: 0.4, y: 6.75, w: 4, h: 0.3, fontSize: 9, bold: true, color: ACCENT, charSpacing: 3, fontFace: 'Calibri' });
        slide.addText([
            { text: '→ ', options: { bold: true, color: '818CF8' } },
            { text: 'Coordinate with cluster heads to resolve pending uploads and failed conversions immediately.', options: { color: '94A3B8' } },
        ], { x: 0.4, y: 7.1, w: 13, h: 0.35, fontSize: 10, fontFace: 'Calibri' });
    }

    // ── SLIDE 9: THANK YOU ───────────────────────────────────────────────────
    {
        const slide = pptx.addSlide();
        addBgRect(slide, '0F172A');
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '0F172A' } });
        slide.addShape(pptx.ShapeType.ellipse, { x: -1, y: -1, w: 8, h: 8, fill: { color: '4338CA', transparency: 88 }, line: { transparency: 100 } });
        slide.addShape(pptx.ShapeType.ellipse, { x: 8, y: 3, w: 6, h: 6, fill: { color: '7C3AED', transparency: 88 }, line: { transparency: 100 } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 2.8, w: '100%', h: 0.04, fill: { color: '4338CA' }, line: { transparency: 100 } });

        slide.addText('SHG ANALYTICS PLATFORM', { x: 0, y: 1.4, w: 13.3, h: 0.4, align: 'center', fontSize: 10, bold: true, color: '818CF8', charSpacing: 4, fontFace: 'Calibri' });
        slide.addText('Thank You', { x: 0, y: 2.0, w: 13.3, h: 1.4, align: 'center', fontSize: 52, bold: true, color: WHITE, fontFace: 'Calibri' });
        slide.addText(`${period}  ·  ${scope}`, { x: 0, y: 3.6, w: 13.3, h: 0.5, align: 'center', fontSize: 14, color: 'A5B4FC', fontFace: 'Calibri' });
        slide.addText(`Generated on ${new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}`, {
            x: 0, y: 4.3, w: 13.3, h: 0.4, align: 'center', fontSize: 11, color: '64748B', fontFace: 'Calibri',
        });

        // Bottom stats ribbon
        [
            { label: 'TOTAL SHGs', val: fmt(shg.total || 0) },
            { label: 'UPLOADED', val: fmt(shg.uploaded || 0) },
            { label: 'COLLECTIONS', val: formatINR(fs.totalLoanRecovered) },
            { label: 'DEPOSITS', val: formatINR(fs.totalSavings) },
        ].forEach((k, i) => {
            slide.addShape(pptx.ShapeType.rect, { x: 0.4 + i * 3.2, y: 5.4, w: 3, h: 1.8, fill: { color: '1E1B4B' }, line: { color: '4338CA', width: 1 }, rounding: true });
            slide.addText(k.label, { x: 0.4 + i * 3.2, y: 5.55, w: 3, h: 0.3, align: 'center', fontSize: 8, bold: true, color: ACCENT, charSpacing: 2, fontFace: 'Calibri' });
            slide.addText(k.val, { x: 0.4 + i * 3.2, y: 5.9, w: 3, h: 0.85, align: 'center', fontSize: 20, bold: true, color: WHITE, fontFace: 'Calibri' });
        });
    }

    // ── SAVE ─────────────────────────────────────────────────────────────────
    const safeScope = scope.replace(/[^a-zA-Z0-9]/g, '_');
    await pptx.writeFile({ fileName: `Analytics_Presentation_${period.replace(' ', '_')}_${safeScope}.pptx` });
};
