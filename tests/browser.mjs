import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:3001");
await page.getByText("The repository remembers.").waitFor();
await page
  .getByRole("button", { name: "Why was the debug logger removed?" })
  .click();
await page.locator(".answer").waitFor();
assert.match(await page.locator(".answer").innerText(), /unused/);
assert.doesNotMatch(await page.locator(".answer").innerText(), /Redis rollout/);
await page.locator(".sources button").first().click();
await page.locator(".evidence").waitFor();
assert.match(await page.locator(".evidence pre").innerText(), /console.log/);
await page.locator(".close").click();
await page.getByRole("button", { name: "Code graveyard" }).click();
assert.equal(await page.locator(".grave").count(), 2);
await page.getByLabel("Search deleted files").fill("memory");
assert.equal(await page.locator(".grave").count(), 1);
await page.locator(".grave").click();
await page
  .getByRole("button", { name: "Write an epitaph from this evidence" })
  .click();
await page.locator(".answer").waitFor();
await page.locator(".answer").getByText("Creative epitaph:", {exact:false}).waitFor();
assert.match(await page.locator(".answer").innerText(), /Creative epitaph/);
await page.getByLabel("Ask the repository").fill("Tell me about unicorns");
await page.getByRole("button", { name: "Summon", exact: false }).click();
await page
  .getByText("I have no evidence to answer that question.", { exact: false })
  .waitFor();
assert.equal(await page.locator(".sources button").count(), 0);
await page.getByRole("button", { name: "Connect repository" }).click();
assert.equal(
  await page.getByRole("button", { name: "Open the circle" }).isDisabled(),
  true,
);
await page.locator(".close").click();
await page.screenshot({ path: "tests/desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
assert.ok(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
);
await page.screenshot({ path: "tests/mobile.png", fullPage: true });
assert.deepEqual(errors, []);
console.log(
  "PASS: relevant demo, patch dialog, graveyard search, epitaph, abstention, disabled local access, mobile overflow, no browser exceptions.",
);
await browser.close();
