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

const highOrCriticalPackages = Object.entries(vulnerabilities)
  .filter(([, vulnerability]) => severityRank(vulnerability.severity) >= 3)
  .map(([packageName]) => packageName);

if (highOrCriticalPackages.length === 0) {
  console.log('Production dependency audit policy: PASS — no high/critical vulnerabilities.');
  process.exit(0);
}

/**
 * npm's vulnerability graph can contain cycles among Metro packages. Walking
 * `via` recursively from every affected package therefore produces ambiguous
 * roots. Instead, first inspect every concrete advisory object globally, then
 * prove that every high/critical affected package is reachable from the
 * approved root through npm audit's reverse `effects` graph.
 */
const concreteHighAdvisories = [];

for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
  for (const via of vulnerability.via ?? []) {
    if (
      !via ||
      typeof via !== 'object' ||
      severityRank(via.severity ?? vulnerability.severity) < 3
    ) {
      continue;
    }

    concreteHighAdvisories.push({
      packageName: String(via.name ?? via.dependency ?? packageName),
      severity: String(via.severity ?? vulnerability.severity ?? ''),
      title: String(via.title ?? 'Unknown advisory'),
      url: typeof via.url === 'string' ? via.url : null,
    });
  }
}

const dedupedConcreteHighAdvisories = Array.from(
  new Map(
    concreteHighAdvisories.map((advisory) => [
      `${advisory.packageName}|${advisory.url ?? advisory.title}|${advisory.severity}`,
      advisory,
    ]),
  ).values(),
);

const blockers = [];
const approvedExceptions = new Map();

if (dedupedConcreteHighAdvisories.length === 0) {
  blockers.push(
    'High/critical packages exist but npm audit exposed no concrete high/critical advisory objects.',
  );
}

for (const advisory of dedupedConcreteHighAdvisories) {
  const isApproved =
    advisory.packageName === 'image-size' &&
    advisory.url !== null &&
    APPROVED_BUILD_TOOL_ADVISORIES.has(advisory.url);

  if (!isApproved) {
    blockers.push(
      `${advisory.severity} ${advisory.packageName} — ${advisory.title} (${advisory.url ?? 'no advisory URL'})`,
    );
    continue;
  }

  approvedExceptions.set(advisory.url, advisory);
}

const imageSize = vulnerabilities['image-size'];

if (approvedExceptions.size > 0) {
  if (!imageSize) {
    blockers.push(
      'Approved image-size advisories were found but the image-size vulnerability node is missing.',
    );
  } else {
    if (imageSize.isDirect !== false) {
      blockers.push(
        'image-size exception is valid only while image-size remains an indirect dependency.',
      );
    }

    const directEffects = Array.isArray(imageSize.effects)
      ? [...imageSize.effects].sort()
      : [];

    if (directEffects.length !== 1 || directEffects[0] !== 'metro') {
      blockers.push(
        `image-size exception is valid only when its direct affected consumer is Metro; observed effects: ${
          directEffects.length ? directEffects.join(', ') : '(none)'
        }.`,
      );
    }
  }
}

/**
 * Starting at the approved vulnerable root, follow `effects` outward. This
 * creates the exact set of high/critical packages whose audit severity is
 * inherited from image-size, without depending on the cyclic `via` graph.
 */
const allowedHighPackages = new Set();

if (approvedExceptions.size > 0 && imageSize) {
  allowedHighPackages.add('image-size');

  let changed = true;
  while (changed) {
    changed = false;

    for (const packageName of [...allowedHighPackages]) {
      const vulnerability = vulnerabilities[packageName];
      const effects = Array.isArray(vulnerability?.effects)
        ? vulnerability.effects
        : [];

      for (const effectPackage of effects) {
        const effectVulnerability = vulnerabilities[effectPackage];

        if (
          !effectVulnerability ||
          severityRank(effectVulnerability.severity) < 3 ||
          allowedHighPackages.has(effectPackage)
        ) {
          continue;
        }

        allowedHighPackages.add(effectPackage);
        changed = true;
      }
    }
  }
}

for (const packageName of highOrCriticalPackages) {
  if (!allowedHighPackages.has(packageName)) {
    blockers.push(
      `${packageName}: high/critical package is not in the Metro-only effects closure rooted at approved image-size advisories.`,
    );
  }
}

if (blockers.length > 0) {
  fail(
    Array.from(new Set(blockers))
      .map((blocker) => `- ${blocker}`)
      .join('\n'),
  );
}

console.log('Production dependency audit policy: PASS.');
console.log(
  'Approved temporary build-tool exceptions (image-size is indirect, directly affects Metro, and all inherited high packages stay inside that effects closure):',
);
for (const advisory of approvedExceptions.values()) {
  console.log(`- ${advisory.url} — ${advisory.title}`);
}
console.log(
  `Validated inherited high/critical package closure: ${[
    ...allowedHighPackages,
  ].sort().join(', ')}`,
);
console.log(
  'All other high/critical advisories remain blocking. Remove these exceptions as soon as an upstream patched version is available.',
);
