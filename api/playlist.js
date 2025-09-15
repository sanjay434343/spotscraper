import chromium from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  if (req.method === "GET" && !req.query.url) {
    res.setHeader("Content-Type", "text/html");
    return res.send(`<!DOCTYPE html>
    <html><head><title>Spotify Scraper</title></head><body>
    <h1>Spotify Playlist Scraper</h1>
    <input id="url" placeholder="Paste Spotify Playlist URL" />
    <button onclick="scrape()">Scrape</button>
    <pre id="output"></pre>
    <script>
      async function scrape() {
        const url = document.getElementById('url').value;
        const res = await fetch('?url=' + encodeURIComponent(url));
        const data = await res.json();
        document.getElementById('output').textContent = JSON.stringify(data, null, 2);
      }
    </script>
    </body></html>`);
  }

  if (req.query.url) {
    try {
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.goto(req.query.url, { waitUntil: "networkidle2" });
      await page.waitForTimeout(5000);

      // scroll all tracks
      let prevHeight;
      while (true) {
        const height = await page.evaluate("document.body.scrollHeight");
        if (height === prevHeight) break;
        prevHeight = height;
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        await page.waitForTimeout(1500);
      }

      const tracks = await page.evaluate(() => {
        const rows = document.querySelectorAll("div[role='row']");
        return Array.from(rows).map(row => {
          const track = row.querySelector("span a span")?.innerText;
          const artist = row.querySelector("div span a[href*='/artist/']")?.innerText;
          return track && artist ? { track, artist } : null;
        }).filter(Boolean);
      });

      await browser.close();
      return res.status(200).json({ total: tracks.length, tracks });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
