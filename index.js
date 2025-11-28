import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Serve downloaded MP3s
app.use("/files", express.static(DOWNLOADS_DIR));

// Function to download MP3 to server
async function downloadToServer(url, filename) {
  const filepath = path.join(DOWNLOADS_DIR, filename);
  if (fs.existsSync(filepath)) return filepath; // skip if already downloaded

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filepath));
    writer.on("error", reject);
  });
}

// API endpoint
app.get("/api/spotify/download", async (req, res) => {
  const trackUrl = req.query.url;
  if (!trackUrl) return res.json({ success: false, message: "Missing track URL" });

  try {
    // 1. Call ASMIT DWN20 API
    const asmitResponse = await axios.get("https://asmitdwn20.vercel.app/api/spotify/download", {
      params: { url: trackUrl },
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const data = asmitResponse.data;
    if (!data.success || !data.data?.downloadLinks?.length)
      return res.json({ success: false, message: "Failed to fetch track from ASMIT DWN20" });

    const track = data.data;
    const originalCdnUrl = track.downloadLinks[0].url;

    // 2. Download MP3 to server
    const trackId = trackUrl.match(/track\/([a-zA-Z0-9]+)/)?.[1] || Date.now();
    const filename = `track_${trackId}.mp3`;
    await downloadToServer(originalCdnUrl, filename);

    // 3. Generate hosted link
    const hostedLink = `${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/files/${filename}`;

    // 4. Return JSON with hosted link
    res.json({
      success: true,
      data: {
        title: track.title,
        author: track.author,
        duration: track.duration,
        thumbnail: track.thumbnail,
        downloadLinks: [
          {
            url: hostedLink,
            quality: track.downloadLinks[0].quality,
            extension: track.downloadLinks[0].extension,
            type: track.downloadLinks[0].type,
          },
        ],
      },
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.get("/", (req, res) => res.send("Spotify JSON Download API using ASMIT DWN20 running"));

app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
