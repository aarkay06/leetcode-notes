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

const PORT = 3000;
const OBSIDIAN_VAULT = process.env.OBISIDIAN_VAULT;
const LEETCODE_DIR = path.join(OBSIDIAN_VAULT, "Leetcode Problems");
const ALGORITHMS_DIR = path.join(OBSIDIAN_VAULT, "Algorithms");
const CLOUD_API_URL = "http://localhost:8000/api/v1/notes";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/api/problems", async (req, res) => {
  const data = req.body;
  const today = new Date();
  const dateSolved = today.toISOString().split("T")[0];
  const nextReviewDate = new Date();
  nextReviewDate.setDate(today.getDate() + 4);
  const nextReview = nextReviewDate.toISOString().split("T")[0];

  data.leetcode_id = data.leetcodeId ? data.leetcodeId : data.leetcode_id;
  data.rating = 0;
  data.date_solved = dateSolved;
  data.review_count = 0;
  data.reviewed_on = [];
  data.next_review = nextReview;

  try {
    console.log(data);
    const filePath = saveToLocalFile(data);
    ensureTagFilesExist(data.tags);

    // We don't await this because we want to reply to Chrome fast
    pushToCloud(data).catch((err) => alert("Cloud push failed:", err.message));

    res.json({ success: true, filename: path.basename(filePath) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Ensure Tag files exist in Algorithms folder
function ensureTagFilesExist(tags) {
  if (!tags || !Array.isArray(tags)) return;

  tags.forEach((tag) => {
    // Sanitize tag (e.g. "Bit Manipulation" -> "Bit-Manipulation")
    const safeTagName = tag.trim().replace(/\s+/g, "-");
    const tagFilePath = path.join(ALGORITHMS_DIR, `${safeTagName}.md`);

    if (!fs.existsSync(tagFilePath)) {
      const content = `# ${safeTagName}\n\nType your summary and patterns for ${tag} here.\n`;
      fs.writeFileSync(tagFilePath, content);
    }
  });
}

function saveToLocalFile(data) {
  const frontmatter = {
    doc_type: "problem",
    title: data.title,
    leetcode_id: Number(data.leetcodeId),
    difficulty: data.difficulty,
    rating: data.rating,
    date_solved: data.date_solved,
    review_count: data.review_count,
    reviewed_on: data.reviewed_on,
    next_review: data.next_review,
    url: data.url,
    tags: data.tags,
  };

  // 2. Prepare Content
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

  // 3. Write File
  const fileName = `${data.leetcodeId}. ${data.title}.md`;
  const filePath = path.join(LEETCODE_DIR, fileName);
  fs.writeFileSync(filePath, fileContent);
  return filePath;
}

const problem_folder_watcher = chokidar.watch(LEETCODE_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true, // Don't sync everything on startup, only new changes
  awaitWriteFinish: {
    stabilityThreshold: 30000, // Wait 2s after you stop typing to sync
    pollInterval: 100,
  },
});

const tags_folder_watcher = chokidar.watch(ALGORITHMS_DIR, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 30000, // Wait 2s after you stop typing to sync
    pollInterval: 100,
  },
});

tags_folder_watcher.on("change", async (filePath) => {
  if (path.extname(filePath) !== ".md") return;

  const fileName = path.basename(filePath, ".md"); // "Binary-Search"
  const content = fs.readFileSync(filePath, "utf8");

  const payload = {
    doc_type: "tag",
    title: fileName,
    description: content,
    tags: [],
    leetcode_id: undefined, // Explicitly undefined so server validation passes
  };

  await pushToCloud(payload);
});

problem_folder_watcher.on("change", async (filePath) => {
  if (path.extname(filePath) !== ".md") return;

  console.log(`[Watcher] File changed: ${path.basename(filePath)}`);

  // Read the updated file
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = matter(content);

  // We need the ID to update the correct record in Cloud DB
  if (!parsed.data.leetcode_id) return;

  const payload = parseMarkdownToPayload(parsed.data, parsed.content);

  await updateToCloud(payload);
});

async function pushToCloud(payload) {
  try {
    await axios.post(CLOUD_API_URL, payload);
    console.log(`Cloud Sync successful!`);
  } catch (error) {
    console.error(`Cloud Sync failed:`, error.message);
  }
}

async function updateToCloud(payload) {
  try {
    const response = await axios.patch(CLOUD_API_URL, payload);
    console.log(`Cloud update successful!, ${response}`);
  } catch (error) {
    console.error(`Cloud update failed:`, error.message);
  }
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
  // Regex to remove the wrapping code block backticks if present
  const cleanDescription = rawDescription
    .replace(/^```[\w+\s]*\n([\s\S]*?)```$/i, "$1")
    .trim();

  const solutionText = extractSection("Solution");

  // The code section contains a code block (```cpp ... ```). We need just the inner code.
  const codeSectionText = extractSection("Code");
  const codeBlockRegex = /```[\w+\s]*\n([\s\S]*?)```/;
  const codeMatch = codeSectionText.match(codeBlockRegex);
  const cleanCode = codeMatch ? codeMatch[1].trim() : "";

  return {
    // Map Frontmatter properties
    title: frontmatter.title,
    leetcode_id: Number(frontmatter.leetcode_id), // Ensure it's a Number
    difficulty: frontmatter.difficulty,
    rating: frontmatter.rating || 0,

    // Dates
    date_solved: frontmatter.date_solved,
    next_review: frontmatter.next_review,
    reviewed_on: frontmatter.reviewed_on || [],
    review_count: frontmatter.review_count || 0,

    // Metadata
    url: frontmatter.url,
    tags: frontmatter.tags || [],

    // The Extracted Content
    description: cleanDescription,
    solution: solutionText,
    code: cleanCode,
    language: "cpp",
  };
}

// Start Server
app.listen(PORT, () => {
  console.log(`Daemon running on http://localhost:${PORT}`);
});
