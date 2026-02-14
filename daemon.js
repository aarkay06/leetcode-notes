const express = require("express");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const axios = require("axios");
const matter = require("gray-matter");
const cors = require("cors");
const bodyParser = require("body-parser");

// --- CONFIGURATION ---
const PORT = 3001; // Local Daemon Port
const OBSIDIAN_VAULT = "C:/Users/YourName/Documents/Obsidian Vault/Leetcode"; // CHANGE THIS
const CLOUD_API_URL = "https://your-vercel-app.vercel.app/api/problems"; // CHANGE THIS
const EXTENSION_TOKEN = "my-secret-token"; // Optional security

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ==========================================
// 1. RECEIVER: Handle Data from Chrome Extension
// ==========================================
app.post("/save-problem", async (req, res) => {
  const data = req.body;
  console.log(`[Extension] Received: ${data.title}`);

  try {
    // A. Write to Local Obsidian File
    const filePath = saveToLocalFile(data);

    // B. Push to Cloud (Background Task)
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

// Helper: Formats and writes the Markdown file
function saveToLocalFile(data) {
  // 1. Prepare Frontmatter
  const frontmatter = {
    title: data.title,
    leetcode_id: data.leetcodeId,
    difficulty: data.difficulty,
    tags: data.tags,
    url: data.url,
    date_solved: new Date().toISOString(),
  };

  // 2. Prepare Content
  const fileContent = `---
${matter.stringify("", frontmatter).trim()}
---

# ${data.title}

#### Problem Description
${data.description}

#### Solution
${data.solutionExplanation || "Add your explanation here..."}

#### Code
\`\`\`${data.language}
${data.solution}
\`\`\`
`;

  // 3. Write File
  // Sanitize filename
  const safeTitle = data.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const fileName = `${data.leetcodeId}. ${data.title}.md`;
  const filePath = path.join(OBSIDIAN_VAULT, fileName);

  fs.writeFileSync(filePath, fileContent);
  console.log(`[Local] Saved to: ${fileName}`);
  return filePath;
}

// ==========================================
// 2. WATCHER: Sync Edits from Obsidian -> Cloud
// ==========================================
console.log(`[Watcher] Watching for changes in: ${OBSIDIAN_VAULT}`);

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

  // Parse out the sections (Description, Solution, Code)
  // (Reuse the extraction logic from your migration script here)
  const payload = parseMarkdownToPayload(parsed.data, parsed.content);

  // Push update to Cloud
  await pushToCloud(payload);
});

// ==========================================
// 3. CLOUD SYNC: The Uploader
// ==========================================
async function pushToCloud(payload) {
  try {
    console.log(`[Cloud] Syncing ${payload.title || payload.name}...`);
    // Assuming your API handles both Create (POST) and Update (PUT) logic intelligently
    // or uses upsert based on leetcode_id
    await axios.post(CLOUD_API_URL, payload);
    console.log(`[Cloud] ✅ Sync successful!`);
  } catch (error) {
    console.error(`[Cloud] ❌ Sync failed:`, error.message);
  }
}

// Helper to parse the full markdown back into JSON for the API
function parseMarkdownToPayload(frontmatter, content) {
  // ... Copy the regex logic from your migrate.js script here ...
  // This ensures that when you edit the text in Obsidian, the specific
  // fields (Description vs Solution) are updated correctly in the DB.

  // Simple placeholder return for now:
  return {
    id: frontmatter.leetcode_id,
    name: frontmatter.title,
    // ... mapped fields
  };
}

// Start Server
app.listen(PORT, () => {
  console.log(`Daemon running on http://localhost:${PORT}`);
});
