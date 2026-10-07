import { expect, test } from "@playwright/test";

test("each article opens with a one time coin notice and existing coins are preserved", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("impact-drive-rewards")) localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1, year: new Date().getFullYear(), credits: 4, treesThisYear: 0, treesAllTime: 0, missionCompletionIds: [],
    }));
  });
  await page.route("https://www.astonmartinf1.com/**", (route) => route.fulfill({ body: "Article opened" }));
  await page.goto("/library");
  const first = page.locator(".resource-card").filter({ hasText: "Setting sail" });
  await first.click();
  await expect(page.locator(".coin-toast")).toContainText("+1 Carbon Coin earned for opening this article");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(5);
  await first.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(5);
  await page.locator(".resource-card").filter({ hasText: "Celebrating Pride" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(6);
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(6);
  await page.goto("/rewards");
  await expect(page.locator(".rewards-balance")).toContainText("Carbon Coins: 6");
});

test("a YouTube link immediately earns its video coin even without the embedded player", async ({ page }) => {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.abort());
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.abort());
  await page.route("https://www.youtube.com/watch**", (route) => route.fulfill({ body: "YouTube video opened" }));
  await page.goto("/video");
  const link = page.locator(".film-more-card").filter({ hasText: "Sustainability achievements" }).getByRole("link", { name: "Open on YouTube" });
  await link.click();
  await expect(page.locator(".coin-toast")).toContainText("+1 Carbon Coin earned for this video");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(1);
  await page.reload();
  await link.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(1);
});

test("starting embedded videos or opening their YouTube links grants one coin per video", async ({ page }) => {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.testVideos = {}; window.YT = { Player: class { constructor(element, options) { window.testVideos[options.videoId] = options.events.onStateChange; element.innerHTML = '<div>Mock video player</div>'; } destroy() {} } }; window.onYouTubeIframeAPIReady();`,
  }));
  await page.route("https://players.brightcove.net/**/index.min.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.videojs = { getPlayer: () => ({ ready: (callback) => callback(), on: (name, callback) => { if (name === 'play') window.testBrightcovePlay = callback; if (name === 'ended') window.testBrightcoveEnded = callback; }, currentTime: () => 0, play: () => Promise.resolve(), dispose: () => {} }) };`,
  }));
  await page.route("https://www.youtube.com/watch**", (route) => route.fulfill({ body: "YouTube video opened" }));
  await page.goto("/video");
  await expect.poll(() => page.evaluate(() => Object.keys((window as unknown as { testVideos?: Record<string, unknown> }).testVideos ?? {}).length)).toBe(3);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(0);
  await page.evaluate(() => (window as unknown as { testVideos: Record<string, (event: { data: number }) => void> }).testVideos.N2UT8yCM1PQ({ data: 0 }));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(0);
  await page.evaluate(() => (window as unknown as { testVideos: Record<string, (event: { data: number }) => void> }).testVideos.N2UT8yCM1PQ({ data: 1 }));
  await expect(page.locator(".coin-toast")).toContainText("+1 Carbon Coin earned for this video");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(1);
  await page.evaluate(() => (window as unknown as { testVideos: Record<string, (event: { data: number }) => void> }).testVideos.N2UT8yCM1PQ({ data: 1 }));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(1);
  await page.locator(".film-more-card").filter({ hasText: "Sustainability achievements" }).getByRole("link", { name: "Open on YouTube" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(1);
  await page.locator(".film-more-card").filter({ hasText: "Make A Mark Sustainability Day" }).getByRole("link", { name: "Open on YouTube" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(2);
  await page.getByRole("button", { name: "Play Alonso’s race-to-pit clip" }).click();
  await expect(page.locator(".coin-toast")).toContainText("+1 Carbon Coin earned for this video");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(3);
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { testBrightcovePlay?: unknown }).testBrightcovePlay)).toBe("function");
  await page.evaluate(() => (window as unknown as { testBrightcovePlay: () => void }).testBrightcovePlay());
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(3);
  await page.evaluate(() => (window as unknown as { testBrightcovePlay: () => void }).testBrightcovePlay());
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(3);
  await page.goto("/rewards");
  await expect(page.locator(".rewards-balance")).toContainText("Carbon Coins: 3");
});
