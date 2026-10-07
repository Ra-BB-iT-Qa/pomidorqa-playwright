#!/usr/bin/env node
// Сводка последнего прогона Playwright по playwright-report/results.json.
//
//   npm test
//   npm run metrics
//
// В CI тот же скрипт вызывается с --inform: код возврата тестов уже решает
// судьбу job, а здесь нужна только читаемая таблица в Summary.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2).filter((arg) => arg !== "--inform");
const informOnly = process.argv.includes("--inform");
const reportTarget = args[0] ?? "playwright-report/results.json";

const standDefectMarkers = [
  "создать слот раньше чем через 25 минут",
  "забронировать слот раньше чем через 25 минут",
];

const projectLabel = {
  unit: "unit",
  api: "api",
  e2e: "e2e chromium",
  "e2e-firefox": "e2e firefox",
  "e2e-safari": "e2e webkit",
  "e2e-edge": "e2e edge",
};

function posix(value) {
  return value.replaceAll("\\", "/");
}

function levelOf(project) {
  if (project === "unit" || project === "api") return project;
  if (project.startsWith("e2e")) return "e2e";
  return project || "unknown";
}

function collect(suite, inheritedProject, tests) {
  const titled = suite.title ?? "";
  const project = /^(unit|api|e2e)/.test(titled) ? titled : inheritedProject;

  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const name = test.projectName || project || "unknown";
      tests.push({
        title: spec.title,
        file: posix(spec.file ?? ""),
        project: name,
        level: levelOf(name),
        status: test.status,
        expectedStatus: test.expectedStatus,
        durationMs: results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
        attempts: results.length,
      });
    }
  }

  for (const child of suite.suites ?? []) collect(child, project, tests);
}

function specFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...specFiles(full));
    else if (entry.name.endsWith(".spec.ts")) files.push(posix(full));
  }
  return files;
}

function duration(ms) {
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")} с`;
}

function findReports(target) {
  const info = statSync(target);
  if (info.isFile()) return [target];
  const found = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) found.push(...findReports(full));
    else if (entry.name === "results.json") found.push(full);
  }
  return found;
}

function isStandDefect(test) {
  return standDefectMarkers.some((marker) => test.title.includes(marker));
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function markdownTable(headers, rows) {
  const head = `| ${headers.map(markdownCell).join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`).join("\n");
  return `${head}\n${rule}\n${body}`;
}

let reportPaths;
try {
  reportPaths = findReports(reportTarget);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Не удалось прочитать ${reportTarget}: ${reason}`);
  process.exit(1);
}

if (reportPaths.length === 0) {
  console.error(`В ${reportTarget} нет results.json`);
  process.exit(1);
}

const reports = [];
for (const reportPath of reportPaths) {
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const tests = [];
    for (const suite of report.suites ?? []) collect(suite, "", tests);
    const retries = [...new Set((report.config?.projects ?? []).map((project) => project.retries).filter((value) => value != null))];
    reports.push({
      file: posix(reportPath),
      tests,
      wallClockMs: report.stats?.duration == null ? null : Math.round(report.stats.duration),
      workers: report.config?.workers ?? null,
      retries,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Не удалось прочитать ${reportPath}: ${reason}`);
    process.exit(1);
  }
}

const tests = reports.flatMap((report) => report.tests);

if (tests.length === 0) {
  console.error(`В ${reportTarget} нет тестов`);
  process.exit(1);
}

const unexpected = tests.filter((test) => test.status === "unexpected");
const standFailures = unexpected.filter(isStandDefect);
const newFailures = unexpected.filter((test) => !isStandDefect(test));
const flaky = tests.filter((test) => test.status === "flaky");
const skipped = tests.filter((test) => test.status === "skipped");
const retried = tests.filter((test) => test.attempts > 1);
const summedDurationMs = tests.reduce((sum, test) => sum + test.durationMs, 0);
const wallClockKnown = reports.every((report) => report.wallClockMs != null);
const wallClockMs = wallClockKnown
  ? reports.reduce((sum, report) => sum + report.wallClockMs, 0)
  : summedDurationMs;
const workers = [...new Set(reports.map((report) => report.workers).filter((value) => value != null))];
const retries = [...new Set(reports.flatMap((report) => report.retries))];

const levels = new Map();
for (const test of tests) {
  const bucket = levels.get(test.level) ?? { count: 0, durationMs: 0 };
  bucket.count += 1;
  bucket.durationMs += test.durationMs;
  levels.set(test.level, bucket);
}

const passedAsExpected = tests.length - unexpected.length - flaky.length - skipped.length;

console.log(unexpected.length > 0 ? "❌ Есть падения\n" : "✅ Падений нет\n");
console.log("**Сводка прогона**\n");
console.log(
  markdownTable(
    ["Показатель", "Значение"],
    [
      ["Тестов в отчёте", tests.length],
      ["Прошли", passedAsExpected],
      ["Дефекты стенда", standFailures.length],
      ["Новые падения", newFailures.length],
      ["Прошли со второй попытки", flaky.length],
      ["Пропущены", skipped.length],
      ["С повтором", retried.length],
      [reports.length > 1 ? "Сумма времени прогонов" : "Время прогона", duration(wallClockMs)],
      ["Сумма сценариев", duration(summedDurationMs)],
      ["Воркеры", workers.length ? workers.join(", ") : "—"],
      ["Повторы", retries.length ? retries.join(", ") : "—"],
    ],
  ),
);

