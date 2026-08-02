const path = require("node:path");
const productionConfig = require("../../.dependency-cruiser.cjs");
const productionBoundary = productionConfig.forbidden.find(
  (rule) =>
    rule.name === "application-and-domain-must-not-reach-react-ui-or-infrastructure",
);
if (!productionBoundary) throw new Error("Production application boundary is absent");

module.exports = {
  forbidden: [
    {
      ...productionBoundary,
      name: `fixture-${productionBoundary.name}`,
      from: {
        path: "^scripts/architecture-fixtures/(?:application|domain)/",
      },
    },
  ],
  options: {
    ...productionConfig.options,
    tsConfig: { fileName: path.join(__dirname, "tsconfig.json") },
  },
};
