// content.js - Fully Fixed for CSP & Submission Structure

// 1. Create the Navbar Button
function createNavbarButton() {
  if (document.getElementById("obsidian-save-btn")) return;

  const targetContainer = document.querySelector(
    ".relative.flex.items-center.justify-end.gap-2",
  );
  if (!targetContainer) {
    // Retry if navbar isn't ready yet
    setTimeout(createNavbarButton, 1000);
    return;
  }

  const btnDiv = document.createElement("div");
  btnDiv.id = "obsidian-save-btn";
  btnDiv.className =
    "flex cursor-pointer rounded-lg p-2 text-sd-muted-foreground hover:text-sd-foreground hover:bg-fill-tertiary dark:hover:bg-fill-tertiary items-center justify-center";
  btnDiv.setAttribute("role", "button");
  btnDiv.title = "Save to Obsidian";

  // Icon: Scaled to 18px
  btnDiv.innerHTML = `
        <div class="relative text-[16px] leading-[normal]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="h-[18px] w-[18px]">
                <path d="M12,2L2,12l10,10l10-10L12,2z M12,19.5L4.5,12L12,4.5L19.5,12L12,19.5z"/>
                <path d="M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S14.76,7,12,7z M12,15c-1.65,0-3-1.35-3-3s1.35-3,3-3s3,1.35,3,3S13.65,15,12,15z"/>
            </svg>
        </div>
    `;

  btnDiv.onclick = () => initiateScrape(true);
  targetContainer.insertBefore(btnDiv, targetContainer.firstChild);
}

// 2. Helper: Clean Text
function cleanText(text) {
  return text ? text.replace(/\s+/g, " ").trim() : "";
}

// 3. Helper: Format Tags
function formatTag(tag) {
  return tag.trim().replace(/\s+/g, "-");
}

// 4. Extraction Logic: Submitted Code (Success View)
function getSubmittedCodeFromDOM() {
  // Target the specific container for submission results (Gray box)
  // We look for the class 'bg-fill-quaternary' which you identified in the snippet
  const codeContainer = document.querySelector(".bg-fill-quaternary");

  if (!codeContainer) return null;

  // 1. Auto-Expand "View More" if it exists
  const viewMoreBtn = Array.from(codeContainer.querySelectorAll("div")).find(
    (el) => el.innerText && el.innerText.includes("View more"),
  );
  if (viewMoreBtn) {
    console.log("Expanding 'View More'...");
    viewMoreBtn.click();
  }

  // 2. Find the code block inside this container
  const codeElement = codeContainer.querySelector("code");
  if (!codeElement) return null;

  // 3. Clone and Clean
  const clone = codeElement.cloneNode(true);

  // Remove line numbers (spans with class 'linenumber' or 'react-syntax-highlighter-line-number')
  const lineNumbers = clone.querySelectorAll(
    'span[class*="linenumber"], span[class*="react-syntax-highlighter-line-number"]',
  );
  lineNumbers.forEach((el) => el.remove());

  // 4. Get text
  return clone.innerText.trim();
}

// 5. Extraction Logic: Editor (Fallback for Manual Save)
function getCodeFromEditor() {
  const codeLines = document.querySelectorAll(".view-line");
  if (codeLines.length > 0) {
    return Array.from(codeLines)
      .map((line) => line.innerText.replace(/\u00A0/g, " "))
      .join("\n");
  }
  return "";
}

// 6. Scrape Logic Wrapper
async function initiateScrape(isManual) {
  console.log("Initiating scrape...");

  let finalCode = "";

  // Strategy:
  // 1. If Auto-Save (not manual), look ONLY at the Submitted DOM (Result View)
  // 2. If Manual, try Editor first, then fallback to Submitted DOM

  if (!isManual) {
    // --- AUTO MODE ---
    // Retry loop: The "Success" view takes a moment to render the code block
    for (let i = 0; i < 15; i++) {
      // Try for 7.5 seconds
      finalCode = getSubmittedCodeFromDOM();
      if (finalCode && finalCode.length > 20) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  } else {
    // --- MANUAL MODE ---
    finalCode = getCodeFromEditor(); // Try active editor

    // If editor empty (maybe on submission tab), try submission view
    if (!finalCode || finalCode.trim().length === 0) {
      finalCode = getSubmittedCodeFromDOM();
    }
  }

  if (!finalCode || finalCode.trim().length === 0) {
    if (isManual)
      alert("❌ Could not extract code. Please ensure code is visible.");
    console.warn("Scrape failed: No code found.");
    return;
  }

  scrapeAndSend(isManual, finalCode);
}

function getRelatedProblems() {
  // 1. Find all the problem links in that specific list
  // The selector looks for links inside the list container you showed me
  const relatedLinks = document.querySelectorAll(
    "div.flex.w-full.items-center.justify-between a",
  );

  const slugs = [];

  relatedLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      // href looks like: "/problems/find-all-numbers-disappeared-in-an-array/"
      // We want just: "find-all-numbers-disappeared-in-an-array"
      const parts = href.split("/").filter((p) => p.length > 0);
      const slug = parts[parts.length - 1]; // The last part is the slug
      slugs.push(slug);
    }
  });

  return slugs;
}

