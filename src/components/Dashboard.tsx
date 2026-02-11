import { getDashboardSummary } from "@/data/qaMatrixData";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { Shield, AlertTriangle, CheckCircle, Factory } from "lucide-react";

interface DashboardProps {
  data: QAMatrixEntry[];
  onFilterByRating: (rating: 1 | 3 | 5, level: string, status?: "OK" | "NG") => void;
}

const Dashboard = ({ data, onFilterByRating }: DashboardProps) => {
  const summary = getDashboardSummary(data);

  const levels = [
    { label: "Workstation", key: "Workstation" },
    { label: "MFG", key: "MFG" },
    { label: "Plant", key: "Plant" },
  ];

  const ratings: (1 | 3 | 5)[] = [1, 3, 5];

  const getCount = (rating: 1 | 3 | 5, level: string, status: "ng" | "ok") => {
    const r = rating === 1 ? summary.rating1 : rating === 3 ? summary.rating3 : summary.rating5;
    if (status === "ng") {
      return level === "Workstation" ? r.ngWorkstation : level === "MFG" ? r.ngMfg : r.ngPlant;
    }
    return level === "Workstation" ? r.okWorkstation : level === "MFG" ? r.okMfg : r.okPlant;
  };

  return (
    <div className="space-y-6">
      {/* Top summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="dashboard-card flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/15">
            <Factory className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total Concerns</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-destructive/15">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{summary.ngWorkstation}</p>
            <p className="text-xs text-muted-foreground">Workstation NG</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-warning/15">
            <Shield className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{summary.ngMfg}</p>
            <p className="text-xs text-muted-foreground">MFG NG</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-success/15">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{summary.total - summary.ngPlant}</p>
            <p className="text-xs text-muted-foreground">Plant OK</p>
          </div>
        </div>
      </div>

      {/* Rating breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {levels.map((level) => (
          <div key={level.key} className="dashboard-card">
            <h3 className="section-header">{level.label} Quality</h3>
            <div className="grid grid-cols-3 gap-2">
              {ratings.map((rating) => {
                const ngCount = getCount(rating, level.key, "ng");
                const okCount = getCount(rating, level.key, "ok");
                const isNg = ngCount > 0;
                  return (
                    <div
                      key={rating}
                      className={`rounded-lg p-3 text-center transition-all border ${
                        isNg
                          ? "border-destructive/40 bg-destructive/10"
                          : "border-success/30 bg-success/10"
                      }`}
                    >
                      <p className="text-lg font-bold font-mono">
                        Rating {rating}
                      </p>
                      <div className="flex justify-center gap-2 mt-1">
                        {ngCount > 0 && (
                          <button
                            onClick={() => onFilterByRating(rating, level.key, "NG")}
                            className="status-ng text-[10px] cursor-pointer hover:opacity-80"
                          >
                            {ngCount} NG
                          </button>
                        )}
                        <button
                          onClick={() => onFilterByRating(rating, level.key, "OK")}
                          className="status-ok text-[10px] cursor-pointer hover:opacity-80"
                        >
                          {okCount} OK
                        </button>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
