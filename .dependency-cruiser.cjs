module.exports = {
  forbidden: [
    {
      name: "no-module-ui-cross-imports",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/([^/]+)/(ui|infrastructure)/",
        pathNot: "^src/modules/$1/",
      },
    },
    {
      name: "shared-must-not-depend-on-business-modules",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/modules/" },
    },
    {
      name: "domain-must-be-pure",
      severity: "error",
      from: { path: "/domain/" },
      to: { path: "/(application|infrastructure|ui)/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: { exportsFields: ["exports"] },
  },
};
