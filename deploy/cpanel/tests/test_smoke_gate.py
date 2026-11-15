"""Regression test for the packaged-app smoke gate (H1).

smoke-package.php boots Laravel before running its checks. Laravel's
exception handler renders uncaught exceptions and the process then exits
0, so a check() that merely throws can never fail the gate (or CI).
check() must terminate the process with a non-zero exit code itself.

This test runs the REAL smoke-package.php against a minimal stub
application whose kernel bootstrap registers a Laravel-like exception
handler and whose publicPath() deliberately mismatches the given public
directory, so the FIRST check fails. It asserts a non-zero exit code.
Against the old throwing check() this test FAILS (exit 0); against the
fixed check() it PASSES (exit 1).
"""
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
SMOKE_SCRIPT = TESTS_DIR / "smoke-package.php"

AUTOLOAD = "<?php\n// Test double: no-op autoloader.\n"

BOOTSTRAP = """<?php
// Test double: minimal stand-in for the Laravel application object.
// Only the surface smoke-package.php touches before its first check()
// is implemented: make() and publicPath().
class SmokeGateStubKernel
{
    public function bootstrap(): void
    {
        // Mimic Laravel: the framework exception handler renders an
        // uncaught exception and the process then exits 0. A check()
        // that merely throws can therefore never fail the gate.
        set_exception_handler(function (Throwable $e): void {
            fwrite(STDERR, 'Rendered exception: ' . $e->getMessage() . "\\n");
        });
    }
}

class SmokeGateStubApp
{
    public function make(string $abstract): SmokeGateStubKernel
    {
        return new SmokeGateStubKernel();
    }

    public function publicPath(): string
    {
        // Deliberately wrong: the first smoke check must fail.
        return '/definitely/not/the/public/path';
    }
}

return new SmokeGateStubApp();
"""

BOOTSTRAP_THROWING = """<?php
// Test double: same stub kernel, but publicPath() throws — mimicking an
// unexpected exception outside check() (e.g. firstOrFail() on a missing row).
class SmokeGateThrowingKernel
{
    public function bootstrap(): void
    {
        set_exception_handler(function (Throwable $e): void {
            fwrite(STDERR, 'Rendered exception: ' . $e->getMessage() . "\\n");
        });
    }
}

class SmokeGateThrowingApp
{
    public function make(string $abstract): SmokeGateThrowingKernel
    {
        return new SmokeGateThrowingKernel();
    }

    public function publicPath(): string
    {
        throw new RuntimeException('boom from publicPath');
    }
}

return new SmokeGateThrowingApp();
"""


@unittest.skipUnless(shutil.which("php"), "php binary is required")
class SmokeGateTest(unittest.TestCase):
    def _run_against_stub(self, bootstrap_text):
        with tempfile.TemporaryDirectory(prefix="crm smoke gate ") as tmp:
            private = Path(tmp) / "private app"
            public = Path(tmp) / "domain public"
            (private / "vendor").mkdir(parents=True)
            (private / "bootstrap").mkdir()
            public.mkdir()
            (private / "vendor/autoload.php").write_text(AUTOLOAD)
            (private / "bootstrap/app.php").write_text(bootstrap_text)
            return subprocess.run(
                ["php", str(SMOKE_SCRIPT), str(private), str(public)],
                text=True, capture_output=True,
            )

    def test_failing_check_exits_nonzero(self):
        result = self._run_against_stub(BOOTSTRAP)
        self.assertNotEqual(
            result.returncode, 0,
            "smoke-package.php exited 0 despite a failing check; "
            "the smoke gate cannot fail.\nstdout: %s\nstderr: %s"
            % (result.stdout, result.stderr),
        )
        self.assertIn("SMOKE FAIL", result.stderr)

    def test_unexpected_exception_exits_nonzero(self):
        result = self._run_against_stub(BOOTSTRAP_THROWING)
        self.assertNotEqual(
            result.returncode, 0,
            "smoke-package.php exited 0 despite an unexpected exception; "
            "the try/catch wrapper is missing.\nstdout: %s\nstderr: %s"
            % (result.stdout, result.stderr),
        )
        self.assertIn("SMOKE FAIL", result.stderr)


if __name__ == "__main__":
    unittest.main()
