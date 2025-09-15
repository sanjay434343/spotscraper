// api/playlist.js
const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Serve a small UI for entering Spotify playlist URL
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Spotify Playlist Scraper</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          input, button { padding: 10px; font-size: 16px; }
          .song { margin: 10px 0; }
        </style>
      </head>
      <body>
        <h2>Spotify Playlist Scraper</h2>
        <form method="get" action="/scrape">
          <input type="text" name="url" placeholder="Enter Spotify playlist URL" size="50" required/>
          <button type="submit">Scrape</button>
        </form>
      </body>
    </html>
  `);
});

// Scraper endpoint
app.get("/scrape", async (req, res) => {
  const playlistUrl = req.query.url;
  if (!playlistUrl) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(playlistUrl, { waitUntil: "networkidle2" });

    // Scrape playlist title and songs
    const data = await page.evaluate(() => {
      const title = document.querySelector("h1")?.innerText || "Untitled Playlist";

      const songs = [];
      document.querySelectorAll("[data-testid='tracklist-row']").forEach((row) => {
        const trackName = row.querySelector("div span")?.innerText;
        const artist = row.querySelector("a[data-testid='entity-link']")?.innerText;
        if (trackName && artist) {
          songs.push({ trackName, artist });
        }
      });

      return { title, songs };
    });

    await browser.close();

    res.json(data);
  } catch (err) {
    console.error("Scraping error:", err);
    res.status(500).json({ error: "Failed to scrape playlist" });
  }
});

// Vercel expects a handler export
module.exports = app;
