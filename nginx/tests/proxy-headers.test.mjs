import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const mode of ["dev", "prod"]) {
  test(`${mode} proxy preserves the client hostname and external port`, async () => {
    const config = await readFile(new URL(`../conf.d/${mode}.conf`, import.meta.url), "utf8");
    const hostHeaders = [...config.matchAll(/proxy_set_header\s+Host\s+([^;]+);/g)];
    assert.ok(hostHeaders.length > 0, "Expected proxy Host headers");
    for (const [, value] of hostHeaders) {
      assert.equal(value.trim(), "$http_host", "$host drops :8080 from generated media URLs");
    }
  });
  test(`${mode} preview uses the isolated backend policy without inheriting the admin CSP`, async () => {
    const config = await readFile(new URL(`../conf.d/${mode}.conf`, import.meta.url), "utf8");
    const preview = config.match(/location \^~ \/connector\/v1\/preview\/ \{([\s\S]*?)\n  \}/)?.[1];
    assert.ok(preview, "Expected a dedicated preview location");
    assert.match(preview, /add_header X-Frame-Options "SAMEORIGIN" always/);
    assert.match(preview, /add_header Referrer-Policy "no-referrer" always/);
    assert.doesNotMatch(preview, /add_header Content-Security-Policy/);
    assert.match(preview, /proxy_pass/);
  });
}
