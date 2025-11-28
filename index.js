import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

// Folder for storing downloaded audio
const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");

// Ensure folder exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Serve downloaded files statically
app.use("/files", express.static(DOWNLOADS_DIR));

// API: Generate download link
app.post("/api/generate-link", async (req, res) => {
  try {
    const { trackUrl } = req.body;
    if (!trackUrl) return res.json({ success: false, message: "Missing trackUrl" });

    // Direct-download endpoint (streams audio)
    const directEndpoint = `https://spotdown.org/api/check-direct-download?url=${trackUrl}`;

    // File name and path
    const filename = `track_${Date.now()}.mp3`;
    const filepath = path.join(DOWNLOADS_DIR, filename);

    // Stream audio from endpoint
    const response = await axios({
      url: directEndpoint,
      method: "GET",
      responseType: "stream"
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      return res.json({
        success: true,
        download: `${process.env.RENDER_EXTERNAL_URL}/files/${filename}`
      });
    });

    writer.on("error", () => {
      return res.json({ success: false, message: "File save failed" });
    });

  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// Root endpoint for testing
app.get("/", (req, res) => res.send("Download URL Generator API running"));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on PORT", PORT));
