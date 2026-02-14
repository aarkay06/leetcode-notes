const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  doc_type: {
    type: String,
    enum: ["problem", "tag"],
    default: "problem",
  },
  title: {
    type: String,
    required: [true, "A problem must have a title."],
    unique: true,
    trim: true,
  },

  leetcode_id: {
    type: Number,
    sparse: true,
    unique: true,
    required: false,
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
  },
  tags: {
    type: [String],
    required: [true, "Not enough tags related to the Problem"],
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  date_solved: {
    type: Date,
    default: Date.now(),
  },
  review_count: {
    type: Number,
    default: 0,
  },
  reviewed_on: {
    type: [Date],
    default: [],
  },
  next_review: {
    type: Date,
  },
  url: {
    type: String,
  },
  description: {
    type: String,
  },
  code: {
    type: String,
    default: "",
  },
  solution: {
    type: String,
    default: "",
  },
  language: {
    type: String,
    default: "cpp",
  },
});

const Note = mongoose.model("Note", noteSchema);

module.exports = Note;
