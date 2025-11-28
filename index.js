import express from "express";
import axios from "axios";
import qs from "qs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Optional: Add your Downloaderize cookies here for reliability
const COOKIES = "ECDFCE%3Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C583c583232c0c%22b5b5c0c%225bd8b25e4a8e8b8f4165800d53f35c%22c%225b17642948b4c%229700000x50a%5D%225c%05D%5D; FCNEC=%5B%5B%222AkR6iM8RN-LN5Ghi1p-skg5ToLG3PYZIkIYBpZDFmu7uUbU4R8fTn7rGmMbLcCUzecJqL25IjWcZpb-EUNXUSkJ2q_XorMtpps0n0npKMb2Pdo4Nj1iSuKRIaveenBBaek7GcSe0XOr0BtkDH71pPy9h-ITa%3D%3D%22%5D%5D"; // Example: "PHPSESSID=xxxx; other_cookie=yyy"

// Function to fetch the MP3 link for a given Spotify track
async function getDownloadLink(trackUrl) {
  try {
    const payload = qs.stringify({
      action: "get_track",
      track_url: trackUrl,
    });

    const response = await axios.post(
      "https://spotify.downloaderize.com/wp-admin/admin-ajax.php",
      payload,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
          "Origin": "https://spotify.downloaderize.com",
          "Referer": "https://spotify.downloaderize.com/",
          "X-Requested-With": "XMLHttpRequest",
          ...(COOKIES ? { Cookie: COOKIES } : {}),
        },
      }
    );

    const data = response.data;

    if (
      data.success &&
      data.data &&
      data.data.medias &&
      data.data.medias.length > 0
    ) {
      // Extract the MP3 URL from medias[0]
      const mp3Url = data.data.medias[0].url;
      return { success: true, download: mp3Url };
    } else {
      return { success: false, message: "No MP3 URL found" };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// POST endpoint
app.post("/api/generate-link", async (req, res) => {
  const { trackUrl } = req.body;
  if (!trackUrl) return res.json({ success: false, message: "Missing trackUrl" });

  const result = await getDownloadLink(trackUrl);
  res.json(result);
});

// GET endpoint
app.get("/api/generate-link", async (req, res) => {
  const trackUrl = req.query.trackUrl;
  if (!trackUrl) return res.json({ success: false, message: "Missing trackUrl" });

  const result = await getDownloadLink(trackUrl);
  res.json(result);
});

// Root endpoint
app.get("/", (req, res) => res.send("Spotify JSON Download API running"));

// Start server
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
