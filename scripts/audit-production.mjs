import { spawnSync } from 'node:child_process';

const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const APPROVED_BUILD_TOOL_ADVISORIES = new Set([
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
]);

function severityRank(value) {
  return SEVERITY_RANK[String(value ?? '').toLowerCase()] ?? -1;
}

function fail(message) {
  console.error(`Production dependency audit policy: FAIL\n${message}`);
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const auditProcess = spawnSync(
  npmCommand,
  ['audit', '--omit=dev', '--json'],
  {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  },
);

if (auditProcess.error) {
  fail(`Unable to execute npm audit: ${auditProcess.error.message}`);
}

const rawReport = auditProcess.stdout?.trim();

if (!rawReport) {
  fail(
    `npm audit returned no JSON output.${
      auditProcess.stderr ? `\n${auditProcess.stderr.trim()}` : ''
    }`,
  );
}

let report;
try {
  report = JSON.parse(rawReport);
} catch (error) {
  fail(`Unable to parse npm audit JSON: ${error.message}`);
}

if (report.error) {
  fail(`npm audit itself failed: ${JSON.stringify(report.error)}`);
}

const vulnerabilities = report.vulnerabilities ?? {};
const rootCache = new Map();

function collectRootAdvisories(packageName, visiting = new Set()) {
  if (rootCache.has(packageName)) {
    return rootCache.get(packageName);
  }

  if (visiting.has(packageName)) {
    return [];
  }

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) {
    return [];
  }

  const nextVisiting = new Set(visiting);
  nextVisiting.add(packageName);

  const roots = [];

  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      roots.push(...collectRootAdvisories(via, nextVisiting));
      continue;
    }

    if (!via || typeof via !== 'object') {
      continue;
    }

    roots.push({
      packageName: String(via.name ?? via.dependency ?? packageName),
      severity: String(via.severity ?? vulnerability.severity ?? ''),
      title: String(via.title ?? 'Unknown advisory'),
      url: typeof via.url === 'string' ? via.url : null,
    });
  }

  const deduped = Array.from(
    new Map(
      roots.map((root) => [
        `${root.packageName}|${root.url ?? root.title}|${root.severity}`,
        root,
      ]),
    ).values(),
  );

  rootCache.set(packageName, deduped);
  return deduped;
}

const highOrCriticalPackages = Object.entries(vulnerabilities)
  .filter(([, vulnerability]) => severityRank(vulnerability.severity) >= 3)
  .map(([packageName]) => packageName);

if (highOrCriticalPackages.length === 0) {
  console.log('Production dependency audit policy: PASS — no high/critical vulnerabilities.');
  process.exit(0);
}

const blockers = [];
const approvedExceptions = new Map();

for (const packageName of highOrCriticalPackages) {
  const highRoots = collectRootAdvisories(packageName).filter(
    (root) => severityRank(root.severity) >= 3,
  );

  if (highRoots.length === 0) {
    blockers.push(
      `${packageName}: high/critical dependency chain could not be resolved to a concrete advisory.`,
    );
    continue;
  }

  for (const root of highRoots) {
    const isApproved =
      root.packageName === 'image-size' &&
      root.url !== null &&
      APPROVED_BUILD_TOOL_ADVISORIES.has(root.url);

    if (!isApproved) {
      blockers.push(
        `${packageName}: ${root.severity} ${root.packageName} — ${root.title} (${root.url ?? 'no advisory URL'})`,
      );
      continue;
    }

    approvedExceptions.set(root.url, root);
  }
}

if (approvedExceptions.size > 0) {
  const imageSize = vulnerabilities['image-size'];

  if (!imageSize) {
    blockers.push('Approved image-size advisories were found but the image-size vulnerability node is missing.');
  } else {
    if (imageSize.isDirect !== false) {
      blockers.push('image-size exception is valid only while image-size remains an indirect dependency.');
    }

    const effects = Array.isArray(imageSize.effects)
      ? [...imageSize.effects].sort()
      : [];

    if (effects.length !== 1 || effects[0] !== 'metro') {
      blockers.push(
        `image-size exception is valid only for the Metro build-tool path; observed effects: ${
          effects.length ? effects.join(', ') : '(none)'
        }.`,
      );
    }
  }
}

if (blockers.length > 0) {
  fail(blockers.map((blocker) => `- ${blocker}`).join('\n'));
}

console.log('Production dependency audit policy: PASS.');
console.log(
  'Approved temporary build-tool exceptions (image-size is indirect and affects Metro only):',
);
for (const root of approvedExceptions.values()) {
  console.log(`- ${root.url} — ${root.title}`);
}
console.log(
  'All other high/critical advisories remain blocking. Remove these exceptions as soon as an upstream patched version is available.',
);
