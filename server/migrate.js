const fs = require("fs");
const path = require("path");
const matter = require("gray-matter"); // Parses Frontmatter
const axios = require("axios");
const glob = require("glob"); // Finds all .md files

// CONFIGURATION
const API_URL = "http://localhost:3000/api/v1/notes/"; // Your local server
const NOTES_DIR = "C:\\Obsidian\\Coding and Programmes\\DSA\\Leetcode Problems"; // <--- CHANGE THIS

async function migrate() {
  // 1. Find all markdown files
  const files = glob.sync(`${NOTES_DIR}/**/*.md`);
  console.log(`Found ${files.length} notes. Starting migration...`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    try {
      const rawContent = fs.readFileSync(file, "utf8");

      // 2. Parse Frontmatter vs Content
      const { data: frontmatter, content } = matter(rawContent);

      // Skip if it's not a LeetCode note (e.g., missing leetcode_id)
      if (!frontmatter.leetcode_id) {
        console.log(`Skipping (no id): ${path.basename(file)}`);
        continue;
      }

      // 3. Extract Slug from URL (Safest method)
      // URL format: https://leetcode.com/problems/single-number-ii/description/
      let slug = "unknown";
      if (frontmatter.url) {
        const parts = frontmatter.url.split("/").filter((p) => p.length > 0);
        // usually the slug is after 'problems'
        const probIndex = parts.indexOf("problems");
        if (probIndex !== -1 && parts[probIndex + 1]) {
          slug = parts[probIndex + 1];
        }
      }

      // 4. Extract Code from Content
      // We look for the first code block ```cpp or ```java etc.
      const codeBlockRegex = /```[\w+\s]*\n([\s\S]*?)```/;
      const codeMatch = content.match(codeBlockRegex);
      const solutionCode = codeMatch
        ? codeMatch[1].trim()
        : "// No code found in note";

      // 5. Extract Description
      // Assuming description is everything BEFORE the code block but AFTER the title header
      // This is a rough heuristic; might need tweaking based on your exact note format
      let description = content.split("```")[0].trim();
      // Remove the "# Title" if present
      description = description.replace(/^#\s+.+\n/, "").trim();

      // 6. Prepare Payload matching your Schema
      const payload = {
        name: frontmatter.title,
        id: frontmatter.leetcode_id.toString(), // Ensure string
        difficulty: frontmatter.difficulty,
        tags: Array.isArray(frontmatter.tags)
          ? frontmatter.tags
          : [frontmatter.tags],
        solution: solutionCode,
        language: "cpp", // Default or detect from ```cpp
        description: description,
        url: frontmatter.url || "",
        slugs: [], // Old notes won't have related slugs, send empty
      };

      // 7. Send to API
      await axios.post(API_URL, payload);
      console.log(`✅ Migrated: ${frontmatter.title}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed: ${path.basename(file)} - ${error.message}`);
      failCount++;
    }
  }

  console.log(
    `\nMigration Complete! Success: ${successCount}, Failed: ${failCount}`,
  );
}

migrate();
