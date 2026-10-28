from pathlib import Path
import json
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class RuntimePackagingTests(unittest.TestCase):
    def test_api_preserves_workspace_dependency_links(self):
        dockerfile = (ROOT / "apps/api/Dockerfile").read_text()
        runner = dockerfile.split(" AS runner", 1)[1]
        self.assertIn("/app/node_modules ./node_modules", runner)
        for workspace in ("apps/api", "apps/cms", "packages/contract"):
            with self.subTest(workspace=workspace):
                self.assertIn(
                    f"COPY --chown=bun:bun --from=deps /app/{workspace}/node_modules ./{workspace}/node_modules",
                    runner,
                )
        self.assertIn("Bun.resolveSync", runner)
        self.assertIn('"hono"', runner)

    def test_cms_runner_has_no_package_manager(self):
        dockerfile = (ROOT / "apps/cms/Dockerfile").read_text()
        runner = dockerfile.split(" AS runner", 1)[1]
        self.assertNotIn("npm install", runner)
        self.assertIn("! command -v pnpm", runner)
        self.assertIn("WORKDIR /app/apps/cms", runner)
        for workspace in ("apps/cms", "packages/contract"):
            self.assertIn(f"/app/{workspace} /app/{workspace}", runner)
        self.assertIn("/app/node_modules /app/node_modules", runner)
        command = json.loads(re.search(r"^CMD (.+)$", runner, re.M)[1])
        self.assertEqual(command[:2], ["node", "./node_modules/next/dist/bin/next"])
        self.assertIn("import.meta.resolve", runner)

    def test_compose_uses_direct_runtime_commands(self):
        compose = (ROOT / "docker-compose.yml").read_text()
        services = dict(re.findall(r"^  (\w+):\n(.*?)(?=^  \w+:|^\w|\Z)", compose, re.M | re.S))
        for service, executable in (
            ("migration", "./node_modules/payload/bin.js"),
            ("cms", "./node_modules/next/dist/bin/next"),
        ):
            with self.subTest(service=service):
                command = json.loads(re.search(r"^    command: (.+)$", services[service], re.M)[1])
                self.assertEqual(command[:2], ["node", executable])
                self.assertNotIn("entrypoint:", services[service])
        self.assertIn("service_completed_successfully", services["api"])

    def test_installs_use_the_mounted_cache_and_lockfile(self):
        for path in ROOT.glob("apps/*/Dockerfile"):
            with self.subTest(dockerfile=str(path)):
                installs = re.findall(r"^RUN .*pnpm install.*$", path.read_text(), re.M)
                self.assertTrue(installs)
                for install in installs:
                    self.assertIn("target=/pnpm/store", install)
                    self.assertIn("--store-dir=/pnpm/store", install)
                    self.assertIn("--frozen-lockfile", install)


if __name__ == "__main__":
    unittest.main()
