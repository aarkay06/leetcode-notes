const fs = require("fs");
const path = require("path");
const matter = require("gray-matter"); // Separates YAML frontmatter from the rest
const axios = require("axios");
const glob = require("glob");

// --- CONFIGURATION ---
const API_URL = "http://localhost:3000/api/v1/notes";
// CHANGE THIS TO YOUR ACTUAL OBSIDIAN PATH
const NOTES_DIR = "C:\\Obsidian\\Coding and Programmes\\DSA\\Leetcode Problems";

async function migrate() {
  // 1. Find all markdown files
  const files = glob.sync(`${NOTES_DIR}/**/*.md`);
  console.log(`Found ${files.length} notes. Starting migration...`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    try {
      const rawContent = fs.readFileSync(file, "utf8");

      // 2. Parse Frontmatter (YAML) vs Body Content
      const { data: frontmatter, content } = matter(rawContent);

      // Skip if missing critical metadata (like ID)
      if (!frontmatter.leetcode_id) {
        console.log(`Skipping (no id): ${path.basename(file)}`);
        continue;
      }

      // --- NEW PARSING LOGIC START ---

      // Helper to extract text between specific headers
      // It looks for "#### HeaderName", grabs everything until the NEXT "####" or End of File
      const extractSection = (headerName, text) => {
        const regex = new RegExp(
          `#### ${headerName}[\\r\\n]+([\\s\\S]*?)(?=####|$)`,
          "i",
        );
        const match = text.match(regex);
        return match ? match[1].trim() : "";
      };

      // 1. Extract Description
      let description = extractSection("Problem Description", content);

      // 2. Extract Solution (Explanation)
      let solutionText = extractSection("Solution", content);

      // 3. Extract Code
      // First, get the whole "Code" section text
      const codeSection = extractSection("Code", content);
      // Then, extract JUST the code inside the ```cpp ... ``` block
      // We match the first code block found in that section
      const codeBlockRegex = /```[\w+\s]*\n([\s\S]*?)```/;
      const codeMatch = codeSection.match(codeBlockRegex);
      const cleanCode = codeMatch ? codeMatch[1].trim() : "";

      // --- NEW PARSING LOGIC END ---

      // 4. Construct Payload
      const payload = {
        title: frontmatter.title, // Maps to 'name' in your schema
        id: Number(frontmatter.leetcode_id), // Maps to 'id' (Number)
        difficulty: frontmatter.difficulty,
        tags: Array.isArray(frontmatter.tags)
          ? frontmatter.tags
          : [frontmatter.tags],
        url: frontmatter.url || "",

        // mapped fields
        description: description || "No description provided.",
        solution: solutionText, // The text explanation
        code: cleanCode, // The raw code
        language: "cpp", // Default to cpp as per your snippets

        // Default values for other schema fields
        rating: frontmatter.rating || 0,
        date_solved: frontmatter.date_solved || new Date(),
        related_problems_slugs: [], // You can add logic to parse [[links]] later if needed
      };

      // 5. Send to Server
      await axios.post(API_URL, payload);
      console.log(`✅ Migrated: ${frontmatter.title}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed: ${path.basename(file)}`);
      if (error.response) {
        console.error(
          `   Server Error: ${JSON.stringify(error.response.data)}`,
        );
      } else {
        console.error(`   Error: ${error.message}`);
      }
      failCount++;
    }
  }

  console.log(
    `\nMigration Complete! Success: ${successCount}, Failed: ${failCount}`,
  );
}

migrate();
