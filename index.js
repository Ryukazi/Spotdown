import express from "express";
import axios from "axios";
import qs from "qs";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Optional: Add your Downloaderize cookies here for reliability
const COOKIES = "ECDFCE%3Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C583c583232c0c%22b5b5c0c%225bd8b25e4a8e8b8f4165800d53f35c%22c%225b17642948b4c%229700000x50a%5D%225c%05D%5D; FCNEC=%5B%5B%222AkR6iM8RN-LN5Ghi1p-skg5ToLG3PYZIkIYBpZDFmu7uUbU4R8fTn7rGmMbLcCUzecJqL25IjWcZpb-EUNXUSkJ2q_XorMtpps0n0npKMb2Pdo4Nj1iSuKRIaveenBBaek7GcSe0XOr0BtkDH71pPy9h-ITa%3D%3D%22%5D%5D"; // Example: "PHPSESSID=xxxx; other_cookie=yyy"

// Directory to store downloaded MP3s
const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Serve downloaded files
app.use("/files", express.static(DOWNLOADS_DIR));

// Fetch nonce dynamically from Downloaderize homepage
async function fetchNonce() {
  try {
    const homepage = await axios.get("https://spotify.downloaderize.com/", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const match = homepage.data.match(/"spotify_downloader_get_info","nonce":"([a-z0-9]+)"/);
    return match ? match[1] : null;
  } catch (err) {
    console.error("Failed to fetch nonce:", err.message);
    return null;
  }
}

// Get MP3 download URL from Downloaderize
async function getCdnLink(trackUrl) {
  const nonce = await fetchNonce();
  if (!nonce) return null;

  const payload = qs.stringify({
    action: "spotify_downloader_get_info",
    url: trackUrl,
    nonce,
  });

  const response = await axios.post(
    "https://spotify.downloaderize.com/wp-admin/admin-ajax.php",
    payload,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://spotify.downloaderize.com",
        "Referer": "https://spotify.downloaderize.com/",
        "X-Requested-With": "XMLHttpRequest",
        ...(COOKIES ? { Cookie: COOKIES } : {}),
      },
    }
  );

  const data = response.data;
  if (data.success && data.data?.medias?.length > 0) {
    return data.data.medias[0].url;
  } else {
    return null;
  }
}

// Download MP3 from CDN and save to Render
async function downloadToServer(cdnUrl, filename) {
  const filepath = path.join(DOWNLOADS_DIR, filename);
  if (fs.existsSync(filepath)) return filepath; // Skip if already exists

  const response = await axios({
    url: cdnUrl,
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

// Generate JSON download link
async function handleRequest(trackUrl, res) {
  if (!trackUrl) return res.json({ success: false, message: "Missing trackUrl" });

  // Use track ID in filename to make it unique
  const trackIdMatch = trackUrl.match(/track\/([a-zA-Z0-9]+)/);
  const trackId = trackIdMatch ? trackIdMatch[1] : Date.now();
  const filename = `track_${trackId}.mp3`;

  try {
    const cdnLink = await getCdnLink(trackUrl);
    if (!cdnLink) return res.json({ success: false, message: "Failed to get CDN link" });

    // Download MP3 and host on Render
    await downloadToServer(cdnLink, filename);

    const downloadLink = `${process.env.RENDER_EXTERNAL_URL}/files/${filename}`;
    res.json({ success: true, download: downloadLink });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
}

// Endpoints
app.post("/api/generate-link", (req, res) => handleRequest(req.body.trackUrl, res));
app.get("/api/generate-link", (req, res) => handleRequest(req.query.trackUrl, res));

app.get("/", (req, res) => res.send("Spotify JSON Download API running"));

app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
