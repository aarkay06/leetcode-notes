/*

Design: 
The extension will call the server to create a note in the Mongo Database.
Client website will ask the server to server the notes.
All the notes will have their properties, daate, diffiulty, tags, etc.

*/

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");

dotenv.config({ path: "./config.env" });
const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD,
);
mongoose.connect(DB).then(() => {
  console.log("connection success");
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});
