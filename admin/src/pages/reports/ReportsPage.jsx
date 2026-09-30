import React, { useEffect, useMemo, useState } from 'react';
import {
  FileBarChart2, FolderArchive, CalendarClock, CalendarRange, Sparkles, RefreshCw,
  Eye, Download, Trash2, AlertCircle, FileText,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import InfoHint from '../../components/common/InfoHint';
import reportService from '../../services/reportService';
import { useConfirm } from '../../context/ConfirmContext';
import ViewToggle from '../../components/common/ViewToggle';
import useTableView from '../../hooks/useTableView';
import ReportView from './ReportView';
import './ReportsPage.css';

const currentYear = new Date().getFullYear();
const months = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'],
  ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'],
  ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

const REPORT_TYPES = [
  { value: 'custom', label: 'Custom' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB');
};

const titleCase = (value) =>
  String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const fileNameFor = (report) =>
  `${(report?.metadata?.title || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

function ReportsPage() {
  const [form, setForm] = useState({
    type: 'custom',
    from: '',
    to: '',
    year: currentYear,
    month: new Date().getMonth() + 1,
    week: 1,
  });
  const [archives, setArchives] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const [view, setView] = useTableView();

  const years = useMemo(() => Array.from({ length: 9 }, (_, index) => currentYear - 4 + index), []);

  const loadArchives = async () => {
    setArchiveLoading(true);
    try {
      const res = await reportService.getAll();
      setArchives(Array.isArray(res.reports) ? res.reports : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report archive.');
      setArchives([]);
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => { loadArchives(); }, []);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const buildPayload = () => {
    if (form.type === 'custom') {
      if (!form.from || !form.to) throw new Error('From date and To date are required.');
      if (new Date(form.from) > new Date(form.to)) throw new Error('From date must be before or equal to To date.');
      return { type: 'custom', from: form.from, to: form.to };
    }
    if (form.type === 'weekly') {
      return { type: 'weekly', year: Number(form.year), month: Number(form.month), week: Number(form.week) };
    }
    return { type: 'monthly', year: Number(form.year), month: Number(form.month) };
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = buildPayload();
      const res = await reportService.generate(payload);
      setSelectedReport(res.report);
      setSelectedReportId(res.reportId);
      setIsPreviewOpen(true);
      await loadArchives();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewArchive = async (id) => {
    setError('');
    try {
      const res = await reportService.getById(id);
      setSelectedReport(res.report);
      setSelectedReportId(id);
      setIsPreviewOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open archived report.');
    }
  };

  const handleDownload = async (id = selectedReportId, report = selectedReport) => {
    if (!id) return;
    setDownloadingId(id);
    setError('');
    try {
      await reportService.downloadPdf(id, fileNameFor(report));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (archive) => {
    const ok = await confirm({
      title: 'Delete this report?',
      message: `This archived ${titleCase(archive.type)} report will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete report',
      tone: 'danger',
    });
    if (!ok) return;

    setDeletingId(archive.id);
    setError('');
    try {
      await reportService.remove(archive.id);
      if (selectedReportId === archive.id) {
        setIsPreviewOpen(false);
        setSelectedReport(null);
        setSelectedReportId(null);
      }
      await loadArchives();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete report.');
    } finally {
      setDeletingId(null);
    }
  };

  // ---- derived stats ----
  const archivedCount = archives.length;
  const latestGenerated = archives.reduce((latest, a) => {
    const t = new Date(a.generatedAt).getTime();
    return !Number.isNaN(t) && t > latest ? t : latest;
  }, 0);
  const thisYearCount = archives.filter((a) => new Date(a.generatedAt).getFullYear() === currentYear).length;

  return (
    <div className="rep-page">
      {/* ---------- Header ---------- */}
      <header className="rep-headbar">
        <div className="rep-heading">
          <span className="rep-eyebrow"><FileBarChart2 size={14} strokeWidth={2.4} /> Analytics</span>
          <h1 className="rep-title">Reports <InfoHint text="Generate period reports across labs, systems, tools and spend — then archive, preview and export them as PDF." /></h1>
        </div>
      </header>

      {/* ---------- Stat cards ---------- */}
      <div className="rep-stats">
        <div className="rep-stat" style={{ '--rep-accent': 'var(--color-primary)' }}>
          <span className="rep-stat-ico"><FolderArchive size={22} strokeWidth={2.1} /></span>
          <div className="rep-stat-body">
            <span className="rep-stat-value">{archivedCount}</span>
            <span className="rep-stat-label">Archived reports</span>
          </div>
        </div>
        <div className="rep-stat" style={{ '--rep-accent': 'var(--color-info)' }}>
          <span className="rep-stat-ico"><CalendarClock size={22} strokeWidth={2.1} /></span>
          <div className="rep-stat-body">
            <span className="rep-stat-value rep-stat-value--sm">{latestGenerated ? formatDate(latestGenerated) : '—'}</span>
            <span className="rep-stat-label">Latest generated</span>
          </div>
        </div>
        <div className="rep-stat" style={{ '--rep-accent': 'var(--color-teal)' }}>
          <span className="rep-stat-ico"><CalendarRange size={22} strokeWidth={2.1} /></span>
          <div className="rep-stat-body">
            <span className="rep-stat-value">{thisYearCount}</span>
            <span className="rep-stat-label">Generated in {currentYear}</span>
          </div>
        </div>
      </div>

      {error ? <div className="rep-error"><AlertCircle size={16} /> {error}</div> : null}

      {/* ---------- Generate ---------- */}
      <section className="rep-card">
        <div className="rep-card-head">
          <div className="rep-card-title-wrap">
            <span className="rep-card-ico"><Sparkles size={18} strokeWidth={2.2} /></span>
            <div>
              <h3 className="rep-card-title">Generate a report</h3>
              <p className="rep-card-sub">Pick a period and build a fresh snapshot.</p>
            </div>
          </div>
        </div>

        <form className="rep-card-body" onSubmit={handleGenerate}>
          <div className="rep-field">
            <label className="rep-label">Report type</label>
            <div className="rep-seg" role="group" aria-label="Report type">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`rep-seg-btn ${form.type === t.value ? 'is-active' : ''}`}
                  onClick={() => updateField('type', t.value)}
                  aria-pressed={form.type === t.value}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rep-control-grid">
            {form.type === 'custom' && (
              <>
                <div className="rep-field">
                  <label className="rep-label" htmlFor="rep-from">From date</label>
                  <input id="rep-from" className="rep-input" type="date" value={form.from} onChange={(e) => updateField('from', e.target.value)} />
                </div>
                <div className="rep-field">
                  <label className="rep-label" htmlFor="rep-to">To date</label>
                  <input id="rep-to" className="rep-input" type="date" value={form.to} onChange={(e) => updateField('to', e.target.value)} />
                </div>
              </>
            )}

            {(form.type === 'weekly' || form.type === 'monthly') && (
              <>
                <div className="rep-field">
                  <label className="rep-label" htmlFor="rep-year">Year</label>
                  <select id="rep-year" className="rep-input" value={form.year} onChange={(e) => updateField('year', e.target.value)}>
                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div className="rep-field">
                  <label className="rep-label" htmlFor="rep-month">Month</label>
                  <select id="rep-month" className="rep-input" value={form.month} onChange={(e) => updateField('month', e.target.value)}>
                    {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </>
            )}

            {form.type === 'weekly' && (
              <div className="rep-field">
                <label className="rep-label" htmlFor="rep-week">Week</label>
                <select id="rep-week" className="rep-input" value={form.week} onChange={(e) => updateField('week', e.target.value)}>
                  {[1, 2, 3, 4, 5, 6].map((week) => <option key={week} value={week}>Week {week}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="rep-card-actions">
            <button className="rep-btn rep-btn-primary" type="submit" disabled={loading}>
              <FileBarChart2 size={16} /> {loading ? 'Generating…' : 'Generate report'}
            </button>
          </div>
        </form>
      </section>

      {/* ---------- Archive ---------- */}
      <section className="rep-records">
        <div className="rep-records-head">
          <div className="rep-records-title-wrap">
            <h3 className="rep-records-title">Report archive</h3>
            {!archiveLoading && archives.length > 0 ? <span className="rep-records-count">{archives.length} {archives.length === 1 ? 'report' : 'reports'}</span> : null}
          </div>
          <div className="rep-records-tools">
            <ViewToggle view={view} onChange={setView} />
            <button className="rep-mini-btn" type="button" onClick={loadArchives} disabled={archiveLoading}>
              <RefreshCw size={14} className={archiveLoading ? 'rep-spin' : ''} /> {archiveLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {archiveLoading ? (
          <div className="rep-loading">Loading archived reports…</div>
        ) : archives.length === 0 ? (
          <div className="rep-empty">
            <div className="rep-empty-icon"><FileText size={26} /></div>
            <h3>No archived reports yet</h3>
            <p>Generate a report above and it will be saved here for preview and download.</p>
          </div>
        ) : (
          <div className="rep-table-scroll tv-scroll" data-view={view}>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date range</th>
                  <th>Generated</th>
                  <th>Organization</th>
                  <th className="rep-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((archive) => (
                  <tr key={archive.id}>
                    <td data-label="Type"><span className={`rep-type-chip rep-type-${archive.type}`}>{titleCase(archive.type)}</span></td>
                    <td data-label="Date range"><span className="rep-range">{formatDate(archive.from)} <span className="rep-range-sep">→</span> {formatDate(archive.to)}</span></td>
                    <td data-label="Generated">{formatDateTime(archive.generatedAt)}</td>
                    <td data-label="Organization">{archive.organization || '—'}</td>
                    <td className="rep-actions-col" data-label="Actions">
                      <div className="rep-row-actions">
                        <button type="button" className="rep-icon-btn rep-icon-btn--view" onClick={() => handleViewArchive(archive.id)} title="View" aria-label="View report">
                          <Eye size={15} />
                        </button>
                        <button type="button" className="rep-icon-btn" onClick={() => handleDownload(archive.id, { metadata: { title: archive.title } })} disabled={downloadingId === archive.id} title="Download PDF" aria-label="Download report">
                          <Download size={15} />
                        </button>
                        <button type="button" className="rep-icon-btn rep-icon-btn--danger" onClick={() => handleDelete(archive)} disabled={deletingId === archive.id} title="Delete" aria-label="Delete report">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={isPreviewOpen}
        title="Report Preview"
        onClose={() => setIsPreviewOpen(false)}
        size="wide"
      >
        <ReportView
          report={selectedReport}
          onDownload={() => handleDownload()}
          downloading={downloadingId === selectedReportId}
        />
      </Modal>
    </div>
  );
}

export default ReportsPage;
