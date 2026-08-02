/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ListWorkbench narrow-wrapper layout contract", () => {
  it("keeps wide grouped tables in normal flow inside one horizontal scroller", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");

    expect(css).toMatch(/\.ledger-scroll\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.ledger-scroll table\s*\{[^}]*width:\s*max-content/s);
    expect(css).toMatch(/\.ledger-scroll table\s*\{[^}]*min-width:\s*100%/s);
    expect(css).not.toMatch(
      /\.ledger-scroll thead[^}]*position:\s*(fixed|absolute|sticky)/s,
    );
    expect(css).toMatch(/\.query-field\s*>\s*span\s*\{[^}]*white-space:\s*nowrap/s);
  });
});
