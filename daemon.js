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

const PORT = 3001;
const OBSIDIAN_VAULT = process.env.OBISIDIAN_VAULT;
const CLOUD_API_URL = process.env.CLOUD_API_URL;

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const watcher = chokidar.watch(OBSIDIAN_VAULT, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
});

watcher
  .on("add", (path) => syncFile("add", path))
  .on("change", (path) => syncFile("update", path));

async function syncFile(change, path) {}
