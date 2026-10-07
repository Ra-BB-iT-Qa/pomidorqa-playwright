#!/usr/bin/env node
// Сводка по JSON-отчётам Playwright для Summary в GitHub Actions.
//
// npm run test:unit   # при CI=true пишет reports/results.json
// npm run summary -- reports/results.json
// npm run summary -- ci-reports
//
// Скрипт только читает отчёты и spec-файлы. Вердикт прогона по-прежнему
// ставит Regression Gate: здесь красный код нужен, чтобы упавшие тесты
// было видно и в шаге сводки.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const testsDir = join(repoRoot, "tests");

const layerOrder = ["unit", "api", "e2e", "e2e-firefox", "e2e-safari", "e2e-edge"];
const layerLabel = {
  unit: "Unit",
  api: "API",
  e2e: "E2E Chromium",
  "e2e-firefox": "E2E Firefox",
  "e2e-safari": "E2E WebKit",
  "e2e-edge": "E2E Edge",
};

// Три расхождения со стендом из README. Пока тесты красные, сводка
// отделяет их от новых падений, но прогон всё равно не считается зелёным.
const standDefectMarkers = [
  "создать слот раньше чем через 25 минут",
  "забронировать слот раньше чем через 25 минут",
  "Поиск по навыку не показывает участника",
];

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")} с`;
}

function table(rows) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  return rows
    .map((row) => row.map((cell, index) => String(cell).padEnd(widths[index])).join("  "))
    .join("\n");
}

function findReports(target) {
  const info = statSync(target);
  if (info.isFile()) return [target];

  const found = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const path = join(target, entry.name);
    if (entry.isDirectory()) found.push(...findReports(path));
    else if (entry.name === "results.json") found.push(path);
  }
  return found;
}

function walkSuites(suite, bucket) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      bucket.push({
        title: spec.title,
        file: spec.file ?? suite.file ?? "",
        project: test.projectName || "unknown",
        status: test.status,
        duration: results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
        attempts: results.length,
      });
    }
  }

  for (const child of suite.suites ?? []) walkSuites(child, bucket);
}

function loadReport(path) {
  const report = JSON.parse(readFileSync(path, "utf8"));
  const tests = [];
  for (const suite of report.suites ?? []) walkSuites(suite, tests);
  return {
    path,
    tests,
    duration: report.stats?.duration ?? tests.reduce((sum, test) => sum + test.duration, 0),
  };
}

function listSpecFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSpecFiles(path));
    else if (entry.name.endsWith(".spec.ts")) files.push(path);
  }
  return files;
}

function isE2eSpec(file) {
  return file.split(sep).includes("e2e");
}

function isStandDefect(title) {
  return standDefectMarkers.some((marker) => title.includes(marker));
}

function layerRank(project) {
  const index = layerOrder.indexOf(project);
  return index === -1 ? layerOrder.length : index;
}

const target = process.argv[2] ?? "reports";
let reportPaths = [];
try {
  reportPaths = findReports(target);
} catch {
  console.error(`Не найден отчёт: ${target}`);
  process.exit(1);
}

if (reportPaths.length === 0) {
  console.error(`В ${target} нет results.json`);
  process.exit(1);
}

const reports = reportPaths.map(loadReport);
const tests = reports.flatMap((report) => report.tests);
if (tests.length === 0) {
  console.error("В JSON нет ни одного теста");
  process.exit(1);
}

const unexpected = tests.filter((test) => test.status === "unexpected");
const standFailures = unexpected.filter((test) => isStandDefect(test.title));
const newFailures = unexpected.filter((test) => !isStandDefect(test.title));
const flaky = tests.filter((test) => test.status === "flaky");
const skipped = tests.filter((test) => test.status === "skipped");
const retried = tests.filter((test) => test.attempts > 1);
const passed = tests.length - unexpected.length - flaky.length - skipped.length;

const byProject = new Map();
for (const test of tests) {
  const bucket = byProject.get(test.project) ?? { count: 0, duration: 0, failed: 0 };
  bucket.count += 1;
  bucket.duration += test.duration;
  if (test.status === "unexpected") bucket.failed += 1;
  byProject.set(test.project, bucket);
}

const layers = [...byProject.entries()].sort((a, b) => layerRank(a[0]) - layerRank(b[0]) || a[0].localeCompare(b[0]));

console.log("Метрики прогона\n");
console.log(
  table([
    ["Отчётов", reports.length],
    ["Тестов", tests.length],
    ["Прошли", passed],
    ["Новые падения", newFailures.length],
    ["Падения известных дефектов стенда", standFailures.length],
    ["Flaky, прошли со второй попытки", flaky.length],
    ["Пропущены", skipped.length],
    ["С повтором", retried.length],
    ["Сумма времени работ", formatDuration(reports.reduce((sum, report) => sum + report.duration, 0))],
  ]),
);

console.log("\nПо уровням\n");
console.log(
  table([
    ["Уровень", "Тестов", "Падений", "Время"],
    ...layers.map(([project, bucket]) => [
      layerLabel[project] ?? project,
      bucket.count,
      bucket.failed,
      formatDuration(bucket.duration),
    ]),
  ]),
);

const e2eFiles = listSpecFiles(testsDir).filter(isE2eSpec);
const readSource = (file) => readFileSync(file, "utf8");
const viaApi = e2eFiles.filter((file) => readSource(file).includes("registerUserViaApi"));
const withCleanup = e2eFiles.filter((file) => {
  const source = readSource(file);
  return source.includes("cleanupUsersViaApi") || source.includes("deleteUserViaApi");
});
const withSteps = e2eFiles.filter((file) => readSource(file).includes("test.step("));
const withFixedWait = e2eFiles.filter((file) => /waitForTimeout\s*\(/.test(readSource(file)));

console.log("\nE2E в репозитории\n");
console.log(
  table([
    ["Файлов", e2eFiles.length],
    ["Готовят пользователя через API", `${viaApi.length} из ${e2eFiles.length}`],
    ["Удаляют тестовые аккаунты", `${withCleanup.length} из ${e2eFiles.length}`],
    ["Есть test.step", `${withSteps.length} из ${e2eFiles.length}`],
    ["Есть waitForTimeout", withFixedWait.length],
  ]),
);

const slowest = [...tests].sort((a, b) => b.duration - a.duration).slice(0, 5);
console.log("\nСамые долгие сценарии\n");
console.log(
  table(
    slowest.map((test) => [
      formatDuration(test.duration),
      layerLabel[test.project] ?? test.project,
      test.title,
    ]),
  ),
);

if (standFailures.length > 0) {
  console.log("\nОткрытые дефекты стенда\n");
  console.log(table(standFailures.map((test) => [layerLabel[test.project] ?? test.project, test.title])));
}

if (newFailures.length > 0) {
  console.log("\nНовые падения\n");
  console.log(table(newFailures.map((test) => [layerLabel[test.project] ?? test.project, test.file, test.title])));
}

if (flaky.length > 0) {
  console.log("\nПрошли только с повтора\n");
  console.log(table(flaky.map((test) => [layerLabel[test.project] ?? test.project, test.title])));
}

process.exit(unexpected.length > 0 ? 1 : 0);
