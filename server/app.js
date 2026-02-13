const express = require("express");

// const tourRouter = require('./routes/tourRoutes');
// const userRouter = require('./routes/userRoutes');

const noteRouter = require("./routes/noteRoutes");

const app = express();

// 1) MIDDLEWARES
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.json());
app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  console.log("Hello from the middleware 👋");
  next();
});

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 3) ROUTES
app.use("/api/v1/tours", noteRouter);
// app.use("/api/v1/users", userRouter);

module.exports = app;
