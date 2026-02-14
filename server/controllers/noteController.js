const Note = require("./../models/noteModel");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");

exports.getAllNotes = catchAsync(async (req, res) => {
  const features = new APIFeatures(Note.find(), req.query)
    .filter()
    .limitFields()
    .sort()
    .pagination();

  const notes = await features.query;
  res.status(200).json({
    status: "success",
    results: notes.length,
    data: { notes },
  });
});

exports.createNote = catchAsync(async (req, res) => {
  const newNote = await Note.create(req.body);

  res.status(200).json({
    status: "success",
    data: { newNote },
  });
});

exports.updateNotes = catchAsync(async (req, res, next) => {
  const note = await Note.findOneAndUpdate(
    { leetcode_id: req.body.leetcode_id },
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!note) {
    this.createNote(req, res);
  }

  res.status(200).json({
    status: "success",
    data: {
      note,
    },
  });
});

exports.deleteNote = catchAsync(async (req, res) => {
  await Note.deleteMany();
  res.status(200).json({
    status: "success",
  });
});
