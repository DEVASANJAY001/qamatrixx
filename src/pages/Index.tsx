import { useState, useMemo } from "react";
import Dashboard from "@/components/Dashboard";
import QAMatrixTable from "@/components/QAMatrixTable";
import AddConcernDialog from "@/components/AddConcernDialog";
import FileUploadDialog from "@/components/FileUploadDialog";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { recalculateStatuses } from "@/utils/qaCalculations";
import { exportToCSV } from "@/utils/csvExport";
import { exportToXLSX } from "@/utils/xlsxExport";
import { usePersistedData } from "@/hooks/usePersistedData";
import { Shield, Search, Filter, X, Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { data, loading, updateData, resetToExcel } = usePersistedData();

  const [filter, setFilter] = useState<{ rating?: 1 | 3 | 5; level?: string; status?: "OK" | "NG" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [designationFilter, setDesignationFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ratingFilter, setRatingFilter] = useState<string>("");

  const sources = useMemo(() => [...new Set(data.map(d => d.source))].sort(), [data]);
  const designations = useMemo(() => [...new Set(data.map(d => d.designation.toUpperCase()))].sort(), [data]);

  const handleWeeklyUpdate = (sNo: number, weekIndex: number, value: number) => {
    updateData(prev => prev.map(entry => {
      if (entry.sNo !== sNo) return entry;
      const newWeekly = [...entry.weeklyRecurrence];
      newWeekly[weekIndex] = value;
      return recalculateStatuses({ ...entry, weeklyRecurrence: newWeekly });
    }));
  };

  const handleScoreUpdate = (sNo: number, section: "trim" | "chassis" | "final" | "qControl" | "qControlDetail", key: string, value: number | null) => {
    updateData(prev => prev.map(entry => {
      if (entry.sNo !== sNo) return entry;
      const updated = { ...entry, [section]: { ...entry[section], [key]: value } };
      return recalculateStatuses(updated);
    }));
  };

  const handleFieldUpdate = (sNo: number, field: string, value: string) => {
    updateData(prev => prev.map(entry => {
      if (entry.sNo !== sNo) return entry;
      if (field === "defectRating") {
        const newRating = Number(value) as 1 | 3 | 5;
        return recalculateStatuses({ ...entry, defectRating: newRating });
      }
      return { ...entry, [field]: value };
    }));
  };

  const handleDeleteEntry = (sNo: number) => {
    updateData(prev => prev.filter(entry => entry.sNo !== sNo));
  };

  const handleFileImport = (entries: QAMatrixEntry[]) => {
    updateData(prev => [...prev, ...entries]);
  };

  const handleAddConcern = (entry: QAMatrixEntry) => {
    updateData(prev => [...prev, entry]);
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d =>
        d.concern.toLowerCase().includes(term) ||
        d.operationStation.toLowerCase().includes(term) ||
        d.sNo.toString().includes(term)
      );
    }
    if (sourceFilter) result = result.filter(d => d.source === sourceFilter);
    if (designationFilter) result = result.filter(d => d.designation.toUpperCase() === designationFilter);
    if (ratingFilter) result = result.filter(d => d.defectRating === Number(ratingFilter));
    if (statusFilter === "NG") result = result.filter(d => d.workstationStatus === "NG" || d.mfgStatus === "NG" || d.plantStatus === "NG");
    if (statusFilter === "OK") result = result.filter(d => d.workstationStatus === "OK" && d.mfgStatus === "OK" && d.plantStatus === "OK");
    return result;
  }, [data, searchTerm, sourceFilter, designationFilter, ratingFilter, statusFilter]);

  const hasActiveFilters = sourceFilter || designationFilter || statusFilter || ratingFilter || searchTerm;

  const clearAllFilters = () => {
    setSearchTerm("");
    setSourceFilter("");
    setDesignationFilter("");
    setStatusFilter("");
    setRatingFilter("");
    setFilter(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-2">
            <FileSpreadsheet className="w-8 h-8 mx-auto animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">Loading QA Matrix data...</p>
          </div>
        </div>
      )}
      {!loading && <>
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">QA Matrix</h1>
              <p className="text-[11px] text-muted-foreground">Quality Assurance Control & Monitoring System</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AddConcernDialog nextSNo={data.length + 1} onAdd={handleAddConcern} />
              <FileUploadDialog nextSNo={data.length + 1} onImport={handleFileImport} />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportToXLSX(filteredData)}>
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportToCSV(filteredData)}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={resetToExcel} title="Reset to original Excel data">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
                <span className="font-mono">{data.length} concerns</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                <span className="font-mono text-destructive font-semibold">
                  {data.filter(d => d.plantStatus === "NG").length} Plant NG
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1800px] mx-auto px-4 py-6 space-y-6">
          <Dashboard data={data} onFilterByRating={(rating, level, status) => setFilter({ rating, level, status })} />

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Filters</span>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="ml-auto text-xs text-destructive hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search concerns, stations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                <option value="">All Sources</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                <option value="">All Areas</option>
                {designations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                <option value="">All Ratings</option>
                <option value="1">Rating 1</option>
                <option value="3">Rating 3</option>
                <option value="5">Rating 5</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                <option value="">All Status</option>
                <option value="NG">Has NG</option>
                <option value="OK">All OK</option>
              </select>
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground">Showing {filteredData.length} of {data.length} concerns</p>
            )}
          </div>

          {/* Matrix Table */}
          <div>
            <h2 className="section-header mb-3">QA Matrix Details</h2>
            <QAMatrixTable
              data={filteredData}
              filter={filter}
              onClearFilter={() => setFilter(null)}
              onWeeklyUpdate={handleWeeklyUpdate}
              onScoreUpdate={handleScoreUpdate}
              onFieldUpdate={handleFieldUpdate}
              onDeleteEntry={handleDeleteEntry}
            />
          </div>
        </main>
      </>}
    </div>
  );
};

export default Index;
