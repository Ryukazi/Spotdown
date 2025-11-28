import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.use("/files", express.static(DOWNLOADS_DIR));

// Extract track ID from Spotify URL
function getTrackId(spotifyUrl) {
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Download MP3 from CDN and save locally
async function downloadFromCDN(trackId, spotifyUrl, filename) {
  const filepath = path.join(DOWNLOADS_DIR, filename);

  // Skip download if file already exists
  if (fs.existsSync(filepath)) return true;

  // Construct dynamic CDN URL per track
  const cdnUrl = `https://cdn-spotify-inter.zm.io.vn/download/${trackId}/GBCEL1300373?name=${spotifyUrl}`;

  try {
    const response = await axios({
      url: cdnUrl,
      method: "GET",
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        Referer: "https://spotify.downloaderize.com", // optional but safer
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

// Handle incoming API requests
async function handleRequest(trackUrl, res) {
  if (!trackUrl)
    return res.json({ success: false, message: "Missing trackUrl" });

  const trackId = getTrackId(trackUrl);
  if (!trackId)
    return res.json({ success: false, message: "Invalid Spotify track URL" });

  // Unique filename per track + timestamp
  const filename = `track_${trackId}_${Date.now()}.mp3`;
  const downloadLink = `${process.env.RENDER_EXTERNAL_URL}/files/${filename}`;

  // Start download in background
  downloadFromCDN(trackId, trackUrl, filename);

  // Respond immediately with JSON link
  res.json({
    success: true,
    download: downloadLink,
  });
}

// POST endpoint
app.post("/api/generate-link", (req, res) => {
  const { trackUrl } = req.body;
  handleRequest(trackUrl, res);
});

// GET endpoint
app.get("/api/generate-link", (req, res) => {
  const trackUrl = req.query.trackUrl;
  handleRequest(trackUrl, res);
});

app.get("/", (req, res) => res.send("Spotify JSON Download API running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
