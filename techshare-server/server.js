const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    "https://techshare-beta.vercel.app",
    "http://localhost:3000",
  ],
  credentials: true,
}));
app.use(express.json());

const { initSocket } = require("./socket");

const authRoutes = require("./src/routes/authRoutes");
const volunteerRoutes = require("./src/routes/volunteerRoutes");
const requestRoutes = require("./src/routes/requestRoutes");
const resourceRoutes = require("./src/routes/resourceRoutes");
const surveyRoutes = require("./src/routes/surveyRoutes");
const chatRoutes = require("./src/routes/chatRoutes");
const reviewRoutes = require("./src/routes/reviewRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reviews", reviewRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    initSocket(server);
    
    server.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  })
  .catch(err => console.error("MongoDB connection error:", err));