const byProject = new Map();
for (const report of reports) {
  const names = [...new Set(report.tests.map((test) => test.project))];
  for (const test of report.tests) {
    const bucket = byProject.get(test.project) ?? { count: 0, durationMs: 0, wallClockMs: 0, failed: 0 };
    bucket.count += 1;
    bucket.durationMs += test.durationMs;
    if (test.status === "unexpected") bucket.failed += 1;
    byProject.set(test.project, bucket);
  }
  if (names.length === 1 && report.wallClockMs != null) {
    const bucket = byProject.get(names[0]);
    if (bucket) bucket.wallClockMs += report.wallClockMs;
  }
}

const projectOrder = ["unit", "api", "e2e", "e2e-firefox", "e2e-safari", "e2e-edge"];
const e2eProjectCount = [...byProject.keys()].filter((name) => name.startsWith("e2e")).length;
if (e2eProjectCount > 1) {
  const projectRows = [];
  const projects = [...byProject.entries()].sort((left, right) => {
    const leftRank = projectOrder.indexOf(left[0]);
    const rightRank = projectOrder.indexOf(right[0]);
    return (leftRank === -1 ? projectOrder.length : leftRank) - (rightRank === -1 ? projectOrder.length : rightRank);
  });
  for (const [project, bucket] of projects) {
    if (!String(project).startsWith("e2e")) continue;
    projectRows.push([
      projectLabel[project] ?? project,
      bucket.count,
      bucket.failed,
      bucket.wallClockMs > 0 ? duration(bucket.wallClockMs) : duration(bucket.durationMs),
    ]);
  }
  console.log("\n**Браузеры**\n");
  console.log(markdownTable(["Проект", "Тестов", "Падений", "Время прогона"], projectRows));
}

const levelOrder = ["unit", "api", "e2e"];
const levelRows = [];
for (const name of [...levels.keys()].sort(
  (left, right) => levelOrder.indexOf(left) - levelOrder.indexOf(right) || left.localeCompare(right),
)) {
  const bucket = levels.get(name);
  levelRows.push([name, bucket.count, duration(bucket.durationMs)]);
}

console.log("\n**Уровни пирамиды**\n");
console.log(markdownTable(["Уровень", "Тестов", "Сумма сценариев"], levelRows));

if (tests.some((test) => test.level === "e2e")) {
  const e2eFiles = specFiles("tests").filter((file) => file.includes("/e2e/"));
  const sourceOf = (file) => readFileSync(file, "utf8");
  const arrangedViaApi = e2eFiles.filter((file) => sourceOf(file).includes("registerUserViaApi"));
  const cleanedAfter = e2eFiles.filter((file) => {
    const source = sourceOf(file);
    return source.includes("cleanupUsersViaApi") || source.includes("deleteUserViaApi");
  });

  console.log("\n**Подготовка стенда в E2E**\n");
  console.log(
    markdownTable(
      ["Показатель", "Значение"],
      [
        ["Файлов сценариев", e2eFiles.length],
        ["Регистрируют участника через API", `${arrangedViaApi.length} из ${e2eFiles.length}`],
        ["Убирают участников после сценария", `${cleanedAfter.length} из ${e2eFiles.length}`],
      ],
    ),
  );
}

const slowest = [...tests].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
console.log("\n**Самые долгие сценарии**\n");
console.log(
  markdownTable(
    ["Время", "Проект", "Сценарий"],
    slowest.map((test) => [duration(test.durationMs), projectLabel[test.project] ?? test.project, test.title]),
  ),
);

if (standFailures.length > 0) {
  console.log("\n**Дефекты стенда**\n");
  console.log(
    markdownTable(
      ["Проект", "Сценарий"],
      standFailures.map((test) => [projectLabel[test.project] ?? test.project, test.title]),
    ),
  );
}

if (newFailures.length > 0) {
  console.log("\n**Новые падения**\n");
  console.log(
    markdownTable(
      ["Проект", "Файл", "Сценарий"],
      newFailures.map((test) => [projectLabel[test.project] ?? test.project, test.file, test.title]),
    ),
  );
}

const metrics = {
  wallClockMs,
  summedDurationMs,
  workers,
  retries,
  tests: tests.length,
  failed: unexpected.length,
  flaky: flaky.length,
  runs: reports.map((report) => ({
    file: report.file,
    projects: [...new Set(report.tests.map((test) => test.project))],
    wallClockMs: report.wallClockMs,
    workers: report.workers,
    retries: report.retries,
    tests: report.tests.length,
    failed: report.tests.filter((test) => test.status === "unexpected").length,
  })),
  scenarios: tests.map((test) => ({
    project: test.project,
    file: test.file,
    title: test.title,
    status: test.status,
    durationMs: test.durationMs,
    attempts: test.attempts,
  })),
};

const metricsPath = statSync(reportTarget).isDirectory()
  ? path.join(reportTarget, "metrics.json")
  : path.join(path.dirname(reportTarget), "metrics.json");
writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);

console.log("\n**Машиночитаемый отчёт**\n");
console.log(`\`${posix(metricsPath)}\`: время прогона ${wallClockMs} мс, воркеры ${workers.join(", ") || "—"}, повторы ${retries.join(", ") || "—"}.`);

if (!informOnly && unexpected.length > 0) process.exit(1);
