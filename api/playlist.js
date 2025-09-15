import chromium from "chrome-aws-lambda";

export default async function handler(req, res) {
  try {
    const playlistUrl = req.query.url;
    if (!playlistUrl) {
      return res.status(400).json({ error: "Missing playlist URL as ?url=" });
    }

    // --- Launch browser ---
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
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

    return res.status(200).json({ tracks, total: tracks.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
