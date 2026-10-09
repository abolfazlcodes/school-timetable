import fs from "node:fs";

const tracePath = ".next/server/app/planning/page.js.nft.json";
const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
const functionsConfig = JSON.parse(
  fs.readFileSync(".next/server/functions-config-manifest.json", "utf8"),
);
const planningMaxDuration = functionsConfig.functions?.["/planning"]?.maxDuration;

if (planningMaxDuration !== 60) {
  throw new Error(
    `Production /planning maxDuration must be 60 seconds; received ${String(planningMaxDuration)}.`,
  );
}

const solverFiles = trace.files.filter((file) =>
  file.includes("@ortools-node/cp-sat/prebuilds/linux-x64/"),
);
const hasNativeAddon = solverFiles.some((file) => file.endsWith(".node"));
const hasOrToolsLibrary = solverFiles.some((file) =>
  file.includes("/libortools.so"),
);

if (!hasNativeAddon || !hasOrToolsLibrary) {
  throw new Error(
    "Production trace is missing the Linux CP-SAT native runtime. Check outputFileTracingIncludes in next.config.ts.",
  );
}

console.log(
  `CP-SAT production runtime verified (${solverFiles.length} traced Linux files, /planning maxDuration=${planningMaxDuration}s).`,
);

const { CpModel, CpSolver, CpSolverStatus } = await import("@ortools-node/cp-sat");
const smokeModel = new CpModel();
const value = smokeModel.newIntVar(0n, 1n, "runtime_smoke_value");
smokeModel.add(value.equalTo(1));
const smokeSolver = new CpSolver();
smokeSolver.parameters.maxTimeInSeconds = 2;
smokeSolver.parameters.numSearchWorkers = 1;
const smokeStatus = await smokeSolver.solve(smokeModel);

if (
  smokeStatus !== CpSolverStatus.OPTIMAL ||
  smokeSolver.value(value) !== 1n
) {
  throw new Error("CP-SAT native runtime loaded but failed the production smoke solve.");
}

console.log("CP-SAT production smoke solve passed.");
