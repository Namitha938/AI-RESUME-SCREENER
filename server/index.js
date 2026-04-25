import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Resume Screener API running ✅" });
});

// Single resume screen (with PDF support)
app.post("/api/screen", upload.single("resume"), async (req, res) => {
  try {
    const { jobDescription, resumeText } = req.body;
    let finalResumeText = resumeText;

    if (req.file) {
      const parsed = await pdfParse(req.file.buffer);
      finalResumeText = parsed.text;
    }

    if (!jobDescription || !finalResumeText) {
      return res.status(400).json({ error: "Job description and resume text are required." });
    }

    const prompt = `
You are an expert HR recruiter and resume screener.

Analyze the resume below against the job description and return ONLY valid JSON in this exact format:
{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendation": "<Strongly Recommend / Recommend / Maybe / Reject>",
  "topSkillsMatched": ["<skill1>", "<skill2>", "<skill3>"],
  "experience_fit": "<Overqualified / Strong Fit / Partial Fit / Underqualified>"
}

JOB DESCRIPTION:
${jobDescription}

RESUME:
${finalResumeText}

Return ONLY the JSON object. No explanation, no markdown, no extra text.
`;

    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const raw = completion.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response format");
    const result = JSON.parse(jsonMatch[0]);

    res.json({ success: true, result });
  } catch (err) {
    console.error("Screen error:", err.message);
    res.status(500).json({ error: err.message || "Screening failed" });
  }
});

// Batch screen multiple resumes
app.post("/api/screen-batch", async (req, res) => {
  try {
    const { jobDescription, resumes } = req.body;

    if (!jobDescription || !resumes || resumes.length === 0) {
      return res.status(400).json({ error: "Job description and resumes array are required." });
    }

    const results = await Promise.all(
      resumes.map(async (resume, index) => {
        const prompt = `
You are an expert HR recruiter. Analyze this resume against the job description.
Return ONLY valid JSON in this exact format:
{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendation": "<Strongly Recommend / Recommend / Maybe / Reject>",
  "topSkillsMatched": ["<skill1>", "<skill2>", "<skill3>"],
  "experience_fit": "<Overqualified / Strong Fit / Partial Fit / Underqualified>"
}

JOB DESCRIPTION:
${jobDescription}

RESUME (Candidate ${index + 1} - ${resume.name}):
${resume.text}

Return ONLY the JSON object. No explanation, no markdown, no extra text.
`;

        const completion = await groq.chat.completions.create({
          model: "llama3-70b-8192",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1000,
        });

        const raw = completion.choices[0].message.content.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error(`Invalid response for candidate ${index + 1}`);
        const result = JSON.parse(jsonMatch[0]);

        return { name: resume.name, ...result };
      })
    );

    // Sort by score highest first
    results.sort((a, b) => b.score - a.score);
    res.json({ success: true, results });
  } catch (err) {
    console.error("Batch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});