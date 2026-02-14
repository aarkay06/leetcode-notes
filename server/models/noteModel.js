const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "A problem must have a title."],
    unique: true,
    trim: true,
  },

  leetcode_id: {
    type: Number,
    requied: [true, "A problem must have a id."],
    unique: true,
  },
  difficulty: {
    type: String,
    requied: [true, "A problem must have a difficulty."],
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
  url: {
    type: String,
    required: [true, "the problem must have a url associated with it."],
  },
  description: {
    type: String,
    required: [true, "Problem Description missing"],
  },
  code: {
    type: String,
    default: "",
  },
  solution: {
    type: String,
    default: "",
  },
  related_problems_slugs: {
    type: [String],
    default: [],
  },
  language: {
    type: String,
    default: "cpp",
  },
});

const Note = mongoose.model("Note", noteSchema);

module.exports = Note;
