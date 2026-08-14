import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface DependencyViolation {
  readonly file: string;
  readonly rule: string;
  readonly detail: string;
}

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const IMPORT_PATTERN =
  /(?:import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?|export\s+(?:type\s+)?[^'";]*?\sfrom\s*|require\s*\(|import\s*\()\s*["']([^"']+)["']/g;

function normalized(file: string): string {
  return file.split(path.sep).join("/");
}

export function sourceImports(source: string): string[] {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? "");
}

function isPrismaBoundaryImport(specifier: string): boolean {
  return (
    specifier === "@prisma/client" ||
    specifier === "@/shared/db" ||
    specifier.startsWith("@/shared/db/") ||
    specifier === "@/lib/prisma" ||
    /(?:^|\/)prisma(?:\.[^/]*)?$/.test(specifier)
  );
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["'];?/m.test(source.slice(0, 300));
}

function featureOwner(file: string): string | undefined {
  return normalized(file).match(/(?:^|\/)src\/features\/([^/]+)\//)?.[1];
}

function importedFeature(file: string, specifier: string):
  | { feature: string; entry: string }
  | undefined {
  const aliasMatch = specifier.match(/^@\/features\/([^/]+)(?:\/(.*))?$/);
  const relativeTarget = specifier.startsWith(".")
    ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    : "";
  const relativeMatch = relativeTarget.match(
    /(?:^|\/)src\/features\/([^/]+)(?:\/(.*))?$/,
  );
  const match = aliasMatch ?? relativeMatch;
  if (!match?.[1]) return undefined;
  return { feature: match[1], entry: match[2] ?? "" };
}

export function inspectDependencyPolicy(
  file: string,
  source: string,
): DependencyViolation[] {
  const fileName = normalized(file);
  const imports = sourceImports(source);
  const violations: DependencyViolation[] = [];
  const domainOrUi =
    /\/src\/features\/[^/]+\/(?:domain|ui)\//.test(`/${fileName}`) ||
    (/\/src\/app\//.test(`/${fileName}`) &&
      !/\/route\.[cm]?[jt]s$/.test(`/${fileName}`));

  if (domainOrUi) {
    for (const specifier of imports.filter(isPrismaBoundaryImport)) {
      violations.push({
        file,
        rule: "no-prisma-in-domain-or-ui",
        detail: `forbidden import ${specifier}`,
      });
    }
  }

  const owner = featureOwner(fileName);
  if (owner) {
    for (const specifier of imports) {
      const target = importedFeature(fileName, specifier);
      if (
        target &&
        target.feature !== owner &&
        target.entry !== "public" &&
        target.entry !== "server"
      ) {
        violations.push({
          file,
          rule: "no-cross-feature-deep-import",
          detail: `use @/features/${target.feature}/public or /server, not ${specifier}`,
        });
      }
    }
  }

  if (isClientModule(source)) {
    for (const specifier of imports) {
      if (
        isPrismaBoundaryImport(specifier) ||
        specifier === "server-only" ||
        specifier.includes("/infrastructure/") ||
        specifier.endsWith("/server") ||
        specifier.includes("/server/") ||
        /(?:^|\/)server(?:\.[^/]*)?$/.test(specifier)
      ) {
        violations.push({
          file,
          rule: "no-server-import-in-client",
          detail: `client module imports ${specifier}`,
        });
      }
    }
  }

  if (/\/src\/app\/(?:.*\/)?route\.[cm]?[jt]s$/.test(`/${fileName}`)) {
    for (const specifier of imports) {
      if (
        isPrismaBoundaryImport(specifier) ||
        specifier.includes("/domain/") ||
        specifier.includes("/application/") ||
        specifier.includes("/infrastructure/")
      ) {
        violations.push({
          file,
          rule: "route-handler-is-transport-only",
          detail: `Route Handler bypasses a feature server facade via ${specifier}`,
        });
      }
    }

    if (/\bprisma\s*\.|\$transaction\s*\(/.test(source)) {
      violations.push({
        file,
        rule: "route-handler-is-transport-only",
        detail: "Route Handler contains direct persistence/transaction logic",
      });
    }

    const mutates = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(
      source,
    );
    const delegatesToServerFacade = imports.some(
      (specifier) =>
        /^@\/features\/[^/]+\/server$/.test(specifier) ||
        /(?:^|\/)features\/[^/]+\/server$/.test(specifier),
    );
    if (mutates && !delegatesToServerFacade) {
      violations.push({
        file,
        rule: "route-handler-is-transport-only",
        detail: "mutating Route Handler must delegate to a feature server facade",
      });
    }
  }

  return violations;
}

async function sourceFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolute);
      return SOURCE_FILE.test(entry.name) ? [absolute] : [];
    }),
  );
  return nested.flat();
}

export async function inspectArchitectureV2Source(
  workspaceRoot: string,
): Promise<DependencyViolation[]> {
  const files = await sourceFiles(path.join(workspaceRoot, "src"));
  const results = await Promise.all(
    files.map(async (file) =>
      inspectDependencyPolicy(
        path.relative(workspaceRoot, file),
        await readFile(file, "utf8"),
      ),
    ),
  );
  return results.flat();
}
