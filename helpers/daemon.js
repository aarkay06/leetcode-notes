const express = require("express");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const axios = require("axios");
const matter = require("gray-matter");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const PORT = 3000; // Changed to 3001 to avoid conflict if React is on 3000
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT;
const LEETCODE_DIR = path.join(OBSIDIAN_VAULT, "Leetcode Problems");
const ALGORITHMS_DIR = path.join(OBSIDIAN_VAULT, "Algorithms");
const CLOUD_API_URL =
  process.env.CLOUD_API_URL || "http://localhost:8000/api/v1/notes";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ==========================================
// 1. RECEIVER: Handle Data from Chrome Extension
// ==========================================
app.post("/api/problems", async (req, res) => {
  const data = req.body;
  const today = new Date();

  // Basic Data Prep
  data.leetcode_id = data.leetcodeId
    ? Number(data.leetcodeId)
    : Number(data.leetcode_id);
  data.rating = 0;
  data.date_solved = today.toISOString().split("T")[0];
  data.review_count = 0;
  data.reviewed_on = [];

  // Next review = 4 days from now
  const nextReviewDate = new Date();
  nextReviewDate.setDate(today.getDate() + 4);
  data.next_review = nextReviewDate.toISOString().split("T")[0];

  try {
    console.log(`[Extension] Received: ${data.title}`);

    // A. Save to Obsidian
    const filePath = saveToLocalFile(data);

    // B. Ensure Tag Files Exist
    ensureTagFilesExist(data.tags);

    // C. Push to Cloud (Construct proper payload first)
    const cloudPayload = {
      ...data,
      doc_type: "problem", // Important!
      leetcode_id: data.leetcode_id,
    };

    pushToCloud(cloudPayload).catch((err) =>
      console.error("Cloud push failed:", err.message),
    );

    res.json({ success: true, filename: path.basename(filePath) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. WATCHER A: LeetCode Problems
// ==========================================
const problem_folder_watcher = chokidar.watch(LEETCODE_DIR, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
});

const handleProblemSync = async (filePath) => {
  if (path.extname(filePath) !== ".md") return;

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = matter(content);

  // Skip if not a valid problem file
  if (!parsed.data.leetcode_id) return;

  const payload = parseMarkdownToPayload(parsed.data, parsed.content);

  await pushToCloud(payload);
};

problem_folder_watcher.on("change", handleProblemSync);
problem_folder_watcher.on("add", handleProblemSync);
// ==========================================
// 3. WATCHER B: Algorithms (Tags)
// ==========================================
const tags_folder_watcher = chokidar.watch(ALGORITHMS_DIR, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
});

const handleTagSync = async (filePath) => {
  if (path.extname(filePath) !== ".md") return;

  const fileName = path.basename(filePath, ".md");
  const content = fs.readFileSync(filePath, "utf8");

  const payload = {
    doc_type: "tag",
    title: fileName,
    description: content,
    leetcode_id: undefined,
  };

  console.log(payload);
  await pushToCloud(payload);
};

// Sync on BOTH 'add' (auto-creation) and 'change' (manual edits)
tags_folder_watcher.on("add", handleTagSync);
tags_folder_watcher.on("change", handleTagSync);

// ==========================================
// 4. HELPERS
// ==========================================

async function pushToCloud(payload) {
  try {
    await axios.post(CLOUD_API_URL, payload);
    console.log(`Cloud Sync successful: ${payload.title}`);
  } catch (error) {
    console.error(`Cloud Sync failed:`, error.message);
  }
}

function ensureTagFilesExist(tags) {
  if (!tags || !Array.isArray(tags)) return;

  tags.forEach((tag) => {
    const safeTagName = tag.trim().replace(/\s+/g, "-");
    const tagFilePath = path.join(ALGORITHMS_DIR, `${safeTagName}.md`);

    if (!fs.existsSync(tagFilePath)) {
      console.log(`[Tags] Creating new topic: ${safeTagName}`);
      const content = `# ${safeTagName}\n\nType your summary and patterns for ${tag} here.\n`;
      fs.writeFileSync(tagFilePath, content);
    }
  });
}

function saveToLocalFile(data) {
  const frontmatter = {
    doc_type: "problem",
    title: data.title,
    leetcode_id: Number(data.leetcode_id),
    difficulty: data.difficulty,
    rating: data.rating,
    date_solved: data.date_solved,
    review_count: data.review_count,
    reviewed_on: data.reviewed_on,
    next_review: data.next_review,
    url: data.url,
    tags: data.tags,
  };

  const fileContent = `${matter.stringify("", frontmatter).trim()}

# ${data.title}

#### Problem Description
\`\`\`js
${data.description}
\`\`\`

#### Solution
${data.solutionExplanation || "Add your explanation here..."}

#### Code
\`\`\`${data.language}
${data.solution}
\`\`\`

#### Related Problems
`;

  const fileName = `${data.leetcode_id}. ${data.title}.md`;
  const filePath = path.join(LEETCODE_DIR, fileName);
  fs.writeFileSync(filePath, fileContent);
  console.log(`[Local] Saved to: ${fileName}`);
  return filePath;
}

function parseMarkdownToPayload(frontmatter, content) {
  const extractSection = (headerName) => {
    const regex = new RegExp(
      `#### ${headerName}[\\r\\n]+([\\s\\S]*?)(?=####|$)`,
      "i",
    );
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  };

  let rawDescription = extractSection("Problem Description");
  const cleanDescription = rawDescription
    .replace(/^```[\w+\s]*\n([\s\S]*?)```$/i, "$1")
    .trim();

  const solutionText = extractSection("Solution");

  const codeSectionText = extractSection("Code");
  const codeBlockRegex = /```[\w+\s]*\n([\s\S]*?)```/;
  const codeMatch = codeSectionText.match(codeBlockRegex);
  const cleanCode = codeMatch ? codeMatch[1].trim() : "";

  return {
    doc_type: "problem",
    title: frontmatter.title,
    leetcode_id: Number(frontmatter.leetcode_id),
    difficulty: frontmatter.difficulty,
    rating: frontmatter.rating || 0,
    date_solved: frontmatter.date_solved,
    next_review: frontmatter.next_review,
    reviewed_on: frontmatter.reviewed_on || [],
    review_count: frontmatter.review_count || 0,
    url: frontmatter.url,
    tags: frontmatter.tags || [],
    description: cleanDescription,
    solution: solutionText,
    code: cleanCode,
    language: "cpp",
  };
}

// Start Server
app.listen(PORT, () => {
  console.log(`Daemon running on http://localhost:${PORT}`);
  console.log(`Watching: ${LEETCODE_DIR}`);
});