// 7. Main Scraper & Sender
function scrapeAndSend(isManual, solutionCode) {
  // Title & ID
  const titleEl =
    document.querySelector(".text-title-large") ||
    document.querySelector('[data-cy="question-title"]');
  const pathParts = window.location.pathname.split("/");
  const slug = pathParts[2] || "unknown";
  let title = titleEl ? cleanText(titleEl.innerText) : slug;

  const idMatch = title.match(/^(\d+)\./);
  const leetcodeId = idMatch ? idMatch[1] : "0";
  title = title.replace(/^\d+\.\s*/, "");
  const slugs = getRelatedProblems();

  // Difficulty
  const diffEl =
    document.querySelector(".text-difficulty-easy") ||
    document.querySelector(".text-difficulty-medium") ||
    document.querySelector(".text-difficulty-hard");
  const difficulty = diffEl ? cleanText(diffEl.innerText) : "Medium";

  // Tags
  let tags = [];
  document
    .querySelectorAll('a[href*="/tag/"]')
    .forEach((el) => tags.push(el.innerText));
  if (tags.length === 0) tags.push("Uncategorized");
  const formattedTags = [...new Set(tags)].map(formatTag);

  // Description
  const descEl = document.querySelector(
    '[data-track-load="description_content"]',
  );
  const description = descEl ? descEl.innerText : "No description found.";

  // Stats (Runtime/Memory)
  const stats = { runtime: "", memory: "" };
  const resultText = document.body.innerText;
  const runtimeMatch = resultText.match(/Runtime\s*([\d\.]+\s*ms)/i);
  const memoryMatch = resultText.match(/Memory\s*([\d\.]+\s*MB)/i);
  if (runtimeMatch) stats.runtime = runtimeMatch[1];
  if (memoryMatch) stats.memory = memoryMatch[1];

  const problemData = {
    title,
    leetcodeId,
    difficulty,
    tags: formattedTags,
    solution: solutionCode,
    language: "cpp",
    description,
    url: window.location.href,
    stats,
    slugs,
  };

  console.log("Sending Payload:", problemData);

  fetch("http://localhost:3000/api/problems", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problemData),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        const msg =
          data.type === "appended"
            ? `✅ Appended new solution to: ${data.filename}`
            : `✅ Created: ${data.filename}`;
        console.log(msg);

        // Visual confirmation
        const toast = document.createElement("div");
        toast.style.cssText =
          "position:fixed;top:20px;right:20px;background:#22c55e;color:white;padding:10px 20px;border-radius:5px;z-index:9999;font-weight:bold;";
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } else {
        if (isManual) alert(`⚠️ Error: ${data.error}`);
      }
    })
    .catch((err) => {
      console.error("Server Error:", err);
    });
}

// 8. Auto-Watcher
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    createNavbarButton();
  }

  // Check for Success Message
  // Looking for "Submission Result" header + "Accepted" status
  const successHeader = document.body.innerText.includes("Submission Result");
  const acceptedText = document.body.innerText.includes("Accepted");

  // Logic: If we see "Accepted" and haven't saved recently
  if (successHeader && acceptedText && !document.body.dataset.hasAutoSaved) {
    console.log("Success detected. Attempting auto-save...");
    document.body.dataset.hasAutoSaved = "true";

    // Reset flag after 10 seconds to allow next submission
    setTimeout(() => {
      document.body.dataset.hasAutoSaved = "";
    }, 10000);

    initiateScrape(false);
  }
}).observe(document, { subtree: true, childList: true });

setTimeout(createNavbarButton, 2000);
