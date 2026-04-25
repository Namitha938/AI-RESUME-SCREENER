import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import "./App.css";

const API_URL = "http://localhost:5000";

// ── Score Circle ──
function ScoreCircle({ grade, score }) {
  const gradeClass = {
    A: "score-a",
    B: "score-b",
    C: "score-c",
    D: "score-d",
    F: "score-f",
  };
  return (
    <div className={`score-circle ${gradeClass[grade] || "score-d"}`}>
      {score}
    </div>
  );
}

// ── Progress bar color ──
function getProgressColor(score) {
  if (score >= 80) return "linear-gradient(90deg, #16a34a, #4ade80)";
  if (score >= 65) return "linear-gradient(90deg, #2563eb, #60a5fa)";
  if (score >= 50) return "linear-gradient(90deg, #d97706, #fbbf24)";
  return "linear-gradient(90deg, #dc2626, #f87171)";
}

// ── Recommendation class ──
function getRecClass(rec) {
  if (!rec) return "rec-maybe";
  if (rec.includes("Strongly")) return "rec-strongly";
  if (rec.includes("Recommend")) return "rec-recommend";
  if (rec.includes("Maybe")) return "rec-maybe";
  return "rec-reject";
}

// ── Single Result Card ──
function ResultCard({ data, rank }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="result-card">
      <div className="rank-badge">#{rank}</div>

      <div className="result-top">
        <ScoreCircle grade={data.grade} score={data.score} />
        <div>
          <div className="candidate-name">{data.name}</div>
          <div className="candidate-meta">
            <span>{data.experience_fit}</span>
            <span>·</span>
            <span className={`rec-badge ${getRecClass(data.recommendation)}`}>
              {data.recommendation}
            </span>
          </div>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${data.score}%`,
            background: getProgressColor(data.score),
          }}
        />
      </div>

      <p className="result-summary">{data.summary}</p>

      {data.topSkillsMatched?.length > 0 && (
        <>
          <div className="section-label">Skills Matched</div>
          <div className="tags-row">
            {data.topSkillsMatched.map((skill, i) => (
              <span key={i} className="tag tag-blue">{skill}</span>
            ))}
          </div>
        </>
      )}

      <button
        className="expand-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "▲ Hide details" : "▼ Show strengths & gaps"}
      </button>

      {expanded && (
        <div className="expanded-section">
          {data.strengths?.length > 0 && (
            <>
              <div className="section-label">✅ Strengths</div>
              <div className="tags-row">
                {data.strengths.map((s, i) => (
                  <span key={i} className="tag tag-green">{s}</span>
                ))}
              </div>
            </>
          )}
          {data.gaps?.length > 0 && (
            <>
              <div className="section-label">❌ Gaps</div>
              <div className="tags-row">
                {data.gaps.map((g, i) => (
                  <span key={i} className="tag tag-red">{g}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dropzone Component ──
function ResumeDropzone({ onAdd }) {
  const onDrop = useCallback(
    async (acceptedFiles) => {
      for (const file of acceptedFiles) {
        const text = await file.text();
        onAdd({ name: file.name.replace(/\.[^/.]+$/, ""), text });
      }
    },
    [onAdd]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/plain": [".txt"] },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "active" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="dropzone-icon">📄</div>
      <p className="main">
        {isDragActive
          ? "Drop resume files here..."
          : "Drag & drop .txt resume files here"}
      </p>
      <p>or click to browse files</p>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumes, setResumes] = useState([]);
  const [manualName, setManualName] = useState("");
  const [manualText, setManualText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addResume = (resume) => {
    setResumes((prev) => [
      ...prev,
      { ...resume, id: Date.now() + Math.random() },
    ]);
  };

  const addManualResume = () => {
    if (!manualText.trim()) return;
    addResume({
      name: manualName.trim() || `Candidate ${resumes.length + 1}`,
      text: manualText.trim(),
    });
    setManualName("");
    setManualText("");
  };

  const removeResume = (id) =>
    setResumes((prev) => prev.filter((r) => r.id !== id));

  const handleScreen = async () => {
    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }
    if (resumes.length === 0) {
      setError("Please add at least one resume.");
      return;
    }

    setError("");
    setLoading(true);
    setResults([]);

    try {
      const { data } = await axios.post(`${API_URL}/api/screen-batch`, {
        jobDescription,
        resumes: resumes.map((r) => ({ name: r.name, text: r.text })),
      });
      setResults(data.results);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Something went wrong. Make sure the server is running on port 5000."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResumes([]);
    setResults([]);
    setError("");
    setJobDescription("");
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="badge">⚡ Powered by Groq + LLaMA 3</div>
        <h1>AI Resume Screener</h1>
        <p>Screen multiple resumes against a job description instantly</p>
      </div>

      {/* Error */}
      {error && <div className="error-box">⚠️ {error}</div>}

      {/* Job Description */}
      <div className="card">
        <h2>📋 Job Description</h2>
        <textarea
          rows={6}
          placeholder="Paste the job description here...&#10;Include: required skills, experience level, responsibilities, qualifications."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
      </div>

      {/* Upload Resumes */}
      <div className="card">
        <h2>📁 Add Resumes</h2>

        {/* Drag & Drop */}
        <ResumeDropzone onAdd={addResume} />

        {/* Divider */}
        <div className="divider">
          <span>or paste manually</span>
        </div>

        {/* Manual Input */}
        <input
          className="text-input"
          type="text"
          placeholder="Candidate name (e.g. John Doe)"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
        />
        <textarea
          rows={5}
          placeholder="Paste resume text here..."
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <button
          className="btn-secondary"
          onClick={addManualResume}
          disabled={!manualText.trim()}
        >
          + Add Resume
        </button>

        {/* Resume List */}
        {resumes.length > 0 && (
          <div className="resume-list">
            <div className="resume-count-label">
              {resumes.length} resume{resumes.length > 1 ? "s" : ""} added
            </div>
            {resumes.map((r) => (
              <div key={r.id} className="resume-item">
                <span className="resume-item-name">📄 {r.name}</span>
                <button
                  className="remove-btn"
                  onClick={() => removeResume(r.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <button
        className="btn-primary"
        onClick={handleScreen}
        disabled={loading}
      >
        {loading
          ? "⚡ Analyzing resumes..."
          : `🔍 Screen ${resumes.length > 0 ? resumes.length + " " : ""}Resume${resumes.length !== 1 ? "s" : ""}`}
      </button>

      {results.length > 0 && !loading && (
        <button
          className="btn-secondary"
          style={{ width: "100%", marginTop: "0.75rem" }}
          onClick={handleClear}
        >
          🗑 Clear All & Start Over
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Analyzing resumes with Groq AI...</p>
          <p className="sub">Usually takes 3–8 seconds</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !loading && (
        <div className="results-section">
          <div className="results-header">
            <h2>🏆 Results — Ranked by Score</h2>
            <span className="results-count">{results.length} candidates</span>
          </div>
          {results.map((r, i) => (
            <ResultCard key={i} data={r} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}