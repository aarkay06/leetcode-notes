const Note = require("./../models/noteModel");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");

// exports.aliasingMiddleware = (req, res, next) => {
//   req.query.sort = '-ratingsAverage,price';
//   req.query.fields = 'name,price,summary,difficulty';
//   next();
// };

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
  const newNote = await Note.create(req.body);

  res.status(200).json({
    status: "success",
    data: { newNote },
  });
});

exports.updateNote = catchAsync(async (req, res) => {});

exports.deleteNote = catchAsync(async (req, res) => {
  await Note.deleteMany();
});
