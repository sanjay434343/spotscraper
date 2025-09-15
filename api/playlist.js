import puppeteer from "puppeteer";

export default async function handler(req, res) {
  // --- Serve UI if no URL is provided ---
  if (req.method === "GET" && !req.query.url) {
    res.setHeader("Content-Type", "text/html");
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Spotify Playlist Scraper</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #121212; color: white; }
          input { padding: 10px; width: 60%; border-radius: 5px; border: none; margin-right: 10px; }
          button { padding: 10px 20px; border-radius: 5px; border: none; background: #1db954; color: white; cursor: pointer; }
          pre { text-align: left; margin-top: 20px; max-width: 800px; margin-left: auto; margin-right: auto; overflow-x: auto; background: #1e1e1e; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Spotify Playlist Scraper</h1>
        <input id="url" placeholder="Paste Spotify Playlist URL" />
        <button onclick="scrape()">Scrape</button>
        <pre id="output"></pre>
        <script>
          async function scrape() {
            const url = document.getElementById('url').value;
            if (!url) return alert('Enter a playlist URL');
            document.getElementById('output').textContent = 'Loading...';
            const res = await fetch('?url=' + encodeURIComponent(url));
            const data = await res.json();
            document.getElementById('output').textContent = JSON.stringify(data, null, 2);
          }
        </script>
      </body>
      </html>
    `);
  }

  // --- If URL is provided, scrape the playlist ---
  if (req.query.url) {
    try {
      const playlistUrl = req.query.url;

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.goto(playlistUrl, { waitUntil: "networkidle2" });
      await page.waitForTimeout(5000);

      // --- Scroll to load all tracks ---
      let previousHeight;
      while (true) {
        const currentHeight = await page.evaluate("document.body.scrollHeight");
        if (previousHeight === currentHeight) break;
        previousHeight = currentHeight;
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        await page.waitForTimeout(2000);
      }

      // --- Extract tracks ---
      const tracks = await page.evaluate(() => {
        const rows = document.querySelectorAll("div[role='row']");
        const data = [];
        rows.forEach((row) => {
          const trackEl = row.querySelector("span a span");
          const artistEl = row.querySelector("div span a[href*='/artist/']");
          if (trackEl && artistEl) {
            data.push({
              track: trackEl.innerText,
              artist: artistEl.innerText,
            });
          }
        });
        return data;
      });

      await browser.close();

      return res.status(200).json({ total: tracks.length, tracks });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
