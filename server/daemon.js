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
console.log(OBSIDIAN_VAULT);
const CLOUD_API_URL = process.env.CLOUD_API_URL;

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

  data.rating = 0;
  data.date_solved = dateSolved;
  data.review_count = 0;
  data.reviewed_on = [];
  data.next_review = nextReview;

  try {
    const filePath = saveToLocalFile(data);
    // We don't await this because we want to reply to Chrome fast
    pushToCloud(data).catch((err) =>
      console.error("Cloud push failed:", err.message),
    );

    res.json({ success: true, filename: path.basename(filePath) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function saveToLocalFile(data) {
  const frontmatter = {
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
  // Sanitize filename
  // const safeTitle = data.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const fileName = `${data.leetcodeId}. ${data.title}.md`;
  console.log(fileName);
  const filePath = path.join(OBSIDIAN_VAULT, fileName);
  console.log(filePath);
  fs.writeFileSync(filePath, fileContent);
  console.log(`[Local] Saved to: ${fileName}`);
  return filePath;
}

// ==========================================
// 2. WATCHER: Sync Edits from Obsidian -> Cloud
// ==========================================

// console.log(`[Watcher] Watching for changes in: ${OBSIDIAN_VAULT}`);

const watcher = chokidar.watch(OBSIDIAN_VAULT, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true, // Don't sync everything on startup, only new changes
  awaitWriteFinish: {
    stabilityThreshold: 2000, // Wait 2s after you stop typing to sync
    pollInterval: 100,
  },
});

watcher.on("change", async (filePath) => {
  if (path.extname(filePath) !== ".md") return;

  console.log(`[Watcher] File changed: ${path.basename(filePath)}`);

  // Read the updated file
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = matter(content);

  // We need the ID to update the correct record in Cloud DB
  if (!parsed.data.leetcode_id) return;

  const payload = parseMarkdownToPayload(parsed.data, parsed.content);

  await pushToCloud(payload);
});

// ==========================================
// 3. CLOUD SYNC: The Uploader
// ==========================================
async function pushToCloud(payload) {
  try {
    console.log("handle cloud.");
    await axios.post(CLOUD_API_URL, payload);
    console.log(`Cloud Sync successful!`);
  } catch (error) {
    console.error(`Cloud Sync failed:`, error.message);
  }
}

function parseMarkdownToPayload(frontmatter, content) {
  return {
    title: frontmatter.title,
    leetcode_id: Number(frontmatter.leetcodeId),
    difficulty: frontmatter.difficulty,
    rating: 0,
    date_solved: frontmatter.date_solved,
    review_count: 0,
    reviewed_on: [],
    next_review: frontmatter.next_review,
    url: date_solved.url,
    tags: date_solved.tags,
  };
}

// Start Server
app.listen(PORT, () => {
  console.log(`Daemon running on http://localhost:${PORT}`);
});
