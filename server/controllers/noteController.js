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
  console.log(req.body);
  try {
    if (req.body.doc_type === "tag") {
      filter = { title: req.body.title, doc_type: "tag" };
    } else {
      filter = { leetcode_id: req.body.leetcode_id };
    }
    const note = await Note.findOneAndUpdate(filter, req.body, {
      new: true,
      runValidators: true,
      upsert: true,
    });
    res.status(200).json({
      status: "success",
      data: { note },
    });
  } catch (error) {
    throw new AppError(error);
  }
});

exports.deleteNote = catchAsync(async (req, res) => {
  await Note.deleteMany();
  res.status(200).json({
    status: "success",
  });
});
