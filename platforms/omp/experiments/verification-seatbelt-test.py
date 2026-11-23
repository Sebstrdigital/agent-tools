"""Smoke-test a macOS verification-process experiment, not a security audit."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile

PROFILE = Path(__file__).with_name("verification-seatbelt.sb")
CHILD = r'''
import os
from pathlib import Path
import socket
import subprocess
import unittest

root = Path(os.environ["EXPERIMENT_ROOT"])

class Verification(unittest.TestCase):
    def test_project_read(self):
        self.assertEqual((root / "project" / "input.txt").read_text(), "expected\n")

    def test_file_writes_denied(self):
        for path in (root / "project" / "direct.txt", root / "outside.txt"):
            with self.subTest(path=path), self.assertRaises(PermissionError):
                path.write_text("forbidden")
        with self.assertRaises(PermissionError):
            (root / "project" / "input.txt").open("a")
        with self.assertRaises(PermissionError):
            (root / "project" / "input.txt").unlink()
        with self.assertRaises(PermissionError):
            (root / "project" / "outside-link" / "via-link.txt").write_text("forbidden")
        result = subprocess.run(["/bin/sh", "-c", 'printf forbidden > "$EXPERIMENT_ROOT/child.txt"'],
                                capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((root / "child.txt").exists())

    def test_loopback_bind_denied(self):
        with socket.socket() as sock, self.assertRaises(PermissionError):
            sock.bind(("127.0.0.1", 0))

    def test_null_device_usable(self):
        with open("/dev/null", "w") as sink:
            sink.write("discard")

unittest.main(verbosity=2)
'''

if sys.platform != "darwin":
    raise SystemExit("This isolated experiment requires macOS sandbox-exec.")

with tempfile.TemporaryDirectory(prefix="omp-verification-seatbelt-") as tmp:
    root = Path(tmp)
    (root / "project").mkdir()
    (root / "project" / "input.txt").write_text("expected\n")
    (root / "project" / "outside-link").symlink_to(root, target_is_directory=True)
    env = {**os.environ, "EXPERIMENT_ROOT": tmp, "PYTHONDONTWRITEBYTECODE": "1"}
    result = subprocess.run(
        ["/usr/bin/sandbox-exec", "-f", str(PROFILE), sys.executable, "-B", "-c", CHILD],
        cwd=root / "project", env=env, check=False,
    )
    if any((root / path).exists() for path in ("project/direct.txt", "outside.txt", "child.txt", "via-link.txt")):
        raise SystemExit("A forbidden file was created.")
    raise SystemExit(result.returncode)
