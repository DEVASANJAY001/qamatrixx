import { useState, useRef } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { recalculateStatuses } from "@/utils/qaCalculations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface FileUploadDialogProps {
  nextSNo: number;
  onImport: (entries: QAMatrixEntry[]) => void;
}

const n = null;

function parseSheet(sheet: XLSX.WorkSheet, startSNo: number): QAMatrixEntry[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  const headers = (rows[0] || []).map((h: any) => String(h || "").trim().toLowerCase());

  const findCol = (names: string[]): number => {
    for (const name of names) {
      const n = name.toLowerCase();
      let idx = headers.indexOf(n);
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => h.startsWith(n));
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => h.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const getVal = (row: any[], col: number): string => {
    if (col < 0 || col >= row.length) return "";
    return String(row[col] ?? "").trim();
  };

  const getNum = (row: any[], col: number): number | null => {
    if (col < 0 || col >= row.length) return null;
    const v = row[col];
    if (v === null || v === undefined || v === "") return null;
    const num = Number(v);
    return isNaN(num) ? null : num;
  };

  const sourceCol = findCol(["source", "src"]);
  const stationCol = findCol(["station", "stn", "operation station"]);
  const areaCol = findCol(["area", "designation"]);
  const concernCol = findCol(["concern", "description"]);
  const drCol = findCol(["defect rating", "dr", "rating"]);
  const respCol = findCol(["resp", "responsible", "responsibility"]);
  const actionCol = findCol(["action", "mfg action"]);
  const targetCol = findCol(["target"]);

  const entries: QAMatrixEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const concern = getVal(row, concernCol);
    if (!concern) continue;

    const drRaw = getNum(row, drCol);
    const defectRating = (drRaw === 1 || drRaw === 3 || drRaw === 5) ? drRaw : 1;

    const entry: QAMatrixEntry = {
      sNo: startSNo + entries.length,
      source: getVal(row, sourceCol) || "Import",
      operationStation: getVal(row, stationCol) || "",
      designation: getVal(row, areaCol) || "",
      concern,
      defectRating,
      recurrence: 0,
      weeklyRecurrence: [0, 0, 0, 0, 0, 0],
      recurrenceCountPlusDefect: defectRating,
      trim: { T10: n, T20: n, T30: n, T40: n, T50: n, T60: n, T70: n, T80: n, T90: n, T100: n, TPQG: n },
      chassis: { C10: n, C20: n, C30: n, C40: n, C45: n, P10: n, P20: n, P30: n, C50: n, C60: n, C70: n, RSub: n, TS: n, C80: n, CPQG: n },
      final: { F10: n, F20: n, F30: n, F40: n, F50: n, F60: n, F70: n, F80: n, F90: n, F100: n, FPQG: n, ResidualTorque: n },
      qControl: { freqControl_1_1: n, visualControl_1_2: n, periodicAudit_1_3: n, humanControl_1_4: n, saeAlert_3_1: n, freqMeasure_3_2: n, manualTool_3_3: n, humanTracking_3_4: n, autoControl_5_1: n, impossibility_5_2: n, saeProhibition_5_3: n },
      qControlDetail: { CVT: n, SHOWER: n, DynamicUB: n, CC4: n },
      controlRating: { MFG: 0, Quality: 0, Plant: 0 },
      guaranteedQuality: { Workstation: n, MFG: n, Plant: n },
      workstationStatus: "OK",
      mfgStatus: "NG",
      plantStatus: "OK",
      mfgAction: getVal(row, actionCol),
      resp: getVal(row, respCol),
      target: getVal(row, targetCol),
    };

    entries.push(recalculateStatuses(entry));
  }

  return entries;
}

const FileUploadDialog = ({ nextSNo, onImport }: FileUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<QAMatrixEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const entries = parseSheet(sheet, nextSNo);
      setPreview(entries);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = () => {
    if (preview.length > 0) {
      onImport(preview);
      setOpen(false);
      setPreview([]);
      setFileName("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview([]); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="w-4 h-4" />
          Upload File
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Import QA Matrix Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Upload a CSV or Excel file (.xlsx, .xls) with columns: Source, Station, Area, Concern, Defect Rating, Resp, Action, Target.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
          />
          {fileName && (
            <p className="text-sm">
              File: <span className="font-semibold">{fileName}</span> — {preview.length} rows detected
            </p>
          )}
          {preview.length > 0 && (
            <div className="max-h-[200px] overflow-auto border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Source</th>
                    <th className="px-2 py-1 text-left">Station</th>
                    <th className="px-2 py-1 text-left">Concern</th>
                    <th className="px-2 py-1 text-center">DR</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((e) => (
                    <tr key={e.sNo} className="border-t border-border/30">
                      <td className="px-2 py-1">{e.sNo}</td>
                      <td className="px-2 py-1">{e.source}</td>
                      <td className="px-2 py-1">{e.operationStation}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate">{e.concern}</td>
                      <td className="px-2 py-1 text-center">{e.defectRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="text-xs text-muted-foreground p-2">...and {preview.length - 20} more rows</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={preview.length === 0}>
              Import {preview.length} Rows
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadDialog;
