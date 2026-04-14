require('dotenv').config()
const express = require("express");

const app = express();

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/dnano-site", (req, res) => {
    res.send("This is dnano's porfolio site")
})

app.get("/html-page", (req, res) => {
    res.send("<h1>Ham html bhe bhe j sakte hain response me!</h1>")
})

app.get("/youtube", (req, res) => {
    res.send('<h2 style="text-transform: capitalize; color: #e67e00;">chai aur backend</h2>');
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
