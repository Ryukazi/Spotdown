import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

// Folder to store MP3 files
const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Serve files statically
app.use("/files", express.static(DOWNLOADS_DIR));

// Function to get trackId from Spotify URL
function getTrackId(spotifyUrl) {
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Download MP3 from CDN API
async function downloadFromCDN(trackId, spotifyUrl, filename) {
  const filepath = path.join(DOWNLOADS_DIR, filename);
  const cdnUrl = `Https://cdn-spotify-inter.zm.io.vn/download/5XeFesFbtLpXzlVDNQP22n/GBCEL1300373?name=${spotifyUrl}`;

  try {
    const response = await axios({
      url: cdnUrl,
      method: "GET",
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      },
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(true));
      writer.on("error", reject);
    });
  } catch (e) {
    console.log("Download error:", e.message);
    return false;
  }
}

// POST endpoint
app.post("/api/generate-link", async (req, res) => {
  const { trackUrl } = req.body;
  if (!trackUrl) return res.json({ success: false, message: "Missing trackUrl" });

  const trackId = getTrackId(trackUrl);
  if (!trackId) return res.json({ success: false, message: "Invalid Spotify track URL" });

  const filename = `track_${Date.now()}.mp3`;
  const downloadLink = `${process.env.RENDER_EXTERNAL_URL}/files/${filename}`;

  // Start download in background
  downloadFromCDN(trackId, trackUrl, filename);

  // Respond immediately with JSON
  res.json({
    success: true,
    download: downloadLink,
  });
});

// GET endpoint
app.get("/api/generate-link", async (req, res) => {
  const trackUrl = req.query.trackUrl;
  if (!trackUrl) return res.json({ success: false, message: "Missing trackUrl" });

  const trackId = getTrackId(trackUrl);
  if (!trackId) return res.json({ success: false, message: "Invalid Spotify track URL" });

  const filename = `track_${Date.now()}.mp3`;
  const downloadLink = `${process.env.RENDER_EXTERNAL_URL}/files/${filename}`;

  // Start download in background
  downloadFromCDN(trackId, trackUrl, filename);

  // Respond immediately with JSON
  res.json({
    success: true,
    download: downloadLink,
  });
});

// Root
app.get("/", (req, res) => res.send("Spotify JSON Download API running"));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
