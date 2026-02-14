const express = require("express");
const noteRouter = require("./routes/noteRoutes");

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  console.log("Hello from the middleware 👋");
  next();
});

app.use("/api/v1/notes", noteRouter);
// app.use("/api/v1/users", userRouter);

module.exports = app;
